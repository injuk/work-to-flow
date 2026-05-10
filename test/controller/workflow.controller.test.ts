import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { BaseEvent } from '../../src/core/lambda.router';
import { InvalidArgumentException } from '../../src/domain/exception';
import type { CreateWorkflowEntity } from '../../src/domain/type/workflow.dao';

const createServiceMock =
	jest.fn<(ctx: unknown, entity: CreateWorkflowEntity) => Promise<{ id: number }>>();
const encodeOrThrowMock = jest.fn<(plain: number) => string>();

jest.unstable_mockModule('../../src/service/workflow.service', () => ({
	createAsync: createServiceMock,
}));

jest.unstable_mockModule('../../src/util/hashId', () => ({
	encodeOrThrow: encodeOrThrowMock,
	decodeOrThrow: jest.fn(),
}));

const { createAsync } = await import('../../src/controller/workflow.controller');

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
});
