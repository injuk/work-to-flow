import { eq } from 'drizzle-orm';

import { drizzleClient, schema, type Connection } from './db';

const { Workflows } = schema;

export type WorkflowRow = typeof Workflows.$inferSelect;

export interface CreateWorkflowEntity {
	ProjectId: string;
	Name: string;
	CreatedById: string;
	Description?: string | null;
}

export const createAsync = async (
	entity: CreateWorkflowEntity,
	connection: Connection | null = null,
): Promise<number> => {
	return drizzleClient.executeQuery(async (client) => {
		const [header] = await client.insert(Workflows).values(entity);
		return header.insertId;
	}, connection);
};

export const getAsync = async (
	id: number,
	connection: Connection | null = null,
): Promise<WorkflowRow | null> => {
	return drizzleClient.executeQuery(async (client) => {
		const rows = await client.select().from(Workflows).where(eq(Workflows.Id, id)).limit(1);
		return rows[0] ?? null;
	}, connection);
};
