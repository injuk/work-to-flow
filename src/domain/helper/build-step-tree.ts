import type { StepWithSchemaRow } from '../../infrastructure/repository/workflow.repository';
import { UncaughtException } from '../exception';
import type { StepCondition, WorkflowStepSchemaType } from '../type/workflow-step-schema.model';
import type { WorkflowStep } from '../type/workflow-step.model';

export const buildStepTree = (rows: StepWithSchemaRow[]): WorkflowStep | null => {
	if (rows.length === 0) {
		return null;
	}

	const nodes = new Map<string, WorkflowStep>();
	for (const r of rows) {
		nodes.set(r.id, {
			id: r.id,
			schema: {
				id: r.schemaId,
				name: r.schemaName,
				type: r.schemaType as WorkflowStepSchemaType,
				isHidden: r.schemaIsHidden,
			},
			condition: parseCondition(r.id, r.condition),
			children: [],
		});
	}

	const childrenWithPos = new Map<string, Array<{ pos: number; node: WorkflowStep }>>();
	let root: WorkflowStep | null = null;

	for (const r of rows) {
		const node = nodes.get(r.id);
		if (!node) {
			throw new UncaughtException(`step(${r.id}) missing from node map`);
		}
		if (r.parentId === null) {
			if (root) {
				throw new UncaughtException(`multiple root steps detected`);
			}
			root = node;
			continue;
		}
		const arr = childrenWithPos.get(r.parentId) ?? [];
		arr.push({ pos: r.position, node });
		childrenWithPos.set(r.parentId, arr);
	}

	if (!root) {
		throw new UncaughtException(`no root step found despite ${rows.length} rows`);
	}

	for (const [parentId, list] of childrenWithPos) {
		const parent = nodes.get(parentId);
		if (!parent) {
			throw new UncaughtException(`step references unknown parent ${parentId}`);
		}
		list.sort((a, b) => a.pos - b.pos);
		parent.children = list.map((x) => x.node);
	}

	return root;
};

const parseCondition = (id: string, raw: string): StepCondition => {
	try {
		return JSON.parse(raw) as StepCondition;
	} catch {
		throw new UncaughtException(`step(${id}) has invalid JSON condition`);
	}
};
