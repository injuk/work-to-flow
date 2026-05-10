import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { retry } from '../../src/core/retry';

describe('retry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('첫 시도에 성공하면 그 결과를 그대로 반환한다', async () => {
    // Arrange
    const expected = { value: 42 };
    const asyncFunc = jest.fn().mockResolvedValue(expected);

    // Act
    const result = await retry(asyncFunc);

    // Assert
    expect(result).toBe(expected);
    expect(asyncFunc).toHaveBeenCalledTimes(1);
  });

  it('실패 후 재시도하여 성공하면 그 결과를 반환한다', async () => {
    // Arrange
    const asyncFunc = jest
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('1차 실패'))
      .mockRejectedValueOnce(new Error('2차 실패'))
      .mockResolvedValue('ok');

    // Act
    const promise = retry(asyncFunc, { seedIntervalMs: 100, maxRetry: 3 });
    await jest.runAllTimersAsync();
    const result = await promise;

    // Assert
    expect(result).toBe('ok');
    expect(asyncFunc).toHaveBeenCalledTimes(3);
  });

  it('maxRetry를 초과하면 마지막 에러를 throw한다', async () => {
    // Arrange
    const lastError = new Error('최종 실패');
    const asyncFunc = jest
      .fn()
      .mockRejectedValueOnce(new Error('1차'))
      .mockRejectedValueOnce(new Error('2차'))
      .mockRejectedValueOnce(new Error('3차'))
      .mockRejectedValue(lastError);

    // Act
    const promise = retry(asyncFunc, { maxRetry: 3, seedIntervalMs: 100 });
    const assertion = expect(promise).rejects.toBe(lastError);
    await jest.runAllTimersAsync();

    // Assert
    await assertion;
    expect(asyncFunc).toHaveBeenCalledTimes(4); // 최초 1회 + 재시도 3회
  });

  it('shouldRetry가 false를 반환하면 재시도 없이 즉시 throw한다', async () => {
    // Arrange
    const error = new Error('비재시도 대상');
    const asyncFunc = jest.fn().mockRejectedValue(error);
    const shouldRetry = jest.fn().mockReturnValue(false);

    // Act
    const promise = retry(asyncFunc, { shouldRetry, maxRetry: 5 });

    // Assert
    await expect(promise).rejects.toBe(error);
    expect(asyncFunc).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(error);
  });

  it('지수 백오프(seedIntervalMs * 2^attempt) 간격으로 대기한다', async () => {
    // Arrange
    const seedIntervalMs = 100;
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const asyncFunc = jest
      .fn()
      .mockRejectedValueOnce(new Error('1차'))
      .mockRejectedValueOnce(new Error('2차'))
      .mockRejectedValueOnce(new Error('3차'))
      .mockResolvedValue('ok');

    // Act
    const promise = retry(asyncFunc, { seedIntervalMs, maxRetry: 3 });
    await jest.runAllTimersAsync();
    await promise;

    // Assert: 100 * 2^0, 100 * 2^1, 100 * 2^2
    const delays = setTimeoutSpy.mock.calls.map(([, ms]) => ms);
    expect(delays).toEqual([100, 200, 400]);
  });

  it('asyncFunc의 반환 타입이 제네릭으로 추론된다', async () => {
    // Arrange
    const asyncFunc = async (): Promise<number> => 7;

    // Act
    const result = await retry(asyncFunc);

    // Assert: 컴파일 타임에 number로 추론되는 것이 핵심 — 아래 할당은 추론 회귀 시 컴파일 에러로 잡힘
    const typed: number = result;
    expect(typed).toBe(7);
  });
});