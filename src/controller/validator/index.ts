import type { z } from 'zod';

import {
	createWorkflowSchema,
	deleteWorkflowSchema,
	getWorkflowSchema,
	listWorkflowsSchema,
	updateWorkflowSchema,
} from './workflow.schema';
import { InvalidArgumentException } from '../../domain/exception';

const schemas: Record<string, z.ZodTypeAny> = {
	createWorkflow: createWorkflowSchema,
	listWorkflows: listWorkflowsSchema,
	getWorkflow: getWorkflowSchema,
	updateWorkflow: updateWorkflowSchema,
	deleteWorkflow: deleteWorkflowSchema,
};

export default class Validator {
	private readonly functionName: string;
	private readonly event: unknown;

	constructor(functionName: string, event: unknown) {
		this.functionName = functionName;
		this.event = event;
	}

	validate(): void {
		const schema = schemas[this.functionName];
		if (!schema) {
			return;
		}

		const result = schema.safeParse(this.event);
		if (!result.success) {
			throw new InvalidArgumentException(
				`validation failed for ${this.functionName}: ${result.error.message}`,
			);
		}
	}
}
