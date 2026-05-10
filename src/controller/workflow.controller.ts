import type { BaseEvent } from '../core/lambda.router';
import { requireProjectId } from '../core/request';
import * as workflowService from '../service/workflow.service';
import { encodeOrThrow } from '../util/hashId';
import type {
	CreateWorkflowEvent,
	CreateWorkflowResponse,
	ListWorkflowsEvent,
	ListWorkflowsResponse,
} from './dto/workflow.dto';

const SYSTEM_USER_ID = 'System';

export const createAsync = async (
	event: BaseEvent,
	_context: unknown,
): Promise<CreateWorkflowResponse> => {
	const e = event as CreateWorkflowEvent;
	const projectId = requireProjectId(event);

	const { id } = await workflowService.createAsync(undefined, {
		projectId,
		name: e.data.name,
		description: e.data.description,
		createdById: SYSTEM_USER_ID,
	});

	return { id: encodeOrThrow(id) };
};

export const listAsync = async (
	event: BaseEvent,
	_context: unknown,
): Promise<ListWorkflowsResponse> => {
	const projectId = requireProjectId(event);
	const qs = (event as ListWorkflowsEvent).queryStringParameters ?? {};

	const { results, nextToken } = await workflowService.listAsync(
		undefined,
		{ projectId, status: qs.status },
		qs.nextToken ?? null,
		qs.limit ? Number(qs.limit) : undefined,
	);

	return {
		results: results.map((s) => ({ ...s, id: encodeOrThrow(s.id) })),
		nextToken,
	};
};
