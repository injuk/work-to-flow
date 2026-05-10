import type { Nullable, SimpleActioned } from './common.model';
import type { WorkflowStepSchemaSummary } from './workflow-step-schema.model';

export type WorkflowStepExecutionStatus =
	| 'READY'
	| 'RUNNING'
	| 'SUSPENDED'
	| 'CANCELED'
	| 'FAILED'
	| 'COMPLETED'
	| 'SKIPPED';

export type WorkflowExecutionStatus =
	| 'RUNNING'
	| 'PARTIAL_FAILED'
	| 'FAILED'
	| 'COMPLETED'
	| 'CANCELED'
	| 'EXPIRED';

export interface WorkflowStepExecution {
	id: number;
	schema: WorkflowStepSchemaSummary;
	status: WorkflowStepExecutionStatus;
	children: WorkflowStepExecution[];
	started: Nullable<SimpleActioned>;
	updated: Nullable<SimpleActioned>;
	ended: Nullable<SimpleActioned>;
}

export interface WorkflowExecutionSummary {
	id: string;
	workflow: { id: number };
	status: WorkflowExecutionStatus;
	started: SimpleActioned;
	updated: SimpleActioned;
	canceled: Nullable<SimpleActioned>;
	ended: Nullable<SimpleActioned>;
}

export interface WorkflowExecutionAggregate {
	totalStepCount: number;
	successCount: number;
	canceledCount: number;
	skippedCount: number;
	failureCount: number;
}

export interface WorkflowExecution {
	id: string;
	workflow: { id: number };
	status: WorkflowExecutionStatus;
	summary: WorkflowExecutionAggregate;
	stepExecutionTree: WorkflowStepExecution;
	started: SimpleActioned;
	updated: SimpleActioned;
	canceled: Nullable<SimpleActioned>;
	ended: Nullable<SimpleActioned>;
}
