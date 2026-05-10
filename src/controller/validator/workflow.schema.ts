import { z } from 'zod';

export const createWorkflowSchema = z
	.object({
		function: z.literal('createWorkflow'),
		data: z.object({
			name: z.string().trim().min(1).max(100),
			description: z.string().trim().max(1024).optional(),
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
				status: z.enum(['INACTIVE', 'ACTIVE', 'DRAFT']).optional(),
			})
			.partial()
			.optional(),
	})
	.passthrough();
