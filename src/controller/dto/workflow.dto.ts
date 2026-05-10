import type { BaseEvent } from '../../core/lambda.router';
import type { PublicModel } from '../../domain/type/common.model';
import type { Workflow, WorkflowStatus, WorkflowSummary } from '../../domain/type/workflow.model';

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

export interface GetWorkflowEvent extends BaseEvent {
	function: 'getWorkflow';
	pathParameters?: {
		workflowId?: string;
	};
}

export type GetWorkflowResponse = PublicModel<Workflow>;
