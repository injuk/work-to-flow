import { paginate, type PaginatedResult } from '../core/token-based-pagination';
import { UncaughtException } from '../domain/exception';
import type { CreateWorkflowEntity, ListWorkflowsConditions } from '../domain/type/workflow.dao';
import type { WorkflowStatus, WorkflowSummary } from '../domain/type/workflow.model';
import { drizzleClient, type Connection } from '../infrastructure/repository/db';
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
