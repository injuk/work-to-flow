import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ResourceNotFoundException, UncaughtException } from '../../src/domain/exception';
import type {
	CreateWorkflowEntity,
	ListWorkflowsConditions,
} from '../../src/domain/type/workflow.dao';
import type {
	StepWithSchemaRow,
	WorkflowRow,
} from '../../src/infrastructure/repository/workflow.repository';

const createRepositoryMock =
	jest.fn<(entity: CreateWorkflowEntity, conn: unknown) => Promise<number>>();
const getRepositoryMock = jest.fn<(id: number) => Promise<WorkflowRow | null>>();
const listStepsRepositoryMock = jest.fn<(workflowId: number) => Promise<StepWithSchemaRow[]>>();
const listRepositoryMock = jest.fn<(search: Record<string, unknown>) => Promise<WorkflowRow[]>>();
const executeQueryWithTransactionMock =
	jest.fn<(transaction: (tx: unknown) => Promise<unknown>) => Promise<unknown>>();

jest.unstable_mockModule('../../src/infrastructure/repository/workflow.repository', () => ({
	createAsync: createRepositoryMock,
	getAsync: getRepositoryMock,
	listStepsByWorkflowAsync: listStepsRepositoryMock,
	listAsync: listRepositoryMock,
}));

jest.unstable_mockModule('../../src/infrastructure/repository/db', () => ({
	drizzleClient: {
		executeQuery: jest.fn(),
		executeQueryWithTransaction: executeQueryWithTransactionMock,
	},
}));

const { createAsync, getAsync, listAsync } = await import('../../src/service/workflow.service');

const buildEntity = (): CreateWorkflowEntity => ({
	projectId: 'proj-1',
	name: 'wf-1',
	description: 'a description',
	createdById: 'System',
});

const buildRow = (id: number, overrides: Partial<WorkflowRow> = {}): WorkflowRow => ({
	Id: id,
	ProjectId: 'proj-1',
	Name: `wf-${id}`,
	Description: null,
	Status: 'DRAFT',
	CreatedAt: new Date('2026-05-11T00:00:00Z'),
	UpdatedAt: new Date('2026-05-11T00:00:00Z'),
	CreatedById: 'System',
	...overrides,
});

const decodeToken = (token: string): { offset: number; limit: number; [key: string]: unknown } =>
	JSON.parse(Buffer.from(token, 'base64').toString('utf8'));

