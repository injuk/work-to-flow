import type { StepCondition, WorkflowStepSchemaSummary } from './workflow-step-schema.model';

export interface WorkflowStep {
	id: string;
	schema: WorkflowStepSchemaSummary;
	condition: StepCondition;
	children: WorkflowStep[];
}

export interface RequestedStep {
	schemaId: number;
	condition: StepCondition;
	children: RequestedStep[];
}
