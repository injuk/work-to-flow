import { InvalidArgumentException } from '../exception';
import type { WorkflowStep } from '../type/workflow-step.model';

export interface StepSchemaEdge {
	frontSchemaId: number;
	rearSchemaId: number;
}

export const assertStepTreeRelations = (
	root: WorkflowStep,
	relations: ReadonlyArray<StepSchemaEdge>,
): void => {
	const allowed = new Set<string>();
	for (const r of relations) {
		allowed.add(`${r.frontSchemaId}:${r.rearSchemaId}`);
	}
	visit(root, allowed);
};

const visit = (node: WorkflowStep, allowed: Set<string>): void => {
	for (const child of node.children) {
		const key = `${node.schema.id}:${child.schema.id}`;
		if (!allowed.has(key)) {
			throw new InvalidArgumentException(
				`Workflow step transition (parent=${node.id}, schema ${node.schema.id} -> ${child.schema.id}) is not allowed`,
			);
		}
		visit(child, allowed);
	}
};