const encodeToken = (cursor: Record<string, unknown>): string =>
	Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64');

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

	describe('getAsync', () => {
		beforeEach(() => {
			getRepositoryMock.mockReset();
			listStepsRepositoryMock.mockReset();
		});

		it('Workflow와 stepTree(빈 트리는 null)를 함께 매핑하여 반환한다', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(buildRow(42));
			listStepsRepositoryMock.mockResolvedValue([]);

			// Act
			const result = await getAsync(undefined, { id: 42, projectId: 'proj-1' });

			// Assert
			expect(result).toEqual({
				id: 42,
				project: { id: 'proj-1' },
				name: 'wf-42',
				description: null,
				status: 'DRAFT',
				stepTree: null,
				created: {
					at: new Date('2026-05-11T00:00:00Z'),
					by: { id: 'System', name: 'System', username: 'System' },
				},
				updated: { at: new Date('2026-05-11T00:00:00Z') },
			});
			expect(listStepsRepositoryMock).toHaveBeenCalledWith(42);
		});

		it('step row가 있을 때 stepTree로 어셈블한다', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(buildRow(7));
			listStepsRepositoryMock.mockResolvedValue([
				{
					id: 'root',
					parentId: null,
					position: 0,
					condition: '{}',
					schemaId: 1,
					schemaName: 'START',
					schemaType: 'START',
					schemaIsHidden: true,
				},
			]);

			// Act
			const result = await getAsync(undefined, { id: 7, projectId: 'proj-1' });

			// Assert
			expect(result.stepTree?.id).toBe('root');
			expect(result.stepTree?.children).toEqual([]);
		});

		it('repository.getAsync가 null이면 ResourceNotFoundException을 throw한다', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(null);

			// Act & Assert
			await expect(getAsync(undefined, { id: 99, projectId: 'proj-1' })).rejects.toBeInstanceOf(
				ResourceNotFoundException,
			);
			expect(listStepsRepositoryMock).not.toHaveBeenCalled();
		});

		it('projectId가 일치하지 않으면 ResourceNotFoundException을 throw한다 (정보 누설 방지)', async () => {
			// Arrange — row는 proj-1, 호출은 proj-2
			getRepositoryMock.mockResolvedValue(buildRow(5));

			// Act & Assert
			await expect(getAsync(undefined, { id: 5, projectId: 'proj-2' })).rejects.toBeInstanceOf(
				ResourceNotFoundException,
			);
			expect(listStepsRepositoryMock).not.toHaveBeenCalled();
		});
	});

	describe('listAsync', () => {
		beforeEach(() => {
			listRepositoryMock.mockReset();
		});

		it('repository row를 WorkflowSummary로 매핑하고 nextToken은 null이다', async () => {
			// Arrange
			listRepositoryMock.mockResolvedValue([buildRow(1), buildRow(2), buildRow(3)]);
			const conditions: ListWorkflowsConditions = { projectId: 'proj-1' };

			// Act
			const result = await listAsync(undefined, conditions);

			// Assert
			expect(result.nextToken).toBeNull();
			expect(result.results).toHaveLength(3);
			expect(result.results[0]).toEqual({
				id: 1,
				project: { id: 'proj-1' },
				name: 'wf-1',
				status: 'DRAFT',
				created: {
					at: new Date('2026-05-11T00:00:00Z'),
					by: { id: 'System', name: 'System', username: 'System' },
				},
				updated: { at: new Date('2026-05-11T00:00:00Z') },
			});
		});

		it('status 필터를 repository에 그대로 전달한다', async () => {
			// Arrange
			listRepositoryMock.mockResolvedValue([]);

			// Act
			await listAsync(undefined, { projectId: 'proj-1', status: 'ACTIVE' });

			// Assert
			expect(listRepositoryMock).toHaveBeenCalledWith(
				expect.objectContaining({ projectId: 'proj-1', status: 'ACTIVE' }),
			);
		});

		it('limit 미제공 시 default 50 + probe 1로 repository를 호출한다', async () => {
			// Arrange
			listRepositoryMock.mockResolvedValue([]);

			// Act
			await listAsync(undefined, { projectId: 'proj-1' });

			// Assert
			expect(listRepositoryMock).toHaveBeenCalledWith(
				expect.objectContaining({ offset: 0, limit: 51 }),
			);
		});

		it('limit=2일 때 repo가 3건을 반환하면 results는 2건, nextToken은 offset=2를 가리킨다', async () => {
			// Arrange
			listRepositoryMock.mockResolvedValue([buildRow(1), buildRow(2), buildRow(3)]);

			// Act
			const result = await listAsync(undefined, { projectId: 'proj-1' }, null, 2);

			// Assert
			expect(result.results).toHaveLength(2);
			expect(result.nextToken).not.toBeNull();
			const cursor = decodeToken(result.nextToken as string);
			expect(cursor.offset).toBe(2);
			expect(cursor.limit).toBe(2);
			expect(listRepositoryMock).toHaveBeenCalledWith(
				expect.objectContaining({ offset: 0, limit: 3 }),
			);
		});

		it('token이 들어오면 cursor의 offset/limit이 repository에 전달된다', async () => {
			// Arrange
			listRepositoryMock.mockResolvedValue([]);
			const token = encodeToken({
				offset: 10,
				limit: 5,
				projectId: 'proj-1',
				status: 'INACTIVE',
			});

			// Act
			await listAsync(undefined, { projectId: 'proj-1' }, token);

			// Assert
			expect(listRepositoryMock).toHaveBeenCalledWith(
				expect.objectContaining({
					projectId: 'proj-1',
					status: 'INACTIVE',
					offset: 10,
					limit: 6,
				}),
			);
		});
	});
});
