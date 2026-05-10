import { InvalidArgumentException } from '../domain/exception';

const DEFAULT_LIMIT = 50;
const NEXT_PAGE_PROBE = 1;

interface Cursor {
	offset: number;
	limit: number;
	[key: string]: unknown;
}

export interface PaginatedResult<T> {
	results: T[];
	nextToken: string | null;
}

export interface PaginateParams<T> {
	fetch: (search: Cursor) => Promise<T[]>;
	conditions?: Record<string, unknown>;
	token?: string | null;
	limit?: number;
}

export const paginate = async <T>(params: PaginateParams<T>): Promise<PaginatedResult<T>> => {
	const { fetch, conditions = {}, token = null, limit = DEFAULT_LIMIT } = params;

	const cursor: Cursor = token ? decodeToken(token) : { ...conditions, offset: 0, limit };
	const probedResults = await fetch({ ...cursor, limit: cursor.limit + NEXT_PAGE_PROBE });

	const hasNext = probedResults.length > cursor.limit;
	const results = hasNext ? probedResults.slice(0, cursor.limit) : probedResults;
	const nextToken = hasNext
		? encodeToken({ ...cursor, offset: cursor.offset + cursor.limit })
		: null;

	return { results, nextToken };
};

const encodeToken = (cursor: Cursor): string =>
	Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64');

const decodeToken = (token: string): Cursor => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
	} catch {
		throw new InvalidArgumentException('invalid nextToken.');
	}
	if (!isCursor(parsed)) {
		throw new InvalidArgumentException('invalid nextToken.');
	}
	return parsed;
};

const isCursor = (value: unknown): value is Cursor => {
	if (!value || typeof value !== 'object') {
		return false;
	}
	const record = value as Record<string, unknown>;
	return (
		typeof record.offset === 'number' &&
		record.offset >= 0 &&
		typeof record.limit === 'number' &&
		record.limit > 0
	);
};
