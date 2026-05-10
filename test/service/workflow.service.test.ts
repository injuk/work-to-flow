import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
	InvalidArgumentException,
	ResourceNotFoundException,
	UncaughtException,
} from '../../src/domain/exception';
import type { WorkflowStepInsertRow } from '../../src/domain/helper/flatten-requested-step-tree';
import type { RequestedStep } from '../../src/domain/type/workflow-step.model';
import type {
	CreateWorkflowEntity,
	ListWorkflowsConditions,
	UpdateWorkflowEntity,
} from '../../src/domain/type/workflow.dao';
import type {
	StepWithSchemaRow,
	WorkflowRow,
} from '../../src/infrastructure/repository/workflow.repository';

const createRepositoryMock =
	jest.fn<(entity: CreateWorkflowEntity, conn: unknown) => Promise<number>>();
const getRepositoryMock = jest.fn<(id: number, conn?: unknown) => Promise<WorkflowRow | null>>();
const listStepsRepositoryMock =
	jest.fn<(workflowId: number, conn?: unknown) => Promise<StepWithSchemaRow[]>>();
const listRepositoryMock = jest.fn<(search: Record<string, unknown>) => Promise<WorkflowRow[]>>();
const updateRepositoryMock =
	jest.fn<
		(id: number, patch: UpdateWorkflowEntity, conn: unknown) => Promise<{ affectedRows: number }>
	>();
const deleteRepositoryMock =
	jest.fn<(id: number, conn: unknown) => Promise<{ affectedRows: number }>>();
const deleteAllStepsRepositoryMock =
	jest.fn<(workflowId: number, conn: unknown) => Promise<{ affectedRows: number }>>();
const createStepsRepositoryMock =
	jest.fn<(rows: WorkflowStepInsertRow[], conn: unknown) => Promise<void>>();
const listAllRelationsRepositoryMock =
	jest.fn<(conn?: unknown) => Promise<Array<{ frontSchemaId: number; rearSchemaId: number }>>>();
const listSchemasByIdsRepositoryMock =
	jest.fn<
		(
			ids: number[],
			conn?: unknown,
		) => Promise<
			Array<{ id: number; name: string; type: string; condition: string; isHidden: boolean }>
		>
	>();
const executeQueryWithTransactionMock =
	jest.fn<(transaction: (tx: unknown) => Promise<unknown>) => Promise<unknown>>();

jest.unstable_mockModule('../../src/infrastructure/repository/workflow.repository', () => ({
	createAsync: createRepositoryMock,
	getAsync: getRepositoryMock,
	listStepsByWorkflowAsync: listStepsRepositoryMock,
	listAsync: listRepositoryMock,
	updateAsync: updateRepositoryMock,
	deleteAsync: deleteRepositoryMock,
	deleteAllStepsByWorkflowAsync: deleteAllStepsRepositoryMock,
	createStepsAsync: createStepsRepositoryMock,
}));

jest.unstable_mockModule('../../src/infrastructure/repository/step-schema.repository', () => ({
	listAllRelationsAsync: listAllRelationsRepositoryMock,
	listSchemasByIdsAsync: listSchemasByIdsRepositoryMock,
}));

jest.unstable_mockModule('../../src/infrastructure/repository/db', () => ({
	drizzleClient: {
		executeQuery: jest.fn(),
		executeQueryWithTransaction: executeQueryWithTransactionMock,
	},
}));

