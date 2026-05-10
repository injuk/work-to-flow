import { handler } from '../src/route';
import { db } from '../src/infrastructure/repository/db';

describe('playground', () => {
	let createdId: number;

	afterAll(async () => {
		await db.$client.end();
	});

	it('simpleCreate가 Workflows 테이블에 더미 데이터를 삽입한다', async () => {
		const result = (await handler(
			{ function: 'simpleCreate', data: { name: `playground-${Date.now()}` } },
			{},
		)) as { id: number };

		expect(typeof result.id).toBe('number');
		expect(result.id).toBeGreaterThan(0);

		createdId = result.id;
	});

	it('simpleGet이 방금 삽입한 Workflows row를 조회한다', async () => {
		const result = (await handler({ function: 'simpleGet', id: createdId }, {})) as {
			Id: number;
			ProjectId: string;
			Name: string;
			CreatedById: string;
		};

		expect(result.Id).toBe(createdId);
		expect(result.ProjectId).toBe('playground');
		expect(result.CreatedById).toBe('playground-user');
	});
});
