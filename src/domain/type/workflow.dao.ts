import type { RequestedStep } from './workflow-step.model';
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

export interface GetWorkflowConditions {
	id: number;
	projectId: string;
}

export interface UpdateWorkflowEntity {
	name?: string;
	description?: string | null;
	status?: WorkflowStatus;
}

export interface UpdateWorkflowConditions {
	id: number;
	projectId: string;
	data: UpdateWorkflowEntity;
}

export interface DeleteWorkflowConditions {
	id: number;
	projectId: string;
}

export interface PutWorkflowStepsConditions {
	id: number;
	projectId: string;
	root: RequestedStep;
}
