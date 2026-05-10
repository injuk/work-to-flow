import { sql } from 'drizzle-orm';
import {
	boolean,
	datetime,
	foreignKey,
	index,
	int,
	mysqlTable,
	text,
	unique,
	varchar,
} from 'drizzle-orm/mysql-core';

export const Workflows = mysqlTable('Workflows', {
	Id: int('Id', { unsigned: true }).autoincrement().primaryKey(),
	ProjectId: varchar('ProjectId', { length: 50 }).notNull(),
	Name: varchar('Name', { length: 100 }).notNull(),
	Description: varchar('Description', { length: 1024 }),
	Status: varchar('Status', { length: 20 }).notNull().default('DRAFT'),
	CreatedAt: datetime('CreatedAt')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	UpdatedAt: datetime('UpdatedAt')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	CreatedById: varchar('CreatedById', { length: 100 }).notNull(),
});

export const WorkflowStepSchemas = mysqlTable(
	'WorkflowStepSchemas',
	{
		Id: int('Id', { unsigned: true }).autoincrement().primaryKey(),
		Name: varchar('Name', { length: 100 }).notNull(),
		Type: varchar('Type', { length: 20 }).notNull(),
		Condition: text('Condition').notNull(),
		IsHidden: boolean('IsHidden').notNull().default(false),
	},
	(t) => [unique('WorkflowStepSchemas_uq_1').on(t.Name)],
);

export const StepSchemaRelations = mysqlTable(
	'StepSchemaRelations',
	{
		Id: int('Id', { unsigned: true }).autoincrement().primaryKey(),
		FrontSchemaId: int('FrontSchemaId', { unsigned: true }).notNull(),
		RearSchemaId: int('RearSchemaId', { unsigned: true }).notNull(),
		Label: varchar('Label', { length: 100 }).notNull(),
	},
	(t) => [
		foreignKey({
			name: 'StepSchemaRelations_fk_1',
			columns: [t.FrontSchemaId],
			foreignColumns: [WorkflowStepSchemas.Id],
		}).onDelete('cascade'),
		foreignKey({
			name: 'StepSchemaRelations_fk_2',
			columns: [t.RearSchemaId],
			foreignColumns: [WorkflowStepSchemas.Id],
		}).onDelete('cascade'),
		unique('StepSchemaRelations_uq_1').on(t.FrontSchemaId, t.RearSchemaId),
	],
);

export const WorkflowSteps = mysqlTable(
	'WorkflowSteps',
	{
		Id: varchar('Id', { length: 24 }).notNull().primaryKey(),
		WorkflowId: int('WorkflowId', { unsigned: true }).notNull(),
		SchemaId: int('SchemaId', { unsigned: true }).notNull(),
		Condition: text('Condition').notNull(),
		ParentId: varchar('ParentId', { length: 24 }),
		Position: int('Position', { unsigned: true }).notNull().default(0),
	},
	(t) => [
		index('WorkflowSteps_idx_1').on(t.WorkflowId, t.Id),
		foreignKey({
			name: 'WorkflowSteps_fk_1',
			columns: [t.WorkflowId],
			foreignColumns: [Workflows.Id],
		}).onDelete('cascade'),
		foreignKey({
			name: 'WorkflowSteps_fk_2',
			columns: [t.SchemaId],
			foreignColumns: [WorkflowStepSchemas.Id],
		}),
		foreignKey({
			name: 'WorkflowSteps_fk_3',
			columns: [t.WorkflowId, t.ParentId],
			foreignColumns: [t.WorkflowId, t.Id],
		}).onDelete('cascade'),
		unique('WorkflowSteps_uq_1').on(t.WorkflowId, t.ParentId, t.Position),
	],
);

export const WorkflowExecutions = mysqlTable(
	'WorkflowExecutions',
	{
		Id: varchar('Id', { length: 36 }).notNull().primaryKey(),
		IdempotencyKey: varchar('IdempotencyKey', { length: 64 }).notNull(),
		WorkflowId: int('WorkflowId', { unsigned: true }).notNull(),
		Status: varchar('Status', { length: 50 }).notNull().default('RUNNING'),
		TotalStepCount: int('TotalStepCount', { unsigned: true }).notNull(),
		SuccessCount: int('SuccessCount', { unsigned: true }).notNull().default(0),
		CanceledCount: int('CanceledCount', { unsigned: true }).notNull().default(0),
		SkippedCount: int('SkippedCount', { unsigned: true }).notNull().default(0),
		FailureCount: int('FailureCount', { unsigned: true }).notNull().default(0),
		StartedAt: datetime('StartedAt')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
		UpdatedAt: datetime('UpdatedAt')
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
		CanceledAt: datetime('CanceledAt'),
		EndedAt: datetime('EndedAt'),
	},
	(t) => [
		foreignKey({
			name: 'WorkflowExecutions_fk_1',
			columns: [t.WorkflowId],
			foreignColumns: [Workflows.Id],
		}).onDelete('cascade'),
		unique('WorkflowExecutions_uq_1').on(t.IdempotencyKey),
	],
);

export const WorkflowStepExecutions = mysqlTable(
	'WorkflowStepExecutions',
	{
		Id: int('Id', { unsigned: true }).autoincrement().primaryKey(),
		ExecutionId: varchar('ExecutionId', { length: 36 }).notNull(),
		StepId: varchar('StepId', { length: 24 }).notNull(),
		Status: varchar('Status', { length: 50 }).notNull().default('READY'),
		Input: text('Input').notNull(),
		Output: text('Output').notNull(),
		StartedAt: datetime('StartedAt'),
		UpdatedAt: datetime('UpdatedAt'),
		EndedAt: datetime('EndedAt'),
	},
	(t) => [
		foreignKey({
			name: 'WorkflowStepExecutions_fk_1',
			columns: [t.ExecutionId],
			foreignColumns: [WorkflowExecutions.Id],
		}).onDelete('cascade'),
		foreignKey({
			name: 'WorkflowStepExecutions_fk_2',
			columns: [t.StepId],
			foreignColumns: [WorkflowSteps.Id],
		}).onDelete('cascade'),
		unique('WorkflowStepExecutions_uq_1').on(t.ExecutionId, t.StepId),
	],
);

export const WorkflowStartTriggers = mysqlTable(
	'WorkflowStartTriggers',
	{
		Id: int('Id', { unsigned: true }).autoincrement().primaryKey(),
		WorkflowId: int('WorkflowId', { unsigned: true }).notNull(),
		Key: varchar('Key', { length: 100 }).notNull(),
	},
	(t) => [
		foreignKey({
			name: 'WorkflowStartTriggers_fk_1',
			columns: [t.WorkflowId],
			foreignColumns: [Workflows.Id],
		}).onDelete('cascade'),
		unique('WorkflowStartTriggers_uq_1').on(t.WorkflowId),
	],
);

export const WorkflowResumeTriggers = mysqlTable(
	'WorkflowResumeTriggers',
	{
		Id: int('Id', { unsigned: true }).autoincrement().primaryKey(),
		StepExecutionId: int('StepExecutionId', { unsigned: true }).notNull(),
		Key: varchar('Key', { length: 100 }).notNull(),
	},
	(t) => [
		foreignKey({
			name: 'WorkflowResumeTriggers_fk_1',
			columns: [t.StepExecutionId],
			foreignColumns: [WorkflowStepExecutions.Id],
		}).onDelete('cascade'),
		unique('WorkflowResumeTriggers_uq_1').on(t.StepExecutionId),
	],
);
