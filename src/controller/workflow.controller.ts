import type { BaseEvent } from '../core/lambda.router';
import { requireProjectId } from '../core/request';
import { InvalidArgumentException } from '../domain/exception';
import * as workflowService from '../service/workflow.service';
import { decodeOrThrow, encodeOrThrow } from '../util/hashId';
import type {
	CreateWorkflowEvent,
	CreateWorkflowResponse,
	DeleteWorkflowEvent,
	DeleteWorkflowResponse,
	GetWorkflowEvent,
	GetWorkflowResponse,
	ListWorkflowsEvent,
	ListWorkflowsResponse,
	UpdateWorkflowEvent,
	UpdateWorkflowResponse,
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

export const getAsync = async (
	event: BaseEvent,
	_context: unknown,
): Promise<GetWorkflowResponse> => {
	const projectId = requireProjectId(event);
	const rawId = (event as GetWorkflowEvent).pathParameters?.workflowId;
	if (!rawId) {
		throw new InvalidArgumentException('workflowId is required');
	}
	const id = decodeOrThrow(rawId);

	const workflow = await workflowService.getAsync(undefined, { id, projectId });

	return { ...workflow, id: encodeOrThrow(workflow.id) };
};

export const updateAsync = async (
	event: BaseEvent,
	_context: unknown,
): Promise<UpdateWorkflowResponse> => {
	const e = event as UpdateWorkflowEvent;
	const projectId = requireProjectId(event);
	const rawId = e.pathParameters?.workflowId;
	if (!rawId) {
		throw new InvalidArgumentException('workflowId is required');
	}
	const id = decodeOrThrow(rawId);

	await workflowService.updateAsync(undefined, { id, projectId, data: e.data });

	return null;
};

export const deleteAsync = async (
	event: BaseEvent,
	_context: unknown,
): Promise<DeleteWorkflowResponse> => {
	const e = event as DeleteWorkflowEvent;
	const projectId = requireProjectId(event);
	const rawId = e.pathParameters?.workflowId;
	if (!rawId) {
		throw new InvalidArgumentException('workflowId is required');
	}
	const id = decodeOrThrow(rawId);

	await workflowService.deleteAsync(undefined, { id, projectId });

	return null;
};
