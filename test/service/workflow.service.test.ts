import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { UncaughtException } from '../../src/domain/exception';
import type { CreateWorkflowEntity } from '../../src/domain/type/workflow.dao';

const createRepositoryMock =
	jest.fn<(entity: CreateWorkflowEntity, conn: unknown) => Promise<number>>();
const executeQueryWithTransactionMock =
	jest.fn<(transaction: (tx: unknown) => Promise<unknown>) => Promise<unknown>>();

jest.unstable_mockModule('../../src/infrastructure/repository/workflow.repository', () => ({
	createAsync: createRepositoryMock,
	getAsync: jest.fn(),
}));

jest.unstable_mockModule('../../src/infrastructure/repository/db', () => ({
	drizzleClient: {
		executeQuery: jest.fn(),
		executeQueryWithTransaction: executeQueryWithTransactionMock,
	},
}));

const { createAsync } = await import('../../src/service/workflow.service');

const buildEntity = (): CreateWorkflowEntity => ({
	projectId: 'proj-1',
	name: 'wf-1',
	description: 'a description',
	createdById: 'System',
});

describe('workflow.service', () => {
	describe('createAsync', () => {
		beforeEach(() => {
			createRepositoryMock.mockReset();
			executeQueryWithTransactionMock.mockReset();
		});

		it('repository.createAsync의 insertId를 { id } 형태로 반환한다', async () => {
			// Arrange
			executeQueryWithTransactionMock.mockImplementation(async (fn) => fn({ tag: 'tx' }));
			createRepositoryMock.mockResolvedValue(42);

			// Act
			const result = await createAsync(undefined, buildEntity());

			// Assert
			expect(result).toEqual({ id: 42 });
			expect(executeQueryWithTransactionMock).toHaveBeenCalledTimes(1);
		});

		it('트랜잭션 콜백이 받은 connection을 repository.createAsync에 그대로 전달한다', async () => {
			// Arrange
			const fakeTx = { tag: 'tx' };
			executeQueryWithTransactionMock.mockImplementation(async (fn) => fn(fakeTx));
			createRepositoryMock.mockResolvedValue(7);
			const entity = buildEntity();

			// Act
			await createAsync(undefined, entity);

			// Assert
			expect(createRepositoryMock).toHaveBeenCalledWith(entity, fakeTx);
		});

		it('insertId가 0이면 UncaughtException을 throw한다', async () => {
			// Arrange
			executeQueryWithTransactionMock.mockImplementation(async (fn) => fn(null));
			createRepositoryMock.mockResolvedValue(0);

			// Act & Assert
			await expect(createAsync(undefined, buildEntity())).rejects.toBeInstanceOf(UncaughtException);
		});
	});
});
