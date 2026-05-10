import type { BaseEvent } from './lambda.router';
import { InvalidArgumentException } from '../domain/exception';

export const requireProjectId = (event: BaseEvent): string => {
	const headers = event.headers ?? {};
	const value = headers.projectId ?? headers.projectid;
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new InvalidArgumentException('projectId header is required');
	}
	return value;
};
