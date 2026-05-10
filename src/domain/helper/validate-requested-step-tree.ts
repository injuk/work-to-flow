import { InvalidArgumentException, UncaughtException } from '../exception';
import { assertStepTreeConditions } from './validate-step-tree-conditions';
import { assertStepTreeIntegrity } from './validate-step-tree-integrity';
import { assertStepTreeRelations, type StepSchemaEdge } from './validate-step-tree-relations';
import type { WorkflowStepSchemaType } from '../type/workflow-step-schema.model';
import type { RequestedStep, WorkflowStep } from '../type/workflow-step.model';

export interface RequestedStepSchemaSummary {
	id: number;
	name: string;
	type: WorkflowStepSchemaType;
	isHidden: boolean;
	condition: string;
}

export const MAX_REQUESTED_STEP_TREE_DEPTH = 20;

export const assertRequestedStepTree = (
	root: RequestedStep,
	schemas: ReadonlyArray<RequestedStepSchemaSummary>,
	relations: ReadonlyArray<StepSchemaEdge>,
): void => {
	const schemaMap = new Map<number, RequestedStepSchemaSummary>();
	for (const s of schemas) {
		schemaMap.set(s.id, s);
	}

	const tree = assemble(root, [], schemaMap, 1);
	assertStepTreeIntegrity(tree);
	assertStepTreeRelations(tree, relations);
	assertStepTreeConditions(
		tree,
		schemas.map(({ id, condition }) => ({ id, condition })),
	);
};

const assemble = (
	req: RequestedStep,
	path: number[],
	schemaMap: Map<number, RequestedStepSchemaSummary>,
	depth: number,
): WorkflowStep => {
	if (depth > MAX_REQUESTED_STEP_TREE_DEPTH) {
		throw new InvalidArgumentException(
			`RequestedStep tree depth exceeds limit (${MAX_REQUESTED_STEP_TREE_DEPTH})`,
		);
	}
	const schema = schemaMap.get(req.schemaId);
	if (!schema) {
		throw new UncaughtException(`RequestedStep references unknown schema id=${req.schemaId}`);
	}
	return {
		id: path.length === 0 ? 'root' : `node-${path.join('-')}`,
		schema: {
			id: schema.id,
			name: schema.name,
			type: schema.type,
			isHidden: schema.isHidden,
		},
		condition: req.condition,
		children: req.children.map((c, i) => assemble(c, [...path, i], schemaMap, depth + 1)),
	};
};
