import { InvalidArgumentException } from '../exception';
import type { WorkflowStatus } from '../type/workflow.model';

export const assertStatusTransitionAllowed = (
	current: WorkflowStatus,
	next: WorkflowStatus,
): void => {
	if (current === next) {
		return;
	}
	if (next === 'DRAFT') {
		throw new InvalidArgumentException(
			`Workflow status cannot transition back to DRAFT (from ${current})`,
		);
	}
};
