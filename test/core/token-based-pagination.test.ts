import { describe, expect, it, jest } from '@jest/globals';

import { InvalidArgumentException } from '../../src/domain/exception';
import { paginate } from '../../src/core/token-based-pagination';

const encodeToken = (data: Record<string, unknown>): string =>
	Buffer.from(JSON.stringify(data), 'utf8').toString('base64');

const decodeToken = (token: string): Record<string, unknown> =>
	JSON.parse(Buffer.from(token, 'base64').toString('utf8')) as Record<string, unknown>;

describe('paginate (token-based pagination)', () => {
	it('첫 페이지 호출 시 limit+1로 조회하고 다음 페이지가 있으면 nextToken을 반환한다', async () => {
		// Arrange
		const fetch = jest
			.fn<(search: { offset: number; limit: number }) => Promise<number[]>>()
			.mockResolvedValue([1, 2, 3, 4]);

		// Act
		const result = await paginate({ fetch, limit: 3 });

		// Assert
		expect(fetch).toHaveBeenCalledWith({ offset: 0, limit: 4 });
		expect(result.results).toEqual([1, 2, 3]);
		expect(result.nextToken).not.toBeNull();
		expect(decodeToken(result.nextToken!)).toEqual({ offset: 3, limit: 3 });
	});

	it('limit 미지정 시 기본 50으로 조회한다', async () => {
		// Arrange
		const fetch = jest
			.fn<(search: { offset: number; limit: number }) => Promise<number[]>>()
			.mockResolvedValue([]);

		// Act
		await paginate({ fetch });

		// Assert
		expect(fetch).toHaveBeenCalledWith({ offset: 0, limit: 51 });
	});

	it('결과가 limit 이하이면 nextToken은 null이고 결과를 그대로 반환한다', async () => {
		// Arrange
		const fetch = jest
			.fn<(search: { offset: number; limit: number }) => Promise<number[]>>()
			.mockResolvedValue([1, 2]);

		// Act
		const result = await paginate({ fetch, limit: 3 });

		// Assert
		expect(result).toEqual({ results: [1, 2], nextToken: null });
	});

	it('결과가 정확히 limit이면 nextToken은 null이다', async () => {
		// Arrange: probed limit=4로 요청했지만 3건만 옴 → 다음 페이지 없음
		const fetch = jest
			.fn<(search: { offset: number; limit: number }) => Promise<number[]>>()
			.mockResolvedValue([1, 2, 3]);

		// Act
		const result = await paginate({ fetch, limit: 3 });

		// Assert
		expect(result.results).toEqual([1, 2, 3]);
		expect(result.nextToken).toBeNull();
	});

	it('token이 주어지면 디코드된 offset/limit으로 다음 페이지를 조회한다', async () => {
		// Arrange
		const token = encodeToken({ offset: 6, limit: 3, status: 'ACTIVE' });
		const fetch = jest
			.fn<(search: { offset: number; limit: number }) => Promise<number[]>>()
			.mockResolvedValue([7, 8, 9, 10]);

		// Act
		const result = await paginate({ fetch, token });

		// Assert: limit은 토큰 값(3) + probe(1) = 4
		expect(fetch).toHaveBeenCalledWith({ offset: 6, limit: 4, status: 'ACTIVE' });
		expect(result.results).toEqual([7, 8, 9]);
		expect(decodeToken(result.nextToken!)).toEqual({ offset: 9, limit: 3, status: 'ACTIVE' });
	});

	it('conditions는 nextToken에 그대로 보존되어 다음 페이지에 전달된다', async () => {
		// Arrange
		const fetch = jest
			.fn<(search: Record<string, unknown>) => Promise<number[]>>()
			.mockResolvedValue([1, 2, 3, 4]);

		// Act
		const result = await paginate({
			fetch,
			conditions: { keyword: 'foo', status: 'ACTIVE' },
			limit: 3,
		});

		// Assert
		expect(fetch).toHaveBeenCalledWith({
			offset: 0,
			limit: 4,
			keyword: 'foo',
			status: 'ACTIVE',
		});
		expect(decodeToken(result.nextToken!)).toEqual({
			offset: 3,
			limit: 3,
			keyword: 'foo',
			status: 'ACTIVE',
		});
	});

	it('token이 있으면 conditions 인자는 무시된다', async () => {
		// Arrange: 검색 조건은 토큰에서만 읽는다 (페이지 간 일관성 보장)
		const token = encodeToken({ offset: 3, limit: 3, keyword: 'persisted' });
		const fetch = jest
			.fn<(search: Record<string, unknown>) => Promise<number[]>>()
			.mockResolvedValue([4, 5]);

		// Act
		await paginate({ fetch, token, conditions: { keyword: 'ignored' }, limit: 999 });

		// Assert
		expect(fetch).toHaveBeenCalledWith({ offset: 3, limit: 4, keyword: 'persisted' });
	});

	it('잘못된 base64/JSON 토큰이면 InvalidArgumentException을 throw한다', async () => {
		// Arrange
		const fetch = jest.fn<() => Promise<number[]>>();

		// Act & Assert
		await expect(paginate({ fetch, token: '!!!not-base64-json!!!' })).rejects.toBeInstanceOf(
			InvalidArgumentException,
		);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('offset/limit이 누락된 토큰이면 InvalidArgumentException을 throw한다', async () => {
		// Arrange
		const token = encodeToken({ keyword: 'foo' });
		const fetch = jest.fn<() => Promise<number[]>>();

		// Act & Assert
		await expect(paginate({ fetch, token })).rejects.toBeInstanceOf(InvalidArgumentException);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('limit이 0 이하인 토큰이면 InvalidArgumentException을 throw한다', async () => {
		// Arrange
		const token = encodeToken({ offset: 0, limit: 0 });
		const fetch = jest.fn<() => Promise<number[]>>();

		// Act & Assert
		await expect(paginate({ fetch, token })).rejects.toBeInstanceOf(InvalidArgumentException);
	});

	it('offset이 음수인 토큰이면 InvalidArgumentException을 throw한다', async () => {
		// Arrange
		const token = encodeToken({ offset: -1, limit: 10 });
		const fetch = jest.fn<() => Promise<number[]>>();

		// Act & Assert
		await expect(paginate({ fetch, token })).rejects.toBeInstanceOf(InvalidArgumentException);
	});
});
