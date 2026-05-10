import { handler } from '../src/route';
import { db } from '../src/infrastructure/repository/db';
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
});
