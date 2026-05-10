import { paginate, type PaginatedResult } from '../core/token-based-pagination';
import { ResourceNotFoundException, UncaughtException } from '../domain/exception';
import { buildStepTree } from '../domain/helper/build-step-tree';
import { assertStepTreeConditions } from '../domain/helper/validate-step-tree-conditions';
import { assertStepTreeIntegrity } from '../domain/helper/validate-step-tree-integrity';
import { assertStepTreeRelations } from '../domain/helper/validate-step-tree-relations';
import { assertStatusTransitionAllowed } from '../domain/strategy/workflow-status-transition';
import type { WorkflowStep } from '../domain/type/workflow-step.model';
import type {
	CreateWorkflowEntity,
	DeleteWorkflowConditions,
	GetWorkflowConditions,
	ListWorkflowsConditions,
	UpdateWorkflowConditions,
} from '../domain/type/workflow.dao';
import type { Workflow, WorkflowStatus, WorkflowSummary } from '../domain/type/workflow.model';
import { drizzleClient, type Connection } from '../infrastructure/repository/db';
import * as stepSchemaRepository from '../infrastructure/repository/step-schema.repository';
import * as workflowRepository from '../infrastructure/repository/workflow.repository';
import type { WorkflowRow } from '../infrastructure/repository/workflow.repository';

export const createAsync = async (
	_requestContext: unknown,
	domainContext: CreateWorkflowEntity,
	_connection: Connection | null = null,
): Promise<{ id: number }> => {
	return drizzleClient.executeQueryWithTransaction(async (tx) => {
		const id = await workflowRepository.createAsync(domainContext, tx);
		if (!Number.isInteger(id) || id <= 0) {
			throw new UncaughtException('failed to create Workflow');
		}
		return { id };
	});
};

export const listAsync = async (
	_requestContext: unknown,
	domainContext: ListWorkflowsConditions,
	token: string | null = null,
	limit?: number,
): Promise<PaginatedResult<WorkflowSummary>> => {
	const { results, nextToken } = await paginate<WorkflowRow>({
		fetch: ({ offset, limit: pageLimit, ...rest }) =>
			workflowRepository.listAsync({
				projectId: rest.projectId as string,
				status: rest.status as WorkflowStatus | undefined,
				limit: pageLimit,
				offset,
			}),
		conditions: { projectId: domainContext.projectId, status: domainContext.status },
		token,
		limit,
	});

	return { results: results.map(toWorkflowSummary), nextToken };
};

export const getAsync = async (
	_requestContext: unknown,
	domainContext: GetWorkflowConditions,
	_connection: Connection | null = null,
): Promise<Workflow> => {
	const row = await workflowRepository.getAsync(domainContext.id);
	if (!row || row.ProjectId !== domainContext.projectId) {
		throw new ResourceNotFoundException(`Workflow(${domainContext.id}) could not be found`);
	}

	const stepRows = await workflowRepository.listStepsByWorkflowAsync(domainContext.id);
	const stepTree = buildStepTree(stepRows);

	return toWorkflow(row, stepTree);
};

export const updateAsync = async (
	_requestContext: unknown,
	domainContext: UpdateWorkflowConditions,
): Promise<null> => {
	const { id, projectId, data } = domainContext;

	return drizzleClient.executeQueryWithTransaction(async (tx) => {
		const row = await workflowRepository.getAsync(id, tx);
		if (!row || row.ProjectId !== projectId) {
			throw new ResourceNotFoundException(`Workflow(${id}) could not be found`);
		}

		if (data.status !== undefined) {
			const current = row.Status as WorkflowStatus;
			assertStatusTransitionAllowed(current, data.status);
			const isLeavingDraft = current === 'DRAFT' && data.status !== 'DRAFT';
			if (isLeavingDraft) {
				const stepRows = await workflowRepository.listStepsByWorkflowAsync(id, tx);
				const tree = buildStepTree(stepRows);
				assertStepTreeIntegrity(tree);
				if (tree !== null) {
					const schemaIds = collectSchemaIds(tree);
					const [relations, schemas] = await Promise.all([
						stepSchemaRepository.listAllRelationsAsync(tx),
						stepSchemaRepository.listSchemasByIdsAsync(schemaIds, tx),
					]);
					assertStepTreeRelations(tree, relations);
					assertStepTreeConditions(tree, schemas);
				}
			}
		}

		const result = await workflowRepository.updateAsync(id, data, tx);
		if (result.affectedRows === 0) {
			throw new UncaughtException(`failed to update Workflow(${id})`);
		}
		return null;
	});
};

export const deleteAsync = async (
	_requestContext: unknown,
	domainContext: DeleteWorkflowConditions,
): Promise<null> => {
	const { id, projectId } = domainContext;

	return drizzleClient.executeQueryWithTransaction(async (tx) => {
		const row = await workflowRepository.getAsync(id, tx);
		if (!row || row.ProjectId !== projectId) {
			throw new ResourceNotFoundException(`Workflow(${id}) could not be found`);
		}

		const result = await workflowRepository.deleteAsync(id, tx);
		if (result.affectedRows === 0) {
			throw new UncaughtException(`failed to delete Workflow(${id})`);
		}
		return null;
	});
};

const collectSchemaIds = (root: WorkflowStep): number[] => {
	const ids = new Set<number>();
	const visit = (node: WorkflowStep): void => {
		ids.add(node.schema.id);
		for (const child of node.children) {
			visit(child);
		}
	};
	visit(root);
	return Array.from(ids);
};

const toWorkflow = (row: WorkflowRow, stepTree: WorkflowStep | null): Workflow => ({
	id: row.Id,
	project: { id: row.ProjectId },
	name: row.Name,
	description: row.Description,
	status: row.Status as WorkflowStatus,
	stepTree,
	created: {
		at: row.CreatedAt,
		by: { id: row.CreatedById, name: row.CreatedById, username: row.CreatedById },
	},
	updated: { at: row.UpdatedAt },
});

const toWorkflowSummary = (row: WorkflowRow): WorkflowSummary => ({
	id: row.Id,
	project: { id: row.ProjectId },
	name: row.Name,
	status: row.Status as WorkflowStatus,
	created: {
		at: row.CreatedAt,
		by: { id: row.CreatedById, name: row.CreatedById, username: row.CreatedById },
	},
	updated: { at: row.UpdatedAt },
});
