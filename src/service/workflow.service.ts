import * as workflowRepository from '../infrastructure/repository/workflow.repository';
import { drizzleClient, type Connection } from '../infrastructure/repository/db';
import { ResourceNotFoundException } from '../domain/exception';

export const simpleCreateAsync = async (
  _requestContext: unknown,
  domainContext: { name?: string },
  _connection: Connection | null = null,
): Promise<{ id: number }> => {
  return drizzleClient.executeQueryWithTransaction(async (tx) => {
    const id = await workflowRepository.createAsync(
      {
        ProjectId: 'playground',
        Name: domainContext.name ?? 'playground-workflow',
        CreatedById: 'playground-user',
      },
      tx,
    );
    return { id };
  });
};

export const simpleGetAsync = async (
  _requestContext: unknown,
  domainContext: { id: number },
  connection: Connection | null = null,
): Promise<workflowRepository.WorkflowRow> => {
  const row = await workflowRepository.getAsync(domainContext.id, connection);
  if (!row) {
    throw new ResourceNotFoundException(`Workflow(${domainContext.id}) not found`);
  }
  return row;
};
