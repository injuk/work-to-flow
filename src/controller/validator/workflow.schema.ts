import { z } from 'zod';

import type { WorkflowStatus } from '../../domain/type/workflow.model';
import type { RequestedStepInput } from '../dto/workflow.dto';

const workflowStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'INACTIVE'] as const satisfies readonly [
	WorkflowStatus,
	...WorkflowStatus[],
]);

export const createWorkflowSchema = z
	.object({
		function: z.literal('createWorkflow'),
		data: z.object({
			name: z.string().trim().min(1).max(100),
			description: z.string().trim().max(1024).optional(),
		}),
	})
	.passthrough();

export const getWorkflowSchema = z
	.object({
		function: z.literal('getWorkflow'),
		pathParameters: z.object({
			workflowId: z.string().min(1),
		}),
	})
	.passthrough();

export const listWorkflowsSchema = z
	.object({
		function: z.literal('listWorkflows'),
		queryStringParameters: z
			.object({
				nextToken: z.string().min(1).optional(),
				limit: z
					.union([z.string(), z.number()])
					.transform((v) => Number(v))
					.pipe(z.number().int().positive().max(200))
					.optional(),
				status: workflowStatusEnum.optional(),
			})
			.partial()
			.optional(),
	})
	.passthrough();

const updateWorkflowDataSchema = z
	.object({
		name: z.string().trim().min(1).max(100).optional(),
		description: z
			.string()
			.max(1024)
			.transform((s) => {
				const t = s.trim();
				return t === '' ? null : t;
			})
			.optional(),
		status: workflowStatusEnum.optional(),
	})
	.refine((d) => d.name !== undefined || d.description !== undefined || d.status !== undefined, {
		message: 'at least one of name|description|status is required',
	});

export const updateWorkflowSchema = z
	.object({
		function: z.literal('updateWorkflow'),
		pathParameters: z.object({
			workflowId: z.string().min(1),
		}),
		data: updateWorkflowDataSchema,
	})
	.passthrough();

export const deleteWorkflowSchema = z
	.object({
		function: z.literal('deleteWorkflow'),
		pathParameters: z.object({
			workflowId: z.string().min(1),
		}),
	})
	.passthrough();

const requestedStepInputSchema: z.ZodType<RequestedStepInput> = z.lazy(() =>
	z.object({
		schemaId: z.string().min(1),
		condition: z.record(z.string(), z.unknown()),
		children: z.array(requestedStepInputSchema),
	}),
);

export const putWorkflowStepsSchema = z
	.object({
		function: z.literal('putWorkflowSteps'),
		pathParameters: z.object({
			workflowId: z.string().min(1),
		}),
		data: z.object({
			stepTree: requestedStepInputSchema,
		}),
	})
	.passthrough();
