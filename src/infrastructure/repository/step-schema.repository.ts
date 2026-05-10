import { inArray } from 'drizzle-orm';

import { drizzleClient, schema, type Connection } from './db';

const { StepSchemaRelations, WorkflowStepSchemas } = schema;

export interface StepSchemaRelationRow {
	frontSchemaId: number;
	rearSchemaId: number;
}

export interface WorkflowStepSchemaRow {
	id: number;
	name: string;
	type: string;
	condition: string;
	isHidden: boolean;
}

export const listAllRelationsAsync = async (
	connection: Connection | null = null,
): Promise<StepSchemaRelationRow[]> => {
	return drizzleClient.executeQuery(async (client) => {
		return client
			.select({
				frontSchemaId: StepSchemaRelations.FrontSchemaId,
				rearSchemaId: StepSchemaRelations.RearSchemaId,
			})
			.from(StepSchemaRelations);
	}, connection);
};

export const listSchemasByIdsAsync = async (
	ids: number[],
	connection: Connection | null = null,
): Promise<WorkflowStepSchemaRow[]> => {
	if (ids.length === 0) {
		return [];
	}
	return drizzleClient.executeQuery(async (client) => {
		return client
			.select({
				id: WorkflowStepSchemas.Id,
				name: WorkflowStepSchemas.Name,
				type: WorkflowStepSchemas.Type,
				condition: WorkflowStepSchemas.Condition,
				isHidden: WorkflowStepSchemas.IsHidden,
			})
			.from(WorkflowStepSchemas)
			.where(inArray(WorkflowStepSchemas.Id, ids));
	}, connection);
};
