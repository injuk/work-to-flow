import type { BaseEvent } from '../../core/lambda.router';
import type { PublicModel } from '../../domain/type/common.model';
import type { WorkflowStatus, WorkflowSummary } from '../../domain/type/workflow.model';

export interface CreateWorkflowEvent extends BaseEvent {
	function: 'createWorkflow';
	data: {
		name: string;
		description?: string;
	};
}

export interface CreateWorkflowResponse {
	id: string;
}

export interface ListWorkflowsEvent extends BaseEvent {
	function: 'listWorkflows';
	queryStringParameters?: {
		nextToken?: string;
		limit?: string;
		status?: WorkflowStatus;
	};
}

export interface ListWorkflowsResponse {
	results: PublicModel<WorkflowSummary>[];
	nextToken: string | null;
}
