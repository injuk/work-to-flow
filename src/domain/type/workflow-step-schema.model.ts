export type WorkflowStepSchemaType =
	| 'START'
	| 'TRIGGER'
	| 'CHOICE'
	| 'SYNC_TASK'
	| 'ASYNC_TASK'
	| 'END';

export type StepCondition = Record<string, unknown>;

export interface WorkflowStepSchema {
	id: number;
	name: string;
	type: WorkflowStepSchemaType;
	condition: StepCondition;
	isHidden: boolean;
}

export type WorkflowStepSchemaSummary = Omit<WorkflowStepSchema, 'condition'>;
