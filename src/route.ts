import Validator from './controller/validator';
import * as workflowController from './controller/workflow.controller';
import { apiRouterBase, type BaseEvent, type Routes } from './core/lambda.router';

export const routes: Routes = {
	createWorkflow: workflowController.createAsync,
	listWorkflows: workflowController.listAsync,
	getWorkflow: workflowController.getAsync,
	updateWorkflow: workflowController.updateAsync,
};

export const handler = (event: BaseEvent, context: unknown) =>
	apiRouterBase(event, context, routes, { Validator });
