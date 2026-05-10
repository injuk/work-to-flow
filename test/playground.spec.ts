import { handler } from '../src/route';
import { db } from '../src/infrastructure/repository/db';

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
});
