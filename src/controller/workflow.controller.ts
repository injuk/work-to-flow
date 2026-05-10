import type { BaseEvent } from '../core/lambda.router';
import { requireProjectId } from '../core/request';
import * as workflowService from '../service/workflow.service';
import { encodeOrThrow } from '../util/hashId';
import type { CreateWorkflowEvent, CreateWorkflowResponse } from './dto/workflow.dto';

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
