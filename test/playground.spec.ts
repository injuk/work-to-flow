import { handler } from '../src/route';
import { InvalidArgumentException, ResourceNotFoundException } from '../src/domain/exception';
import { db } from '../src/infrastructure/repository/db';
import { encodeOrThrow } from '../src/util/hashId';
import type {
	GetWorkflowResponse,
	ListWorkflowsResponse,
} from '../src/controller/dto/workflow.dto';

describe('playground', () => {
	afterAll(async () => {
		await db.$client.end();
	});

	it('createWorkflow가 Workflows 테이블에 INSERT하고 hashId 인코딩된 id를 반환한다', async () => {
		const result = (await handler(
			{
				function: 'createWorkflow',
				data: { name: `playground-${Date.now()}`, description: 'integration test' },
				headers: { projectId: 'playground-project' },
			},
			{},
		)) as { id: string };

		expect(typeof result.id).toBe('string');
		expect(result.id.length).toBeGreaterThanOrEqual(24);
		expect(result.id).toMatch(/^[a-z0-9]+$/);
	});

	it('listWorkflows가 INSERT한 워크플로우를 페이지네이션해 반환한다', async () => {
		// Arrange — 동일 project로 3건 INSERT (이 테스트만의 고유 projectId)
		const projectId = `playground-list-${Date.now()}`;
		const insertedIds = new Set<string>();
		for (let i = 0; i < 3; i++) {
			const created = (await handler(
				{
					function: 'createWorkflow',
					data: { name: `playground-list-${i}` },
					headers: { projectId },
				},
				{},
			)) as { id: string };
			insertedIds.add(created.id);
		}

		// Act — limit=2로 첫 페이지
		const firstPage = (await handler(
			{
				function: 'listWorkflows',
				headers: { projectId },
				queryStringParameters: { limit: '2' },
			},
			{},
		)) as ListWorkflowsResponse;
		console.log(JSON.stringify(firstPage, null, 2));

		// Assert — 2건 + nextToken
		expect(firstPage.results).toHaveLength(2);
		expect(firstPage.nextToken).not.toBeNull();
		firstPage.results.forEach((row) => {
			expect(typeof row.id).toBe('string');
			expect(row.id).toMatch(/^[a-z0-9]+$/);
			expect(row.project.id).toBe(projectId);
			expect(row.status).toBe('DRAFT');
		});

		// Act — nextToken으로 둘째 페이지
		const secondPage = (await handler(
			{
				function: 'listWorkflows',
				headers: { projectId },
				queryStringParameters: { limit: '2', nextToken: firstPage.nextToken as string },
			},
			{},
		)) as ListWorkflowsResponse;

		// Assert — 남은 1건 + nextToken null
		expect(secondPage.results).toHaveLength(1);
		expect(secondPage.nextToken).toBeNull();

		// Assert — 두 페이지를 합치면 INSERT한 3건과 정확히 일치
		const seen = new Set([...firstPage.results, ...secondPage.results].map((r) => r.id));
		expect(seen).toEqual(insertedIds);
	});

	it('getWorkflow가 stepTree=null인 DRAFT 워크플로우를 상세 조회한다', async () => {
		// Arrange — 단건 INSERT
		const projectId = `playground-get-${Date.now()}`;
		const created = (await handler(
			{
				function: 'createWorkflow',
				data: { name: `playground-get`, description: 'detail target' },
				headers: { projectId },
			},
			{},
		)) as { id: string };

		// Act
		const detail = (await handler(
			{
				function: 'getWorkflow',
				headers: { projectId },
				pathParameters: { workflowId: created.id },
			},
			{},
		)) as GetWorkflowResponse;

		// Assert
		expect(detail.id).toBe(created.id);
		expect(detail.project.id).toBe(projectId);
		expect(detail.name).toBe('playground-get');
		expect(detail.description).toBe('detail target');
		expect(detail.status).toBe('DRAFT');
		expect(detail.stepTree).toBeNull();
		expect(detail.created.by).toEqual({
			id: 'System',
			name: 'System',
			username: 'System',
		});
	});

	it('updateWorkflow가 DRAFT 워크플로우의 name을 갱신하고 후속 getWorkflow에서 변경이 보인다', async () => {
		// Arrange — 단건 INSERT
		const projectId = `playground-update-${Date.now()}`;
		const created = (await handler(
			{
				function: 'createWorkflow',
				data: { name: 'before', description: 'before-desc' },
				headers: { projectId },
			},
			{},
		)) as { id: string };

		// Act — name PATCH
		const updateResult = await handler(
			{
				function: 'updateWorkflow',
				headers: { projectId },
				pathParameters: { workflowId: created.id },
				data: { name: 'after' },
			},
			{},
		);

		// Assert — 204 시맨틱 (null 반환)
		expect(updateResult).toBeNull();

		// Act — 변경 확인
		const detail = (await handler(
			{
				function: 'getWorkflow',
				headers: { projectId },
				pathParameters: { workflowId: created.id },
			},
			{},
		)) as GetWorkflowResponse;

		// Assert
		expect(detail.id).toBe(created.id);
		expect(detail.name).toBe('after');
		expect(detail.description).toBe('before-desc');
		expect(detail.status).toBe('DRAFT');
	});

	it('putWorkflowSteps가 시드 그래프 위에 트리를 배치하고 후속 getWorkflow에서 stepTree가 어셈블된다', async () => {
		// Arrange — DRAFT 워크플로우 INSERT
		const projectId = `playground-put-steps-${Date.now()}`;
		const created = (await handler(
			{
				function: 'createWorkflow',
				data: { name: 'put-steps-target' },
				headers: { projectId },
			},
			{},
		)) as { id: string };

		// Arrange — 시드 그래프: START(1) → ASSET_CREATED(4) → SEND_EMAIL(11) → END(2)
		const SCHEMA_START = encodeOrThrow(1);
		const SCHEMA_END = encodeOrThrow(2);
		const SCHEMA_ASSET_CREATED = encodeOrThrow(4);
		const SCHEMA_SEND_EMAIL = encodeOrThrow(11);

		// Act — PUT 트리 적용
		const putResult = await handler(
			{
				function: 'putWorkflowSteps',
				headers: { projectId },
				pathParameters: { workflowId: created.id },
				data: {
					stepTree: {
						schemaId: SCHEMA_START,
						condition: {},
						children: [
							{
								schemaId: SCHEMA_ASSET_CREATED,
								condition: { mediaType: ['IMAGE'] },
								children: [
									{
										schemaId: SCHEMA_SEND_EMAIL,
										condition: {},
										children: [{ schemaId: SCHEMA_END, condition: {}, children: [] }],
									},
								],
							},
						],
					},
				},
			},
			{},
		);

		// Assert — 204 시맨틱
		expect(putResult).toBeNull();

		// Act — getWorkflow로 stepTree 어셈블 확인
		const detail = (await handler(
			{
				function: 'getWorkflow',
				headers: { projectId },
				pathParameters: { workflowId: created.id },
			},
			{},
		)) as GetWorkflowResponse;

		// Assert — root → child → grandchild → leaf 체인이 어셈블됐는지
		expect(detail.stepTree).not.toBeNull();
		expect(detail.stepTree?.schema.type).toBe('START');
		expect(detail.stepTree?.children).toHaveLength(1);
		const trigger = detail.stepTree?.children[0];
		expect(trigger?.schema.type).toBe('TRIGGER');
		expect(trigger?.condition).toEqual({ mediaType: ['IMAGE'] });
		const sync = trigger?.children[0];
		expect(sync?.schema.type).toBe('SYNC_TASK');
		const end = sync?.children[0];
		expect(end?.schema.type).toBe('END');
		expect(end?.children).toEqual([]);
	});

	it('ACTIVE 상태 워크플로우의 putWorkflowSteps는 InvalidArgumentException을 throw한다', async () => {
		// Arrange — DRAFT INSERT → 유효 트리 PUT → ACTIVE 전이
		const projectId = `playground-put-active-${Date.now()}`;
		const created = (await handler(
			{
				function: 'createWorkflow',
				data: { name: 'active-target' },
				headers: { projectId },
			},
			{},
		)) as { id: string };

		const SCHEMA_START = encodeOrThrow(1);
		const SCHEMA_END = encodeOrThrow(2);
		const SCHEMA_ASSET_CREATED = encodeOrThrow(4);
		const SCHEMA_SEND_EMAIL = encodeOrThrow(11);
		const validTree = {
			schemaId: SCHEMA_START,
			condition: {},
			children: [
				{
					schemaId: SCHEMA_ASSET_CREATED,
					condition: { mediaType: ['IMAGE'] },
					children: [
						{
							schemaId: SCHEMA_SEND_EMAIL,
							condition: {},
							children: [{ schemaId: SCHEMA_END, condition: {}, children: [] }],
						},
					],
				},
			],
		};

		await handler(
			{
				function: 'putWorkflowSteps',
				headers: { projectId },
				pathParameters: { workflowId: created.id },
				data: { stepTree: validTree },
			},
			{},
		);

		await handler(
			{
				function: 'updateWorkflow',
				headers: { projectId },
				pathParameters: { workflowId: created.id },
				data: { status: 'ACTIVE' },
			},
			{},
		);

		// Act & Assert — ACTIVE 상태에서 PUT 재시도는 거부
		await expect(
			handler(
				{
					function: 'putWorkflowSteps',
					headers: { projectId },
					pathParameters: { workflowId: created.id },
					data: { stepTree: validTree },
				},
				{},
			),
		).rejects.toBeInstanceOf(InvalidArgumentException);
	});

	it('deleteWorkflow 후 getWorkflow는 ResourceNotFoundException을 throw한다', async () => {
		// Arrange — 단건 INSERT
		const projectId = `playground-delete-${Date.now()}`;
		const created = (await handler(
			{
				function: 'createWorkflow',
				data: { name: 'delete-target' },
				headers: { projectId },
			},
			{},
		)) as { id: string };

		// Act — DELETE
		const deleteResult = await handler(
			{
				function: 'deleteWorkflow',
				headers: { projectId },
				pathParameters: { workflowId: created.id },
			},
			{},
		);

		// Assert — 204 시맨틱
		expect(deleteResult).toBeNull();

		// Act & Assert — 삭제 후 조회는 404
		await expect(
			handler(
				{
					function: 'getWorkflow',
					headers: { projectId },
					pathParameters: { workflowId: created.id },
				},
				{},
			),
		).rejects.toBeInstanceOf(ResourceNotFoundException);
	});
});
