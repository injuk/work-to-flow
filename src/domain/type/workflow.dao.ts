import type { WorkflowStatus } from './workflow.model';

export interface CreateWorkflowEntity {
	projectId: string;
	name: string;
	description?: string;
	createdById: string;
}

export interface ListWorkflowsConditions {
	projectId: string;
	status?: WorkflowStatus;
}
