import { describe, expect, it } from '@jest/globals';

import { InvalidArgumentException } from '../../../src/domain/exception';
import { assertStepTreeIntegrity } from '../../../src/domain/helper/validate-step-tree-integrity';
import type { WorkflowStep } from '../../../src/domain/type/workflow-step.model';
import type { WorkflowStepSchemaType } from '../../../src/domain/type/workflow-step-schema.model';

const node = (
	id: string,
	type: WorkflowStepSchemaType,
	children: WorkflowStep[] = [],
): WorkflowStep => ({
	id,
	schema: { id: 1, name: type, type, isHidden: type === 'START' || type === 'END' },
	condition: {},
	children,
});

describe('assertStepTreeIntegrity', () => {
	it('root가 null이면 InvalidArgumentException을 throw한다', () => {
		expect(() => assertStepTreeIntegrity(null)).toThrow(InvalidArgumentException);
	});

	it('단일 노드가 END 스키마면 통과한다', () => {
		expect(() => assertStepTreeIntegrity(node('only', 'END'))).not.toThrow();
	});

	it('단일 노드가 START(leaf인데 END 아님)면 throw한다', () => {
		expect(() => assertStepTreeIntegrity(node('only', 'START'))).toThrow(InvalidArgumentException);
	});

	it('다층 트리의 모든 leaf가 END면 통과한다', () => {
		const tree = node('root', 'START', [
			node('t', 'TRIGGER', [node('c', 'CHOICE', [node('end-1', 'END'), node('end-2', 'END')])]),
		]);
		expect(() => assertStepTreeIntegrity(tree)).not.toThrow();
	});

	it('leaf 중 SYNC_TASK가 섞여 있으면 throw하고 메시지에 leaf id를 포함한다', () => {
		const tree = node('root', 'START', [
			node('c', 'CHOICE', [node('end-1', 'END'), node('leaf-bad', 'SYNC_TASK')]),
		]);
		try {
			assertStepTreeIntegrity(tree);
			throw new Error('expected to throw');
		} catch (e) {
			expect(e).toBeInstanceOf(InvalidArgumentException);
			expect((e as Error).message).toContain('leaf-bad');
			expect((e as Error).message).toContain('SYNC_TASK');
		}
	});
});
