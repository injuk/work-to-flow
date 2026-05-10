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
