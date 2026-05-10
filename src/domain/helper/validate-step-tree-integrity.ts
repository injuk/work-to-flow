import { InvalidArgumentException } from '../exception';
import type { WorkflowStep } from '../type/workflow-step.model';

export const assertStepTreeIntegrity = (root: WorkflowStep | null): void => {
	if (root === null) {
		throw new InvalidArgumentException('Workflow has no steps; cannot transition out of DRAFT');
	}
	if (root.schema.type !== 'START') {
		throw new InvalidArgumentException(
			`Workflow root step(${root.id}) is ${root.schema.type}, must be START`,
		);
	}
	visit(root, true, new Set<string>());
};

const visit = (node: WorkflowStep, isRoot: boolean, visited: Set<string>): void => {
	if (visited.has(node.id)) {
		throw new InvalidArgumentException(`Workflow step(${node.id}) appears more than once`);
	}
	visited.add(node.id);

	const { type, isHidden } = node.schema;

	if (!isRoot && type === 'START') {
		throw new InvalidArgumentException(`Workflow step(${node.id}) is START but is not the root`);
	}
	if ((type === 'START' || type === 'END') && !isHidden) {
		throw new InvalidArgumentException(`Workflow ${type} step(${node.id}) must have isHidden=true`);
	}

	const hasChildren = node.children.length > 0;
	if (hasChildren && type === 'END') {
		throw new InvalidArgumentException(`Workflow step(${node.id}) is END but has children`);
	}
	if (!hasChildren && type !== 'END') {
		throw new InvalidArgumentException(`Workflow leaf step(${node.id}) is ${type}, must be END`);
	}

	for (const child of node.children) {
		visit(child, false, visited);
	}
};
