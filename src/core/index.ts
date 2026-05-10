import type Validator from '../controller/validator';
import { UncaughtException } from '../domain/exception';

export interface BaseEvent {
  function: string;
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

  validateRequest(event, routes);

  try {
    if (options.Validator) {
      new options.Validator(event.function, event).validate();
    }
    return await routes[event.function]!(event, context);
  } catch (e) {
    console.error(`[apiRouterBase] EXCEPTION in function(${event?.function}):`, e);
    throw e;
  } finally {
    console.debug('[apiRouterBase] end');
  }
};

const validateRequest = (event: BaseEvent, routes: Routes): void => {
  const isFalsyOrBlank = (s: unknown): boolean => typeof s !== 'string' || !s.trim();
  if (isFalsyOrBlank(event.function)) {
    throw new UncaughtException(`cannot route event to function(${event.function})`);
  }
  if (!Reflect.has(routes, event.function)) {
    throw new UncaughtException(`there is no route for function(${event.function})`);
  }
};
