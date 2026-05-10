const DEFAULT_MAX_RETRY = 3;
const DEFAULT_SEED_INTERVAL_MS = 500;

export interface RetryOptions {
  maxRetry?: number;
  seedIntervalMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const retry = async <T>(
  asyncFunc: () => Promise<T>,
  {
    maxRetry = DEFAULT_MAX_RETRY,
    seedIntervalMs = DEFAULT_SEED_INTERVAL_MS,
    shouldRetry,
  }: RetryOptions = {},
): Promise<T> => {
  let attempt = 0;
  for (;;) {
    try {
      return await asyncFunc();
    } catch (e) {
      if (shouldRetry && !shouldRetry(e)) throw e;
      if (attempt >= maxRetry) throw e;
      await wait(seedIntervalMs * Math.pow(2, attempt));
      attempt++;
    }
  }
};