import type Validator from '../controller/validator';
import { UncaughtException } from '../domain/exception';

export interface BaseEvent {
	function: string;
	data?: unknown;
	pathParameters?: Record<string, string | undefined>;
	queryStringParameters?: Record<string, string | undefined>;
	headers?: Record<string, string | undefined>;
	[key: string]: unknown;
}

export type RouteHandler<T extends BaseEvent = BaseEvent, R = unknown> = (
	event: T,
	context: unknown,
) => Promise<R>;

export type Routes = Record<string, RouteHandler>;

export interface RouterOptions {
	Validator?: typeof Validator;
}

export const apiRouterBase = async (
	event: BaseEvent,
	context: unknown,
	routes: Routes,
	options: RouterOptions = {},
): Promise<unknown> => {
	console.debug(`[apiRouterBase] event:`, event);

	const handler = resolveRoute(event, routes);

	try {
		if (options.Validator) {
			new options.Validator(event.function, event).validate();
		}
		return await handler(event, context);
	} catch (e) {
		console.error(`[apiRouterBase] EXCEPTION in function(${event?.function}):`, e);
		throw e;
	} finally {
		console.debug('[apiRouterBase] end');
	}
};

const resolveRoute = (event: BaseEvent, routes: Routes): RouteHandler => {
	const isFalsyOrBlank = (s: unknown): boolean => typeof s !== 'string' || !s.trim();
	if (isFalsyOrBlank(event.function)) {
		throw new UncaughtException(`cannot route event to function(${event.function})`);
	}
	const handler = routes[event.function];
	if (!handler) {
		throw new UncaughtException(`there is no route for function(${event.function})`);
	}
	return handler;
};
