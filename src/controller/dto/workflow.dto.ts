import type { BaseEvent } from '../../core/lambda.router';

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
