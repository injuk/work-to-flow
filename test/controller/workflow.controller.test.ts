import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { BaseEvent } from '../../src/core/lambda.router';
import type { PaginatedResult } from '../../src/core/token-based-pagination';
import { InvalidArgumentException } from '../../src/domain/exception';
import type {
	CreateWorkflowEntity,
	ListWorkflowsConditions,
} from '../../src/domain/type/workflow.dao';
import type { WorkflowSummary } from '../../src/domain/type/workflow.model';

const createServiceMock =
	jest.fn<(ctx: unknown, entity: CreateWorkflowEntity) => Promise<{ id: number }>>();
const listServiceMock =
	jest.fn<
		(
			ctx: unknown,
			conditions: ListWorkflowsConditions,
			token: string | null,
			limit?: number,
		) => Promise<PaginatedResult<WorkflowSummary>>
	>();
const encodeOrThrowMock = jest.fn<(plain: number) => string>();

jest.unstable_mockModule('../../src/service/workflow.service', () => ({
	createAsync: createServiceMock,
	listAsync: listServiceMock,
}));

jest.unstable_mockModule('../../src/util/hashId', () => ({
	encodeOrThrow: encodeOrThrowMock,
	decodeOrThrow: jest.fn(),
}));

const { createAsync, listAsync } = await import('../../src/controller/workflow.controller');

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
});
