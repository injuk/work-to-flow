import type { Actioned, Nullable, Project, SimpleActioned } from './common.model';
import type { WorkflowStep } from './workflow-step.model';

export type WorkflowStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export interface Workflow {
	id: number;
	project: Project;
	name: string;
	description: Nullable<string>;
	status: WorkflowStatus;
	stepTree: WorkflowStep | null;
	created: Actioned;
	updated: SimpleActioned;
}

export type WorkflowSummary = Omit<Workflow, 'description' | 'stepTree'>;
