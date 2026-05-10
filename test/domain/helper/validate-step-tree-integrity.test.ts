import { describe, expect, it } from '@jest/globals';

import { InvalidArgumentException } from '../../../src/domain/exception';
import { assertStepTreeIntegrity } from '../../../src/domain/helper/validate-step-tree-integrity';
import type { WorkflowStep } from '../../../src/domain/type/workflow-step.model';
import type { WorkflowStepSchemaType } from '../../../src/domain/type/workflow-step-schema.model';

interface NodeOpts {
	schemaId?: number;
	isHidden?: boolean;
}

const node = (
	id: string,
	type: WorkflowStepSchemaType,
	children: WorkflowStep[] = [],
	opts: NodeOpts = {},
): WorkflowStep => ({
	id,
	schema: {
		id: opts.schemaId ?? 1,
		name: type,
		type,
		isHidden: opts.isHidden ?? (type === 'START' || type === 'END'),
	},
	condition: {},
	children,
});

describe('assertStepTreeIntegrity', () => {
	it('root가 null이면 InvalidArgumentException을 throw한다', () => {
		expect(() => assertStepTreeIntegrity(null)).toThrow(InvalidArgumentException);
	});

	it('root가 START가 아니면 throw하고 메시지에 root.id와 type을 포함한다', () => {
		try {
			assertStepTreeIntegrity(node('only', 'END'));
			throw new Error('expected to throw');
		} catch (e) {
			expect(e).toBeInstanceOf(InvalidArgumentException);
			expect((e as Error).message).toContain('only');
			expect((e as Error).message).toContain('END');
		}
	});

	it('root가 TRIGGER여도 START 아니므로 throw한다', () => {
		expect(() => assertStepTreeIntegrity(node('r', 'TRIGGER', [node('e', 'END')]))).toThrow(
			InvalidArgumentException,
		);
	});

	it('START → END 단순 트리(둘 다 isHidden=true)는 통과한다', () => {
		expect(() => assertStepTreeIntegrity(node('s', 'START', [node('e', 'END')]))).not.toThrow();
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

	it('START가 interior(루트 외)에 등장하면 throw한다', () => {
		const tree = node('root', 'START', [
			node('inner', 'START', [node('e', 'END')], { schemaId: 99 }),
		]);
		try {
			assertStepTreeIntegrity(tree);
			throw new Error('expected to throw');
		} catch (e) {
			expect(e).toBeInstanceOf(InvalidArgumentException);
			expect((e as Error).message).toContain('inner');
			expect((e as Error).message).toContain('START');
		}
	});

	it('END에 children이 있으면 throw한다', () => {
		const tree = node('root', 'START', [node('e', 'END', [node('extra', 'END')])]);
		expect(() => assertStepTreeIntegrity(tree)).toThrow(InvalidArgumentException);
	});

	it('START의 isHidden이 false면 throw한다', () => {
		const tree = node('root', 'START', [node('e', 'END')], { isHidden: false });
		try {
			assertStepTreeIntegrity(tree);
			throw new Error('expected to throw');
		} catch (e) {
			expect(e).toBeInstanceOf(InvalidArgumentException);
			expect((e as Error).message).toContain('isHidden=true');
		}
	});

	it('END의 isHidden이 false면 throw한다', () => {
		const tree = node('root', 'START', [node('e', 'END', [], { isHidden: false })]);
		expect(() => assertStepTreeIntegrity(tree)).toThrow(InvalidArgumentException);
	});

	it('동일 step id가 두 번 등장하면 throw한다', () => {
		const dup = node('dup', 'END');
		const tree = node('root', 'START', [node('c', 'CHOICE', [dup, dup])]);
		try {
			assertStepTreeIntegrity(tree);
			throw new Error('expected to throw');
		} catch (e) {
			expect(e).toBeInstanceOf(InvalidArgumentException);
			expect((e as Error).message).toContain('dup');
		}
	});
});
