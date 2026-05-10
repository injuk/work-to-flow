import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { BaseEvent } from '../../src/core/lambda.router';
import type { PaginatedResult } from '../../src/core/token-based-pagination';
import { InvalidArgumentException } from '../../src/domain/exception';
import type {
	CreateWorkflowEntity,
	DeleteWorkflowConditions,
	GetWorkflowConditions,
	ListWorkflowsConditions,
	UpdateWorkflowConditions,
} from '../../src/domain/type/workflow.dao';
import type { Workflow, WorkflowSummary } from '../../src/domain/type/workflow.model';

const createServiceMock =
	jest.fn<(ctx: unknown, entity: CreateWorkflowEntity) => Promise<{ id: number }>>();
const getServiceMock =
	jest.fn<(ctx: unknown, conditions: GetWorkflowConditions) => Promise<Workflow>>();
const listServiceMock =
	jest.fn<
		(
			ctx: unknown,
			conditions: ListWorkflowsConditions,
			token: string | null,
			limit?: number,
		) => Promise<PaginatedResult<WorkflowSummary>>
	>();
const updateServiceMock =
	jest.fn<(ctx: unknown, conditions: UpdateWorkflowConditions) => Promise<null>>();
const deleteServiceMock =
	jest.fn<(ctx: unknown, conditions: DeleteWorkflowConditions) => Promise<null>>();
const encodeOrThrowMock = jest.fn<(plain: number) => string>();
const decodeOrThrowMock = jest.fn<(cipher: string) => number>();

jest.unstable_mockModule('../../src/service/workflow.service', () => ({
	createAsync: createServiceMock,
	getAsync: getServiceMock,
	listAsync: listServiceMock,
	updateAsync: updateServiceMock,
	deleteAsync: deleteServiceMock,
}));

jest.unstable_mockModule('../../src/util/hashId', () => ({
	encodeOrThrow: encodeOrThrowMock,
	decodeOrThrow: decodeOrThrowMock,
}));

const { createAsync, deleteAsync, getAsync, listAsync, updateAsync } =
	await import('../../src/controller/workflow.controller');

const buildSummary = (id: number): WorkflowSummary => ({
	id,
	project: { id: 'proj-1' },
	name: `wf-${id}`,
	status: 'DRAFT',
	created: {
		at: new Date('2026-05-11T00:00:00Z'),
		by: { id: 'System', name: 'System', username: 'System' },
	},
	updated: { at: new Date('2026-05-11T00:00:00Z') },
});

const buildWorkflow = (id: number): Workflow => ({
	...buildSummary(id),
	description: 'desc',
	stepTree: null,
});

