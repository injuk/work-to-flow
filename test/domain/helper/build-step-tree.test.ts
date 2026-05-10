import { describe, expect, it } from '@jest/globals';

import { UncaughtException } from '../../../src/domain/exception';
import { buildStepTree } from '../../../src/domain/helper/build-step-tree';
import type { StepWithSchemaRow } from '../../../src/infrastructure/repository/workflow.repository';

const baseRow = (overrides: Partial<StepWithSchemaRow>): StepWithSchemaRow => ({
	id: 'unset',
	parentId: null,
	position: 0,
	condition: '{}',
	schemaId: 1,
	schemaName: 'START',
	schemaType: 'START',
	schemaIsHidden: true,
	...overrides,
});

describe('buildStepTree', () => {
	it('빈 배열을 받으면 null을 반환한다', () => {
		expect(buildStepTree([])).toBeNull();
	});

	it('자식 없는 단일 루트만 있으면 children=[]인 트리를 반환한다', () => {
		// Arrange
		const rows: StepWithSchemaRow[] = [baseRow({ id: 'root' })];

		// Act
		const tree = buildStepTree(rows);

		// Assert
		expect(tree).not.toBeNull();
		expect(tree?.id).toBe('root');
		expect(tree?.children).toEqual([]);
		expect(tree?.schema).toEqual({ id: 1, name: 'START', type: 'START', isHidden: true });
	});

	it('형제 자식들을 Position 오름차순으로 정렬한다', () => {
		// Arrange — 일부러 역순으로 입력
		const rows: StepWithSchemaRow[] = [
			baseRow({ id: 'root' }),
			baseRow({
				id: 'b',
				parentId: 'root',
				position: 2,
				schemaId: 3,
				schemaName: 'TASK_B',
				schemaType: 'SYNC_TASK',
				schemaIsHidden: false,
			}),
			baseRow({
				id: 'a',
				parentId: 'root',
				position: 1,
				schemaId: 2,
				schemaName: 'TASK_A',
				schemaType: 'SYNC_TASK',
				schemaIsHidden: false,
			}),
		];

		// Act
		const tree = buildStepTree(rows);

		// Assert
		expect(tree?.children.map((c) => c.id)).toEqual(['a', 'b']);
	});

	it('깊이 3 트리(root → mid → leaf)를 정상 어셈블한다', () => {
		// Arrange
		const rows: StepWithSchemaRow[] = [
			baseRow({ id: 'root' }),
			baseRow({ id: 'mid', parentId: 'root', schemaName: 'CHOICE', schemaType: 'CHOICE' }),
			baseRow({ id: 'leaf', parentId: 'mid', schemaName: 'END', schemaType: 'END' }),
		];

		// Act
		const tree = buildStepTree(rows);

		// Assert
		expect(tree?.id).toBe('root');
		expect(tree?.children[0]?.id).toBe('mid');
		expect(tree?.children[0]?.children[0]?.id).toBe('leaf');
	});

	it('condition JSON을 파싱하여 객체로 노출한다', () => {
		// Arrange
		const rows: StepWithSchemaRow[] = [baseRow({ id: 'root', condition: '{"k":"v"}' })];

		// Act
		const tree = buildStepTree(rows);

		// Assert
		expect(tree?.condition).toEqual({ k: 'v' });
	});

	it('루트(parentId=null)가 두 개 이상이면 UncaughtException을 throw한다', () => {
		// Arrange
		const rows: StepWithSchemaRow[] = [baseRow({ id: 'r1' }), baseRow({ id: 'r2' })];

		// Act & Assert
		expect(() => buildStepTree(rows)).toThrow(UncaughtException);
	});

	it('루트가 0개(모든 row가 parentId 보유)이면 UncaughtException을 throw한다', () => {
		// Arrange — 부모가 자기 자신/존재하지 않는 ghost를 가리키는 비정상 데이터
		const rows: StepWithSchemaRow[] = [
			baseRow({ id: 'a', parentId: 'b' }),
			baseRow({ id: 'b', parentId: 'a' }),
		];

		// Act & Assert
		expect(() => buildStepTree(rows)).toThrow(UncaughtException);
	});

	it('잘못된 condition JSON을 만나면 UncaughtException을 throw한다', () => {
		// Arrange
		const rows: StepWithSchemaRow[] = [baseRow({ id: 'root', condition: '{not-json}' })];

		// Act & Assert
		expect(() => buildStepTree(rows)).toThrow(UncaughtException);
	});
});
