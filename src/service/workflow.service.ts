import { UncaughtException } from '../domain/exception';
import type { CreateWorkflowEntity } from '../domain/type/workflow.dao';
import { drizzleClient, type Connection } from '../infrastructure/repository/db';
import * as workflowRepository from '../infrastructure/repository/workflow.repository';

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
