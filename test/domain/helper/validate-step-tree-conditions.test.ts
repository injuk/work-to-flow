import { describe, expect, it } from '@jest/globals';

import { InvalidArgumentException, UncaughtException } from '../../../src/domain/exception';
import {
	assertStepTreeConditions,
	type StepConditionSchema,
} from '../../../src/domain/helper/validate-step-tree-conditions';
import type { WorkflowStep } from '../../../src/domain/type/workflow-step.model';
import type {
	StepCondition,
	WorkflowStepSchemaType,
} from '../../../src/domain/type/workflow-step-schema.model';

interface NodeOpts {
	schemaId: number;
	condition?: StepCondition;
}

const node = (
	id: string,
	type: WorkflowStepSchemaType,
	opts: NodeOpts,
	children: WorkflowStep[] = [],
): WorkflowStep => ({
	id,
	schema: {
		id: opts.schemaId,
		name: type,
		type,
		isHidden: type === 'START' || type === 'END',
	},
	condition: opts.condition ?? {},
	children,
});

describe('assertStepTreeConditions', () => {
	it('빈 스키마 "{}"는 어떤 condition도 통과시킨다', () => {
		const schemas: StepConditionSchema[] = [
			{ id: 1, condition: '{}' },
			{ id: 2, condition: '{}' },
		];
		const tree = node('r', 'START', { schemaId: 1 }, [
			node('e', 'END', { schemaId: 2, condition: { anything: true } }),
		]);
		expect(() => assertStepTreeConditions(tree, schemas)).not.toThrow();
	});

	it('required 필드가 빠지면 InvalidArgumentException이 throw된다', () => {
		const schemas: StepConditionSchema[] = [
			{ id: 1, condition: '{}' },
			{
				id: 5,
				condition: JSON.stringify({
					type: 'object',
					required: ['choice'],
					properties: { choice: { type: 'string' } },
				}),
			},
		];
		const tree = node('r', 'START', { schemaId: 1 }, [
			node('c', 'CHOICE', { schemaId: 5, condition: {} }),
		]);
		try {
			assertStepTreeConditions(tree, schemas);
			throw new Error('expected to throw');
		} catch (e) {
			expect(e).toBeInstanceOf(InvalidArgumentException);
			expect((e as Error).message).toContain('schema id=5');
			expect((e as Error).message).toContain('c');
		}
	});

	it('필수 필드가 채워져 있으면 통과한다', () => {
		const schemas: StepConditionSchema[] = [
			{ id: 1, condition: '{}' },
			{
				id: 5,
				condition: JSON.stringify({
					type: 'object',
					required: ['choice'],
					properties: { choice: { type: 'string' } },
				}),
			},
		];
		const tree = node('r', 'START', { schemaId: 1 }, [
			node('c', 'CHOICE', { schemaId: 5, condition: { choice: 'A' } }),
		]);
		expect(() => assertStepTreeConditions(tree, schemas)).not.toThrow();
	});

	it('트리에 등장한 schemaId가 schemas에 없으면 UncaughtException', () => {
		const schemas: StepConditionSchema[] = [{ id: 1, condition: '{}' }];
		const tree = node('r', 'START', { schemaId: 1 }, [node('e', 'END', { schemaId: 99 })]);
		expect(() => assertStepTreeConditions(tree, schemas)).toThrow(UncaughtException);
	});

	it('JSON Schema 자체가 파싱 불가하면 UncaughtException', () => {
		const schemas: StepConditionSchema[] = [{ id: 1, condition: '{not-json' }];
		const tree = node('r', 'START', { schemaId: 1 });
		expect(() => assertStepTreeConditions(tree, schemas)).toThrow(UncaughtException);
	});

	it('JSON Schema 형식이 잘못되어 컴파일 실패하면 UncaughtException', () => {
		// type 값이 문자열이어야 하는데 숫자
		const schemas: StepConditionSchema[] = [{ id: 1, condition: JSON.stringify({ type: 123 }) }];
		const tree = node('r', 'START', { schemaId: 1 });
		expect(() => assertStepTreeConditions(tree, schemas)).toThrow(UncaughtException);
	});
});