const { createAsync, deleteAsync, getAsync, listAsync, putStepsAsync, updateAsync } =
	await import('../../src/service/workflow.service');

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

	describe('updateAsync', () => {
		const fakeTx = { tag: 'tx' };
		const validTreeRows: StepWithSchemaRow[] = [
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
			{
				id: 'tail',
				parentId: 'root',
				position: 0,
				condition: '{}',
				schemaId: 2,
				schemaName: 'END',
				schemaType: 'END',
				schemaIsHidden: true,
			},
		];
		const validRelations = [{ frontSchemaId: 1, rearSchemaId: 2 }];
		const validSchemas = [
			{ id: 1, name: 'START', type: 'START', condition: '{}', isHidden: true },
			{ id: 2, name: 'END', type: 'END', condition: '{}', isHidden: true },
		];

		beforeEach(() => {
			getRepositoryMock.mockReset();
			listStepsRepositoryMock.mockReset();
			updateRepositoryMock.mockReset();
			listAllRelationsRepositoryMock.mockReset();
			listSchemasByIdsRepositoryMock.mockReset();
			executeQueryWithTransactionMock.mockReset();
			executeQueryWithTransactionMock.mockImplementation(async (fn) => fn(fakeTx));
			updateRepositoryMock.mockResolvedValue({ affectedRows: 1 });
			listAllRelationsRepositoryMock.mockResolvedValue(validRelations);
			listSchemasByIdsRepositoryMock.mockResolvedValue(validSchemas);
		});

		it('name만 수정(status 미입력) 시 listSteps 미호출, repo.updateAsync 호출 후 null 반환', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(buildRow(42, { Status: 'DRAFT' }));

			// Act
			const result = await updateAsync(undefined, {
				id: 42,
				projectId: 'proj-1',
				data: { name: 'updated' },
			});

			// Assert
			expect(result).toBeNull();
			expect(listStepsRepositoryMock).not.toHaveBeenCalled();
			expect(updateRepositoryMock).toHaveBeenCalledWith(42, { name: 'updated' }, fakeTx);
		});

		it('DRAFT→ACTIVE + 유효 트리(START→END) + relations/conditions 통과 시 update 성공', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(buildRow(42, { Status: 'DRAFT' }));
			listStepsRepositoryMock.mockResolvedValue(validTreeRows);

			// Act
			const result = await updateAsync(undefined, {
				id: 42,
				projectId: 'proj-1',
				data: { status: 'ACTIVE' },
			});

			// Assert
			expect(result).toBeNull();
			expect(listStepsRepositoryMock).toHaveBeenCalledWith(42, fakeTx);
			expect(listAllRelationsRepositoryMock).toHaveBeenCalledWith(fakeTx);
			expect(listSchemasByIdsRepositoryMock).toHaveBeenCalledWith(
				expect.arrayContaining([1, 2]),
				fakeTx,
			);
			expect(updateRepositoryMock).toHaveBeenCalledWith(42, { status: 'ACTIVE' }, fakeTx);
		});

		it('DRAFT→ACTIVE + relations에 엣지 누락이면 InvalidArgumentException, update 미호출', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(buildRow(42, { Status: 'DRAFT' }));
			listStepsRepositoryMock.mockResolvedValue(validTreeRows);
			listAllRelationsRepositoryMock.mockResolvedValue([]); // 1->2 누락

			// Act & Assert
			await expect(
				updateAsync(undefined, { id: 42, projectId: 'proj-1', data: { status: 'ACTIVE' } }),
			).rejects.toBeInstanceOf(InvalidArgumentException);
			expect(updateRepositoryMock).not.toHaveBeenCalled();
		});

		it('DRAFT→ACTIVE + condition required 위반이면 InvalidArgumentException, update 미호출', async () => {
			// Arrange — END schema가 'foo' 필수인데 step.condition은 빈 객체
			getRepositoryMock.mockResolvedValue(buildRow(42, { Status: 'DRAFT' }));
			listStepsRepositoryMock.mockResolvedValue(validTreeRows);
			listSchemasByIdsRepositoryMock.mockResolvedValue([
				{ id: 1, name: 'START', type: 'START', condition: '{}', isHidden: true },
				{
					id: 2,
					name: 'END',
					type: 'END',
					condition: JSON.stringify({
						type: 'object',
						required: ['foo'],
						properties: { foo: { type: 'string' } },
					}),
					isHidden: true,
				},
			]);

			// Act & Assert
			await expect(
				updateAsync(undefined, { id: 42, projectId: 'proj-1', data: { status: 'ACTIVE' } }),
			).rejects.toBeInstanceOf(InvalidArgumentException);
			expect(updateRepositoryMock).not.toHaveBeenCalled();
		});

		it('DRAFT→ACTIVE + 빈 트리면 InvalidArgumentException', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(buildRow(42, { Status: 'DRAFT' }));
			listStepsRepositoryMock.mockResolvedValue([]);

			// Act & Assert
			await expect(
				updateAsync(undefined, { id: 42, projectId: 'proj-1', data: { status: 'ACTIVE' } }),
			).rejects.toBeInstanceOf(InvalidArgumentException);
			expect(updateRepositoryMock).not.toHaveBeenCalled();
		});

		it('DRAFT→ACTIVE + leaf 중 SYNC_TASK 혼재면 InvalidArgumentException', async () => {
			// Arrange — START → SYNC_TASK(leaf, 잘못)
			getRepositoryMock.mockResolvedValue(buildRow(42, { Status: 'DRAFT' }));
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
				{
					id: 'task',
					parentId: 'root',
					position: 0,
					condition: '{}',
					schemaId: 7,
					schemaName: 'SYNC_TASK',
					schemaType: 'SYNC_TASK',
					schemaIsHidden: false,
				},
			]);

			// Act & Assert
			await expect(
				updateAsync(undefined, { id: 42, projectId: 'proj-1', data: { status: 'ACTIVE' } }),
			).rejects.toBeInstanceOf(InvalidArgumentException);
			expect(updateRepositoryMock).not.toHaveBeenCalled();
		});

		it('ACTIVE→DRAFT 전이는 InvalidArgumentException', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(buildRow(42, { Status: 'ACTIVE' }));

			// Act & Assert
			await expect(
				updateAsync(undefined, { id: 42, projectId: 'proj-1', data: { status: 'DRAFT' } }),
			).rejects.toBeInstanceOf(InvalidArgumentException);
			expect(listStepsRepositoryMock).not.toHaveBeenCalled();
			expect(updateRepositoryMock).not.toHaveBeenCalled();
		});

		it('ACTIVE→INACTIVE 전이는 listSteps 미호출, update 성공', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(buildRow(42, { Status: 'ACTIVE' }));

			// Act
			const result = await updateAsync(undefined, {
				id: 42,
				projectId: 'proj-1',
				data: { status: 'INACTIVE' },
			});

			// Assert
			expect(result).toBeNull();
			expect(listStepsRepositoryMock).not.toHaveBeenCalled();
			expect(updateRepositoryMock).toHaveBeenCalledWith(42, { status: 'INACTIVE' }, fakeTx);
		});

		it('미존재 workflow면 ResourceNotFoundException', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(null);

			// Act & Assert
			await expect(
				updateAsync(undefined, { id: 99, projectId: 'proj-1', data: { name: 'x' } }),
			).rejects.toBeInstanceOf(ResourceNotFoundException);
			expect(updateRepositoryMock).not.toHaveBeenCalled();
		});

		it('다른 projectId면 ResourceNotFoundException (정보 누설 방지)', async () => {
			// Arrange — row는 proj-1, 호출은 proj-2
			getRepositoryMock.mockResolvedValue(buildRow(42, { ProjectId: 'proj-1' }));

			// Act & Assert
			await expect(
				updateAsync(undefined, { id: 42, projectId: 'proj-2', data: { name: 'x' } }),
			).rejects.toBeInstanceOf(ResourceNotFoundException);
			expect(updateRepositoryMock).not.toHaveBeenCalled();
		});

		it('DRAFT→DRAFT (no-op) — listSteps 미호출, update 호출, 성공', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(buildRow(42, { Status: 'DRAFT' }));

			// Act
			const result = await updateAsync(undefined, {
				id: 42,
				projectId: 'proj-1',
				data: { status: 'DRAFT' },
			});

			// Assert
			expect(result).toBeNull();
			expect(listStepsRepositoryMock).not.toHaveBeenCalled();
			expect(updateRepositoryMock).toHaveBeenCalledWith(42, { status: 'DRAFT' }, fakeTx);
		});

		it('repo.updateAsync.affectedRows=0이면 UncaughtException', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(buildRow(42, { Status: 'DRAFT' }));
			updateRepositoryMock.mockResolvedValue({ affectedRows: 0 });

			// Act & Assert
			await expect(
				updateAsync(undefined, { id: 42, projectId: 'proj-1', data: { name: 'x' } }),
			).rejects.toBeInstanceOf(UncaughtException);
		});
	});

	describe('deleteAsync', () => {
		const fakeTx = { tag: 'tx' };

		beforeEach(() => {
			getRepositoryMock.mockReset();
			deleteRepositoryMock.mockReset();
			executeQueryWithTransactionMock.mockReset();
			executeQueryWithTransactionMock.mockImplementation(async (fn) => fn(fakeTx));
			deleteRepositoryMock.mockResolvedValue({ affectedRows: 1 });
		});

		it('happy: 존재 + projectId 일치 시 null 반환, repo.deleteAsync가 fakeTx와 함께 호출된다', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(buildRow(42));

			// Act
			const result = await deleteAsync(undefined, { id: 42, projectId: 'proj-1' });

			// Assert
			expect(result).toBeNull();
			expect(executeQueryWithTransactionMock).toHaveBeenCalledTimes(1);
			expect(deleteRepositoryMock).toHaveBeenCalledWith(42, fakeTx);
		});

		it('repo.getAsync가 null이면 ResourceNotFoundException, deleteAsync 미호출', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(null);

			// Act & Assert
			await expect(deleteAsync(undefined, { id: 99, projectId: 'proj-1' })).rejects.toBeInstanceOf(
				ResourceNotFoundException,
			);
			expect(deleteRepositoryMock).not.toHaveBeenCalled();
		});

		it('projectId 미스매치면 ResourceNotFoundException, deleteAsync 미호출 (정보 누설 방지)', async () => {
			// Arrange — row는 proj-1, 호출은 proj-2
			getRepositoryMock.mockResolvedValue(buildRow(5));

			// Act & Assert
			await expect(deleteAsync(undefined, { id: 5, projectId: 'proj-2' })).rejects.toBeInstanceOf(
				ResourceNotFoundException,
			);
			expect(deleteRepositoryMock).not.toHaveBeenCalled();
		});

		it('repo.deleteAsync.affectedRows=0이면 UncaughtException', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(buildRow(42));
			deleteRepositoryMock.mockResolvedValue({ affectedRows: 0 });

			// Act & Assert
			await expect(deleteAsync(undefined, { id: 42, projectId: 'proj-1' })).rejects.toBeInstanceOf(
				UncaughtException,
			);
		});

		it('tx 콜백이 받은 connection을 getAsync와 deleteAsync 모두에 전달한다', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(buildRow(42));

			// Act
			await deleteAsync(undefined, { id: 42, projectId: 'proj-1' });

			// Assert
			expect(getRepositoryMock).toHaveBeenCalledWith(42, fakeTx);
			expect(deleteRepositoryMock).toHaveBeenCalledWith(42, fakeTx);
		});
	});

	describe('putStepsAsync', () => {
		const fakeTx = { tag: 'tx' };
		const validRelations = [{ frontSchemaId: 1, rearSchemaId: 2 }];
		const validSchemas = [
			{ id: 1, name: 'START', type: 'START', condition: '{}', isHidden: true },
			{ id: 2, name: 'END', type: 'END', condition: '{}', isHidden: true },
		];
		const validRoot: RequestedStep = {
			schemaId: 1,
			condition: {},
			children: [{ schemaId: 2, condition: {}, children: [] }],
		};

		beforeEach(() => {
			getRepositoryMock.mockReset();
			deleteAllStepsRepositoryMock.mockReset();
			createStepsRepositoryMock.mockReset();
			listAllRelationsRepositoryMock.mockReset();
			listSchemasByIdsRepositoryMock.mockReset();
			executeQueryWithTransactionMock.mockReset();
			executeQueryWithTransactionMock.mockImplementation(async (fn) => fn(fakeTx));
			deleteAllStepsRepositoryMock.mockResolvedValue({ affectedRows: 0 });
			createStepsRepositoryMock.mockResolvedValue(undefined);
			listAllRelationsRepositoryMock.mockResolvedValue(validRelations);
			listSchemasByIdsRepositoryMock.mockResolvedValue(validSchemas);
		});

		it('happy: DRAFT 워크플로우의 트리를 갈아끼운 뒤 null을 반환한다', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(buildRow(42, { Status: 'DRAFT' }));

			// Act
			const result = await putStepsAsync(undefined, {
				id: 42,
				projectId: 'proj-1',
				root: validRoot,
			});

			// Assert
			expect(result).toBeNull();
			expect(deleteAllStepsRepositoryMock).toHaveBeenCalledWith(42, fakeTx);
			expect(createStepsRepositoryMock).toHaveBeenCalledTimes(1);
			const insertedRows = createStepsRepositoryMock.mock.calls[0]?.[0] as WorkflowStepInsertRow[];
			expect(insertedRows).toHaveLength(2);
			expect(insertedRows[0]).toMatchObject({
				workflowId: 42,
				schemaId: 1,
				parentId: null,
				position: 0,
			});
			expect(insertedRows[1]).toMatchObject({
				workflowId: 42,
				schemaId: 2,
				parentId: insertedRows[0]?.id,
				position: 0,
			});
			expect(listAllRelationsRepositoryMock).toHaveBeenCalledWith(fakeTx);
			expect(listSchemasByIdsRepositoryMock).toHaveBeenCalledWith(
				expect.arrayContaining([1, 2]),
				fakeTx,
			);
		});

		it('happy: INACTIVE 워크플로우도 갈아끼울 수 있다', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(buildRow(42, { Status: 'INACTIVE' }));

			// Act
			const result = await putStepsAsync(undefined, {
				id: 42,
				projectId: 'proj-1',
				root: validRoot,
			});

			// Assert
			expect(result).toBeNull();
			expect(createStepsRepositoryMock).toHaveBeenCalled();
		});

		it('미존재 workflow면 ResourceNotFoundException', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(null);

			// Act & Assert
			await expect(
				putStepsAsync(undefined, { id: 99, projectId: 'proj-1', root: validRoot }),
			).rejects.toBeInstanceOf(ResourceNotFoundException);
			expect(createStepsRepositoryMock).not.toHaveBeenCalled();
			expect(deleteAllStepsRepositoryMock).not.toHaveBeenCalled();
		});

		it('projectId 미스매치면 ResourceNotFoundException (정보 누설 방지)', async () => {
			// Arrange — row는 proj-1, 호출은 proj-2
			getRepositoryMock.mockResolvedValue(buildRow(42, { Status: 'DRAFT' }));

			// Act & Assert
			await expect(
				putStepsAsync(undefined, { id: 42, projectId: 'proj-2', root: validRoot }),
			).rejects.toBeInstanceOf(ResourceNotFoundException);
			expect(createStepsRepositoryMock).not.toHaveBeenCalled();
		});

		it('status가 ACTIVE면 InvalidArgumentException, delete/create 미호출', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(buildRow(42, { Status: 'ACTIVE' }));

			// Act & Assert
			await expect(
				putStepsAsync(undefined, { id: 42, projectId: 'proj-1', root: validRoot }),
			).rejects.toBeInstanceOf(InvalidArgumentException);
			expect(deleteAllStepsRepositoryMock).not.toHaveBeenCalled();
			expect(createStepsRepositoryMock).not.toHaveBeenCalled();
		});

		it('relations 누락(START→END 엣지 없음)이면 InvalidArgumentException, delete/create 미호출', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(buildRow(42, { Status: 'DRAFT' }));
			listAllRelationsRepositoryMock.mockResolvedValue([]);

			// Act & Assert
			await expect(
				putStepsAsync(undefined, { id: 42, projectId: 'proj-1', root: validRoot }),
			).rejects.toBeInstanceOf(InvalidArgumentException);
			expect(deleteAllStepsRepositoryMock).not.toHaveBeenCalled();
			expect(createStepsRepositoryMock).not.toHaveBeenCalled();
		});

		it('leaf가 END가 아니면(START 단일 노드) InvalidArgumentException', async () => {
			// Arrange — root만 있고 children 없음
			getRepositoryMock.mockResolvedValue(buildRow(42, { Status: 'DRAFT' }));
			const startOnlyRoot: RequestedStep = { schemaId: 1, condition: {}, children: [] };

			// Act & Assert
			await expect(
				putStepsAsync(undefined, { id: 42, projectId: 'proj-1', root: startOnlyRoot }),
			).rejects.toBeInstanceOf(InvalidArgumentException);
			expect(deleteAllStepsRepositoryMock).not.toHaveBeenCalled();
			expect(createStepsRepositoryMock).not.toHaveBeenCalled();
		});

		it('depth 21이면 InvalidArgumentException', async () => {
			// Arrange — 21 깊이 단일 체인. relations/schemas는 1->1만 허용해도 depth 검증이 먼저 차단
			getRepositoryMock.mockResolvedValue(buildRow(42, { Status: 'DRAFT' }));
			let chain: RequestedStep = { schemaId: 1, condition: {}, children: [] };
			for (let i = 0; i < 20; i++) {
				chain = { schemaId: 1, condition: {}, children: [chain] };
			}

			// Act & Assert
			await expect(
				putStepsAsync(undefined, { id: 42, projectId: 'proj-1', root: chain }),
			).rejects.toBeInstanceOf(InvalidArgumentException);
			expect(deleteAllStepsRepositoryMock).not.toHaveBeenCalled();
		});

		it('카탈로그에 없는 schemaId는 UncaughtException으로 전파된다', async () => {
			// Arrange — schemaId=999는 schemas에 없음
			getRepositoryMock.mockResolvedValue(buildRow(42, { Status: 'DRAFT' }));
			const unknownRoot: RequestedStep = {
				schemaId: 999,
				condition: {},
				children: [{ schemaId: 2, condition: {}, children: [] }],
			};

			// Act & Assert
			await expect(
				putStepsAsync(undefined, { id: 42, projectId: 'proj-1', root: unknownRoot }),
			).rejects.toBeInstanceOf(UncaughtException);
			expect(deleteAllStepsRepositoryMock).not.toHaveBeenCalled();
		});

		it('tx 콜백이 받은 connection을 getAsync/listAllRelations/listSchemas/delete/create 모두에 전달한다', async () => {
			// Arrange
			getRepositoryMock.mockResolvedValue(buildRow(42, { Status: 'DRAFT' }));

			// Act
			await putStepsAsync(undefined, { id: 42, projectId: 'proj-1', root: validRoot });

			// Assert
			expect(getRepositoryMock).toHaveBeenCalledWith(42, fakeTx);
			expect(listAllRelationsRepositoryMock).toHaveBeenCalledWith(fakeTx);
			expect(listSchemasByIdsRepositoryMock).toHaveBeenCalledWith(expect.any(Array), fakeTx);
			expect(deleteAllStepsRepositoryMock).toHaveBeenCalledWith(42, fakeTx);
			const createCallConn = createStepsRepositoryMock.mock.calls[0]?.[1];
			expect(createCallConn).toBe(fakeTx);
		});
	});
});
