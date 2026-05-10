import { describe, expect, it } from '@jest/globals';

import { InvalidArgumentException, UncaughtException } from '../../../src/domain/exception';
import {
	assertRequestedStepTree,
	MAX_REQUESTED_STEP_TREE_DEPTH,
	type RequestedStepSchemaSummary,
} from '../../../src/domain/helper/validate-requested-step-tree';
import type { StepSchemaEdge } from '../../../src/domain/helper/validate-step-tree-relations';
import type { RequestedStep } from '../../../src/domain/type/workflow-step.model';

const SCHEMAS: RequestedStepSchemaSummary[] = [
	{ id: 1, name: 'START', type: 'START', isHidden: true, condition: '{}' },
	{ id: 2, name: 'END', type: 'END', isHidden: true, condition: '{}' },
	{ id: 3, name: 'TRIGGER', type: 'TRIGGER', isHidden: false, condition: '{}' },
	{
		id: 5,
		name: 'CHOICE',
		type: 'CHOICE',
		isHidden: false,
		condition: JSON.stringify({
			type: 'object',
			required: ['choice'],
			properties: { choice: { type: 'string' } },
		}),
	},
	{ id: 7, name: 'SYNC_TASK', type: 'SYNC_TASK', isHidden: false, condition: '{}' },
];

const RELATIONS: StepSchemaEdge[] = [
	{ frontSchemaId: 1, rearSchemaId: 3 }, // START -> TRIGGER
	{ frontSchemaId: 3, rearSchemaId: 5 }, // TRIGGER -> CHOICE
	{ frontSchemaId: 5, rearSchemaId: 7 }, // CHOICE -> SYNC_TASK
	{ frontSchemaId: 5, rearSchemaId: 2 }, // CHOICE -> END
	{ frontSchemaId: 7, rearSchemaId: 2 }, // SYNC_TASK -> END
	{ frontSchemaId: 1, rearSchemaId: 2 }, // START -> END (linear chain)
];

const leaf = (schemaId: number): RequestedStep => ({ schemaId, condition: {}, children: [] });
const inner = (
	schemaId: number,
	condition: Record<string, unknown>,
	children: RequestedStep[],
): RequestedStep => ({ schemaId, condition, children });

describe('assertRequestedStepTree', () => {
	it('정상 트리(START -> CHOICE -> SYNC_TASK -> END / END)는 통과한다', () => {
		const tree: RequestedStep = inner(1, {}, [
			inner(3, {}, [inner(5, { choice: 'A' }, [inner(7, {}, [leaf(2)]), leaf(2)])]),
		]);
		expect(() => assertRequestedStepTree(tree, SCHEMAS, RELATIONS)).not.toThrow();
	});

	it(`깊이 ${MAX_REQUESTED_STEP_TREE_DEPTH}는 통과하고 ${MAX_REQUESTED_STEP_TREE_DEPTH + 1}은 throw한다`, () => {
		// chain: START(1) -> TRIGGER(3) -> CHOICE(5) x (depth-3) -> END(2)
		// 필요한 relations: 1->3 (있음), 3->5 (있음), 5->5 (추가), 5->2 (있음)
		const longRelations: StepSchemaEdge[] = [...RELATIONS, { frontSchemaId: 5, rearSchemaId: 5 }];
		const buildChain = (depth: number): RequestedStep => {
			let cur: RequestedStep = leaf(2);
			for (let i = 0; i < depth - 3; i++) {
				cur = { schemaId: 5, condition: { choice: 'A' }, children: [cur] };
			}
			cur = { schemaId: 3, condition: {}, children: [cur] };
			return { schemaId: 1, condition: {}, children: [cur] };
		};
		expect(() =>
			assertRequestedStepTree(buildChain(MAX_REQUESTED_STEP_TREE_DEPTH), SCHEMAS, longRelations),
		).not.toThrow();
		expect(() =>
			assertRequestedStepTree(
				buildChain(MAX_REQUESTED_STEP_TREE_DEPTH + 1),
				SCHEMAS,
				longRelations,
			),
		).toThrow(InvalidArgumentException);
	});

	it('알 수 없는 schemaId면 UncaughtException', () => {
		const tree: RequestedStep = inner(1, {}, [leaf(999)]);
		expect(() => assertRequestedStepTree(tree, SCHEMAS, RELATIONS)).toThrow(UncaughtException);
	});

	it('relations에 없는 엣지면 InvalidArgumentException', () => {
		// START -> SYNC_TASK 직접 (1 -> 7 없음)
		const tree: RequestedStep = inner(1, {}, [inner(7, {}, [leaf(2)])]);
		expect(() => assertRequestedStepTree(tree, SCHEMAS, RELATIONS)).toThrow(
			InvalidArgumentException,
		);
	});

	it('CHOICE의 condition required 필드 누락이면 InvalidArgumentException', () => {
		// CHOICE는 { required: ["choice"] } 스키마. condition 빈 객체 → 실패
		const tree: RequestedStep = inner(1, {}, [inner(3, {}, [inner(5, {}, [leaf(2)])])]);
		expect(() => assertRequestedStepTree(tree, SCHEMAS, RELATIONS)).toThrow(
			InvalidArgumentException,
		);
	});

	it('root가 START가 아니면 integrity 단계에서 throw', () => {
		const tree: RequestedStep = inner(3, {}, [leaf(2)]);
		expect(() => assertRequestedStepTree(tree, SCHEMAS, RELATIONS)).toThrow(
			InvalidArgumentException,
		);
	});
});
