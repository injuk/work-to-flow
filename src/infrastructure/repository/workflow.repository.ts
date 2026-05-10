import { and, desc, eq } from 'drizzle-orm';

import { drizzleClient, schema, type Connection } from './db';
import type {
	CreateWorkflowEntity,
	ListWorkflowsConditions,
	UpdateWorkflowEntity,
} from '../../domain/type/workflow.dao';

const { Workflows, WorkflowSteps, WorkflowStepSchemas } = schema;

export type WorkflowRow = typeof Workflows.$inferSelect;

export interface ListWorkflowsSearch extends ListWorkflowsConditions {
	offset: number;
	limit: number;
}

export interface StepWithSchemaRow {
	id: string;
	parentId: string | null;
	position: number;
	condition: string;
	schemaId: number;
	schemaName: string;
	schemaType: string;
	schemaIsHidden: boolean;
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

export const listStepsByWorkflowAsync = async (
	workflowId: number,
	connection: Connection | null = null,
): Promise<StepWithSchemaRow[]> => {
	return drizzleClient.executeQuery(async (client) => {
		return client
			.select({
				id: WorkflowSteps.Id,
				parentId: WorkflowSteps.ParentId,
				position: WorkflowSteps.Position,
				condition: WorkflowSteps.Condition,
				schemaId: WorkflowStepSchemas.Id,
				schemaName: WorkflowStepSchemas.Name,
				schemaType: WorkflowStepSchemas.Type,
				schemaIsHidden: WorkflowStepSchemas.IsHidden,
			})
			.from(WorkflowSteps)
			.innerJoin(WorkflowStepSchemas, eq(WorkflowSteps.SchemaId, WorkflowStepSchemas.Id))
			.where(eq(WorkflowSteps.WorkflowId, workflowId));
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

export const updateAsync = async (
	id: number,
	patch: UpdateWorkflowEntity,
	connection: Connection | null = null,
): Promise<{ affectedRows: number }> => {
	return drizzleClient.executeQuery(async (client) => {
		const set: Record<string, unknown> = { UpdatedAt: new Date() };
		if (patch.name !== undefined) set.Name = patch.name;
		if (patch.description !== undefined) set.Description = patch.description;
		if (patch.status !== undefined) set.Status = patch.status;

		const [header] = await client.update(Workflows).set(set).where(eq(Workflows.Id, id));
		return { affectedRows: header.affectedRows };
	}, connection);
};

export const deleteAsync = async (
	id: number,
	connection: Connection | null = null,
): Promise<{ affectedRows: number }> => {
	return drizzleClient.executeQuery(async (client) => {
		const [header] = await client.delete(Workflows).where(eq(Workflows.Id, id));
		return { affectedRows: header.affectedRows };
	}, connection);
};
