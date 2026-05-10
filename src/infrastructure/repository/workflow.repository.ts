import { and, desc, eq } from 'drizzle-orm';

import { drizzleClient, schema, type Connection } from './db';
import type { CreateWorkflowEntity, ListWorkflowsConditions } from '../../domain/type/workflow.dao';

const { Workflows } = schema;

export type WorkflowRow = typeof Workflows.$inferSelect;

export interface ListWorkflowsSearch extends ListWorkflowsConditions {
	offset: number;
	limit: number;
}

export const createAsync = async (
	entity: CreateWorkflowEntity,
	connection: Connection | null = null,
): Promise<number> => {
	return drizzleClient.executeQuery(async (client) => {
		const [header] = await client.insert(Workflows).values({
			ProjectId: entity.projectId,
			Name: entity.name,
			Description: entity.description ?? null,
			CreatedById: entity.createdById,
		});
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

export const listAsync = async (
	search: ListWorkflowsSearch,
	connection: Connection | null = null,
): Promise<WorkflowRow[]> => {
	return drizzleClient.executeQuery(async (client) => {
		const where = [eq(Workflows.ProjectId, search.projectId)];
		if (search.status) {
			where.push(eq(Workflows.Status, search.status));
		}

		return client
			.select()
			.from(Workflows)
			.where(and(...where))
			.orderBy(desc(Workflows.CreatedAt))
			.limit(search.limit)
			.offset(search.offset);
	}, connection);
};