describe('workflow.controller', () => {
	describe('createAsync', () => {
		beforeEach(() => {
			createServiceMock.mockReset();
			encodeOrThrowMock.mockReset();
		});

		it('projectId 헤더와 data를 service에 전달하고 hashId 인코딩 결과를 반환한다', async () => {
			// Arrange
			const event: BaseEvent = {
				function: 'createWorkflow',
				data: { name: 'wf-1', description: 'desc' },
				headers: { projectId: 'proj-1' },
			};
			createServiceMock.mockResolvedValue({ id: 42 });
			encodeOrThrowMock.mockReturnValue('hashed-id');

			// Act
			const result = await createAsync(event, undefined);

			// Assert
			expect(result).toEqual({ id: 'hashed-id' });
			expect(createServiceMock).toHaveBeenCalledWith(undefined, {
				projectId: 'proj-1',
				name: 'wf-1',
				description: 'desc',
				createdById: 'System',
			});
			expect(encodeOrThrowMock).toHaveBeenCalledWith(42);
		});

		it('projectId 헤더가 없으면 InvalidArgumentException을 throw하고 service를 호출하지 않는다', async () => {
			// Arrange
			const event: BaseEvent = {
				function: 'createWorkflow',
				data: { name: 'wf-1' },
			};

			// Act & Assert
			await expect(createAsync(event, undefined)).rejects.toBeInstanceOf(InvalidArgumentException);
			expect(createServiceMock).not.toHaveBeenCalled();
		});
	});

	describe('listAsync', () => {
		beforeEach(() => {
			listServiceMock.mockReset();
			encodeOrThrowMock.mockReset();
		});

		it('service 결과의 각 id를 hash 인코딩하고 nextToken은 그대로 통과시킨다', async () => {
			// Arrange
			const event: BaseEvent = {
				function: 'listWorkflows',
				headers: { projectId: 'proj-1' },
				queryStringParameters: { status: 'ACTIVE', limit: '10' },
			};
			listServiceMock.mockResolvedValue({
				results: [buildSummary(1), buildSummary(2)],
				nextToken: 'tok',
			});
			encodeOrThrowMock.mockImplementation((id) => `hash-${id}`);

			// Act
			const result = await listAsync(event, undefined);

			// Assert
			expect(listServiceMock).toHaveBeenCalledWith(
				undefined,
				{ projectId: 'proj-1', status: 'ACTIVE' },
				null,
				10,
			);
			expect(result.nextToken).toBe('tok');
			expect(result.results.map((r) => r.id)).toEqual(['hash-1', 'hash-2']);
			expect(result.results[0]?.name).toBe('wf-1');
		});

		it('projectId 헤더가 없으면 InvalidArgumentException을 throw하고 service를 호출하지 않는다', async () => {
			// Arrange
			const event: BaseEvent = {
				function: 'listWorkflows',
				queryStringParameters: {},
			};

			// Act & Assert
			await expect(listAsync(event, undefined)).rejects.toBeInstanceOf(InvalidArgumentException);
			expect(listServiceMock).not.toHaveBeenCalled();
		});
	});

	describe('getAsync', () => {
		beforeEach(() => {
			getServiceMock.mockReset();
			encodeOrThrowMock.mockReset();
			decodeOrThrowMock.mockReset();
		});

		it('workflowId를 디코드해 service에 전달하고 응답 id를 인코딩한다', async () => {
			// Arrange
			const event: BaseEvent = {
				function: 'getWorkflow',
				headers: { projectId: 'proj-1' },
				pathParameters: { workflowId: 'cipher-42' },
			};
			decodeOrThrowMock.mockReturnValue(42);
			getServiceMock.mockResolvedValue(buildWorkflow(42));
			encodeOrThrowMock.mockReturnValue('cipher-42');

			// Act
			const result = await getAsync(event, undefined);

			// Assert
			expect(decodeOrThrowMock).toHaveBeenCalledWith('cipher-42');
			expect(getServiceMock).toHaveBeenCalledWith(undefined, { id: 42, projectId: 'proj-1' });
			expect(encodeOrThrowMock).toHaveBeenCalledWith(42);
			expect(result.id).toBe('cipher-42');
			expect(result.stepTree).toBeNull();
		});

		it('projectId 헤더가 없으면 InvalidArgumentException을 throw하고 service를 호출하지 않는다', async () => {
			// Arrange
			const event: BaseEvent = {
				function: 'getWorkflow',
				pathParameters: { workflowId: 'cipher-1' },
			};

			// Act & Assert
			await expect(getAsync(event, undefined)).rejects.toBeInstanceOf(InvalidArgumentException);
			expect(getServiceMock).not.toHaveBeenCalled();
		});

		it('workflowId가 없으면 InvalidArgumentException을 throw하고 service를 호출하지 않는다', async () => {
			// Arrange
			const event: BaseEvent = {
				function: 'getWorkflow',
				headers: { projectId: 'proj-1' },
			};

			// Act & Assert
			await expect(getAsync(event, undefined)).rejects.toBeInstanceOf(InvalidArgumentException);
			expect(getServiceMock).not.toHaveBeenCalled();
		});
	});

	describe('updateAsync', () => {
		beforeEach(() => {
			updateServiceMock.mockReset();
			decodeOrThrowMock.mockReset();
		});

		it('workflowId 디코드 후 service에 {id, projectId, data} 전달하고 null을 반환한다', async () => {
			// Arrange
			const event: BaseEvent = {
				function: 'updateWorkflow',
				headers: { projectId: 'proj-1' },
				pathParameters: { workflowId: 'cipher-42' },
				data: { name: 'updated', status: 'ACTIVE' },
			};
			decodeOrThrowMock.mockReturnValue(42);
			updateServiceMock.mockResolvedValue(null);

			// Act
			const result = await updateAsync(event, undefined);

			// Assert
			expect(result).toBeNull();
			expect(decodeOrThrowMock).toHaveBeenCalledWith('cipher-42');
			expect(updateServiceMock).toHaveBeenCalledWith(undefined, {
				id: 42,
				projectId: 'proj-1',
				data: { name: 'updated', status: 'ACTIVE' },
			});
		});

		it('projectId 헤더가 없으면 InvalidArgumentException을 throw하고 service를 호출하지 않는다', async () => {
			// Arrange
			const event: BaseEvent = {
				function: 'updateWorkflow',
				pathParameters: { workflowId: 'cipher-1' },
				data: { name: 'x' },
			};

			// Act & Assert
			await expect(updateAsync(event, undefined)).rejects.toBeInstanceOf(InvalidArgumentException);
			expect(updateServiceMock).not.toHaveBeenCalled();
		});

		it('workflowId가 없으면 InvalidArgumentException을 throw하고 service를 호출하지 않는다', async () => {
			// Arrange
			const event: BaseEvent = {
				function: 'updateWorkflow',
				headers: { projectId: 'proj-1' },
				data: { name: 'x' },
			};

			// Act & Assert
			await expect(updateAsync(event, undefined)).rejects.toBeInstanceOf(InvalidArgumentException);
			expect(decodeOrThrowMock).not.toHaveBeenCalled();
			expect(updateServiceMock).not.toHaveBeenCalled();
		});

		it('decodeOrThrow가 throw하면 그대로 전파되고 service는 호출되지 않는다', async () => {
			// Arrange
			const event: BaseEvent = {
				function: 'updateWorkflow',
				headers: { projectId: 'proj-1' },
				pathParameters: { workflowId: 'invalid' },
				data: { name: 'x' },
			};
			decodeOrThrowMock.mockImplementation(() => {
				throw new InvalidArgumentException('bad cipher');
			});

			// Act & Assert
			await expect(updateAsync(event, undefined)).rejects.toBeInstanceOf(InvalidArgumentException);
			expect(updateServiceMock).not.toHaveBeenCalled();
		});
	});

	describe('deleteAsync', () => {
		beforeEach(() => {
			deleteServiceMock.mockReset();
			decodeOrThrowMock.mockReset();
		});

		it('workflowId 디코드 후 service에 {id, projectId} 전달하고 null을 반환한다', async () => {
			// Arrange
			const event: BaseEvent = {
				function: 'deleteWorkflow',
				headers: { projectId: 'proj-1' },
				pathParameters: { workflowId: 'cipher-42' },
			};
			decodeOrThrowMock.mockReturnValue(42);
			deleteServiceMock.mockResolvedValue(null);

			// Act
			const result = await deleteAsync(event, undefined);

			// Assert
			expect(result).toBeNull();
			expect(decodeOrThrowMock).toHaveBeenCalledWith('cipher-42');
			expect(deleteServiceMock).toHaveBeenCalledWith(undefined, { id: 42, projectId: 'proj-1' });
		});

		it('projectId 헤더가 없으면 InvalidArgumentException을 throw하고 service를 호출하지 않는다', async () => {
			// Arrange
			const event: BaseEvent = {
				function: 'deleteWorkflow',
				pathParameters: { workflowId: 'cipher-1' },
			};

			// Act & Assert
			await expect(deleteAsync(event, undefined)).rejects.toBeInstanceOf(InvalidArgumentException);
			expect(deleteServiceMock).not.toHaveBeenCalled();
		});

		it('workflowId가 없으면 InvalidArgumentException을 throw하고 service를 호출하지 않는다', async () => {
			// Arrange
			const event: BaseEvent = {
				function: 'deleteWorkflow',
				headers: { projectId: 'proj-1' },
			};

			// Act & Assert
			await expect(deleteAsync(event, undefined)).rejects.toBeInstanceOf(InvalidArgumentException);
			expect(decodeOrThrowMock).not.toHaveBeenCalled();
			expect(deleteServiceMock).not.toHaveBeenCalled();
		});

		it('decodeOrThrow가 throw하면 그대로 전파되고 service는 호출되지 않는다', async () => {
			// Arrange
			const event: BaseEvent = {
				function: 'deleteWorkflow',
				headers: { projectId: 'proj-1' },
				pathParameters: { workflowId: 'invalid' },
			};
			decodeOrThrowMock.mockImplementation(() => {
				throw new InvalidArgumentException('bad cipher');
			});

			// Act & Assert
			await expect(deleteAsync(event, undefined)).rejects.toBeInstanceOf(InvalidArgumentException);
			expect(deleteServiceMock).not.toHaveBeenCalled();
		});
	});
});
