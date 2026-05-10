import Ajv, { type ValidateFunction } from 'ajv';

import { InvalidArgumentException, UncaughtException } from '../exception';
import type { WorkflowStep } from '../type/workflow-step.model';

export interface StepConditionSchema {
	id: number;
	condition: string;
}

export const assertStepTreeConditions = (
	root: WorkflowStep,
	schemas: ReadonlyArray<StepConditionSchema>,
): void => {
	const ajv = new Ajv({ strict: false });
	const validators = compileValidators(ajv, schemas);
	visit(root, validators);
};

const compileValidators = (
	ajv: Ajv,
	schemas: ReadonlyArray<StepConditionSchema>,
): Map<number, ValidateFunction> => {
	const map = new Map<number, ValidateFunction>();
	for (const s of schemas) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(s.condition);
		} catch {
			throw new UncaughtException(
				`WorkflowStepSchema(${s.id}) has invalid JSON Schema (parse error)`,
			);
		}
		let validator: ValidateFunction;
		try {
			validator = ajv.compile(parsed as object);
		} catch (e) {
			throw new UncaughtException(
				`WorkflowStepSchema(${s.id}) JSON Schema compilation failed: ${(e as Error).message}`,
			);
		}
		map.set(s.id, validator);
	}
	return map;
};

const visit = (node: WorkflowStep, validators: Map<number, ValidateFunction>): void => {
	const validator = validators.get(node.schema.id);
	if (!validator) {
		throw new UncaughtException(
			`Workflow step(${node.id}) references unknown schema id=${node.schema.id}`,
		);
	}
	if (!validator(node.condition)) {
		const first = validator.errors?.[0];
		const detail = first ? `${first.instancePath || '/'} ${first.message ?? ''}`.trim() : 'unknown';
		throw new InvalidArgumentException(
			`Workflow step(${node.id}) condition does not satisfy schema id=${node.schema.id}: ${detail}`,
		);
	}
	for (const child of node.children) {
		visit(child, validators);
	}
};
