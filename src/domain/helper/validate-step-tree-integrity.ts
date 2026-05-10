import { InvalidArgumentException } from '../exception';
import type { WorkflowStep } from '../type/workflow-step.model';

export const assertStepTreeIntegrity = (root: WorkflowStep | null): void => {
	if (root === null) {
		throw new InvalidArgumentException('Workflow has no steps; cannot transition out of DRAFT');
	}
	visit(root);
};

const visit = (node: WorkflowStep): void => {
	if (node.children.length === 0) {
		if (node.schema.type !== 'END') {
			throw new InvalidArgumentException(
				`Workflow leaf step(${node.id}) is ${node.schema.type}, must be END`,
			);
		}
		return;
	}
	for (const child of node.children) {
		visit(child);
	}
};
