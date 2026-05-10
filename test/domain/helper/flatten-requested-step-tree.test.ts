import { describe, expect, it } from '@jest/globals';

import { flattenRequestedStepTree } from '../../../src/domain/helper/flatten-requested-step-tree';
import type { RequestedStep } from '../../../src/domain/type/workflow-step.model';

const node = (
	schemaId: number,
	condition: Record<string, unknown>,
	children: RequestedStep[] = [],
): RequestedStep => ({
	schemaId,
	condition,
	children,
});

describe('flattenRequestedStepTree', () => {
	it('단일 노드는 1행으로 평탄화되며 parentId=null, position=0이다', () => {
		// Arrange
		const root = node(1, {});

		// Act
		const rows = flattenRequestedStepTree(root, 100);

		// Assert
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			workflowId: 100,
			schemaId: 1,
			parentId: null,
			position: 0,
			condition: '{}',
		});
		expect(typeof rows[0]?.id).toBe('string');
		expect(rows[0]?.id.length).toBeGreaterThan(0);
	});

	it('자식 row의 parentId는 부모 row의 id와 일치한다', () => {
		// Arrange
		const root = node(1, {}, [node(2, {})]);

		// Act
		const rows = flattenRequestedStepTree(root, 100);

		// Assert
		expect(rows).toHaveLength(2);
		const [parent, child] = rows;
		expect(child?.parentId).toBe(parent?.id);
		expect(child?.position).toBe(0);
	});

	it('형제 노드 3개에 position 0/1/2가 부여된다', () => {
		// Arrange
		const root = node(1, {}, [node(2, {}), node(3, {}), node(4, {})]);

		// Act
		const rows = flattenRequestedStepTree(root, 100);

		// Assert
		expect(rows).toHaveLength(4);
		const children = rows.slice(1);
		expect(children.map((r) => r.schemaId)).toEqual([2, 3, 4]);
		expect(children.map((r) => r.position)).toEqual([0, 1, 2]);
		const rootId = rows[0]?.id;
		expect(children.every((r) => r.parentId === rootId)).toBe(true);
	});

	it('깊이 3 트리의 parent 체인이 올바르게 연결된다', () => {
		// Arrange
		const root = node(1, {}, [node(2, {}, [node(3, {})])]);

		// Act
		const rows = flattenRequestedStepTree(root, 100);

		// Assert
		expect(rows).toHaveLength(3);
		const [r0, r1, r2] = rows;
		expect(r0?.parentId).toBeNull();
		expect(r1?.parentId).toBe(r0?.id);
		expect(r2?.parentId).toBe(r1?.id);
	});

	it('condition은 JSON.stringify로 직렬화되어 row.condition에 들어간다', () => {
		// Arrange
		const root = node(1, { foo: 'bar', n: 42 });

		// Act
		const rows = flattenRequestedStepTree(root, 100);

		// Assert
		expect(rows[0]?.condition).toBe(JSON.stringify({ foo: 'bar', n: 42 }));
	});

	it('모든 row의 workflowId는 입력값과 동일하다', () => {
		// Arrange
		const root = node(1, {}, [node(2, {}), node(3, {}, [node(4, {})])]);

		// Act
		const rows = flattenRequestedStepTree(root, 999);

		// Assert
		expect(rows.every((r) => r.workflowId === 999)).toBe(true);
	});
});
