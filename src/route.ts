import { apiRouterBase, type BaseEvent, type Routes } from './core/lambda.router';
import Validator from './controller/validator';
import * as workflowController from './controller/workflow.controller';

export const routes: Routes = {
  simpleCreate: workflowController.simpleCreateAsync,
  simpleGet: workflowController.simpleGetAsync,
};

export const handler = (event: BaseEvent, context: unknown) =>
  apiRouterBase(event, context, routes, { Validator });
