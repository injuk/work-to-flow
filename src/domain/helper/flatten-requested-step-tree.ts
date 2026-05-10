import uniqueId from '../../core/unique-id';
import type { RequestedStep } from '../type/workflow-step.model';

export interface WorkflowStepInsertRow {
	id: string;
	workflowId: number;
	schemaId: number;
	condition: string;
	parentId: string | null;
	position: number;
}

export const flattenRequestedStepTree = (
	root: RequestedStep,
	workflowId: number,
): WorkflowStepInsertRow[] => {
	const rows: WorkflowStepInsertRow[] = [];
	const visit = (node: RequestedStep, parentId: string | null, position: number): void => {
		const id = uniqueId.create();
		rows.push({
			id,
			workflowId,
			schemaId: node.schemaId,
			condition: JSON.stringify(node.condition),
			parentId,
			position,
		});
		node.children.forEach((child, index) => visit(child, id, index));
	};
	visit(root, null, 0);
	return rows;
};
