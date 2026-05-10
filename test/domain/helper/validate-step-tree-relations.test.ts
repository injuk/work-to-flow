import { describe, expect, it } from '@jest/globals';

import { InvalidArgumentException } from '../../../src/domain/exception';
import {
	assertStepTreeRelations,
	type StepSchemaEdge,
} from '../../../src/domain/helper/validate-step-tree-relations';
import type { WorkflowStep } from '../../../src/domain/type/workflow-step.model';
import type { WorkflowStepSchemaType } from '../../../src/domain/type/workflow-step-schema.model';

interface NodeOpts {
	schemaId: number;
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
	condition: {},
	children,
});

describe('assertStepTreeRelations', () => {
	it('루트 단독(자식 없음)이면 relations와 무관하게 통과한다', () => {
		expect(() => assertStepTreeRelations(node('r', 'END', { schemaId: 2 }), [])).not.toThrow();
	});

	it('모든 (parent->child) 엣지가 relations에 있으면 통과한다', () => {
		// START(1) -> TRIGGER(3) -> END(2)
		const tree = node('r', 'START', { schemaId: 1 }, [
			node('t', 'TRIGGER', { schemaId: 3 }, [node('e', 'END', { schemaId: 2 })]),
		]);
		const relations: StepSchemaEdge[] = [
			{ frontSchemaId: 1, rearSchemaId: 3 },
			{ frontSchemaId: 3, rearSchemaId: 2 },
		];
		expect(() => assertStepTreeRelations(tree, relations)).not.toThrow();
	});

	it('한 엣지가 누락되면 throw하고 메시지에 부모 id와 schemaId를 포함한다', () => {
		// START(1) -> SYNC_TASK(7) — 그러나 relations에는 없음
		const tree = node('r', 'START', { schemaId: 1 }, [
			node('t', 'SYNC_TASK', { schemaId: 7 }, [node('e', 'END', { schemaId: 2 })]),
		]);
		const relations: StepSchemaEdge[] = [
			{ frontSchemaId: 1, rearSchemaId: 3 }, // 1->7 없음
			{ frontSchemaId: 7, rearSchemaId: 2 },
		];
		try {
			assertStepTreeRelations(tree, relations);
			throw new Error('expected to throw');
		} catch (e) {
			expect(e).toBeInstanceOf(InvalidArgumentException);
			expect((e as Error).message).toContain('parent=r');
			expect((e as Error).message).toContain('1');
			expect((e as Error).message).toContain('7');
		}
	});

	it('빈 relations + 자식이 있으면 첫 엣지에서 throw한다', () => {
		const tree = node('r', 'START', { schemaId: 1 }, [node('e', 'END', { schemaId: 2 })]);
		expect(() => assertStepTreeRelations(tree, [])).toThrow(InvalidArgumentException);
	});

	it('깊은 트리에서 중간 엣지 누락도 catch한다', () => {
		// START(1) -> CHOICE(4) -> [SYNC_TASK(8), END(2)]
		// CHOICE -> END 누락
		const tree = node('r', 'START', { schemaId: 1 }, [
			node('c', 'CHOICE', { schemaId: 4 }, [
				node('t', 'SYNC_TASK', { schemaId: 8 }, [node('e1', 'END', { schemaId: 2 })]),
				node('e2', 'END', { schemaId: 2 }),
			]),
		]);
		const relations: StepSchemaEdge[] = [
			{ frontSchemaId: 1, rearSchemaId: 4 },
			{ frontSchemaId: 4, rearSchemaId: 8 },
			{ frontSchemaId: 8, rearSchemaId: 2 },
			// 4 -> 2 누락
		];
		try {
			assertStepTreeRelations(tree, relations);
			throw new Error('expected to throw');
		} catch (e) {
			expect(e).toBeInstanceOf(InvalidArgumentException);
			expect((e as Error).message).toContain('parent=c');
		}
	});
});
