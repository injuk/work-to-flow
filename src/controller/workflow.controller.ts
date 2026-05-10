import type { BaseEvent } from '../core/lambda.router';
import * as workflowService from '../service/workflow.service';

interface SimpleCreateEvent extends BaseEvent {
	function: 'simpleCreate';
	data?: { name?: string };
}

interface SimpleGetEvent extends BaseEvent {
	function: 'simpleGet';
	id: number;
}

export const simpleCreateAsync = async (event: BaseEvent, _context: unknown) => {
	const e = event as SimpleCreateEvent;
	return workflowService.simpleCreateAsync(undefined, { name: e.data?.name });
};

export const simpleGetAsync = async (event: BaseEvent, _context: unknown) => {
	const e = event as SimpleGetEvent;
	return workflowService.simpleGetAsync(undefined, { id: e.id });
};
