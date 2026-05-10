import type { z } from 'zod';

import { InvalidArgumentException } from '../../domain/exception';

// 엔드포인트별 스키마는 Phase B 이후 각 *.schema.ts에서 import 후 spread로 합친다.
// 예: import { workflowSchemas } from './workflow.schema';
//     const schemas = { ...workflowSchemas };
const schemas: Record<string, z.ZodTypeAny> = {};

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
