/**
 * Retry utility with exponential backoff and jitter.
 *
 * Provides a generic retry mechanism for handling transient failures across the application.
 * Uses exponential backoff with jitter to prevent thundering herd problems.
 *
 * @module retry
 *
 * @example
 * ```typescript
 * import { retry } from '@/utils/retry';
 * import { RetryableError } from '@/utils/errors';
 *
 * // Basic usage with defaults (max 3 retries)
 * const result = await retry(async () => {
 *   const response = await fetch('https://api.example.com/data');
 *   if (!response.ok) throw new RetryableError('API request failed');
 *   return response.json();
 * });
 *
 * // Custom retry options
 * const result = await retry(
 *   async () => connectToBrowser(),
 *   {
 *     maxRetries: 5,
 *     initialDelay: 1000,
 *     maxDelay: 30000,
 *     shouldRetry: (error) => error.message.includes('connection')
 *   }
 * );
 *
 * // Using with custom predicate
 * const result = await retry(
 *   async () => performAction(),
 *   {
 *     shouldRetry: (error) => {
 *       // Retry on network errors or specific status codes
 *       return error instanceof NetworkError ||
 *              (error.status >= 500 && error.status < 600);
 *     }
 *   }
 * );
 * ```
 */

import { RetryableError } from "@/errors/retryableError";
import { logger } from "./logger";

const log = logger.child({ component: "RetryUtil" });

/**
 * Configuration options for retry behavior.
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Initial delay in milliseconds before first retry.
   * @default 1000
   */
  initialDelay?: number;

  /**
   * Maximum delay in milliseconds between retries.
   * Prevents exponential backoff from growing unbounded.
   * @default 10000
   */
  maxDelay?: number;

  /**
   * Custom predicate to determine if an error should trigger a retry.
   * If not provided, only RetryableError instances will be retried.
   *
   * @param error - The error that occurred
   * @returns true if the operation should be retried, false otherwise
   *
   * @example
   * ```typescript
   * shouldRetry: (error) => error instanceof NetworkError
   * ```
   */
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Executes an async operation with retry logic and exponential backoff.
 *
 * **Algorithm:**
 * - Exponential backoff: `delay = min(initialDelay * 2^attempt, maxDelay)`
 * - Jitter: Randomizes delay by ±25% to prevent thundering herd
 * - Selective retry: By default, only retries RetryableError instances
 *
 * **Behavior:**
 * - Logs each retry attempt with structured context
 * - Throws the original error if max retries are exhausted
 * - Non-retryable errors are thrown immediately
 *
 * @template T - The return type of the async operation
 * @param operation - The async function to execute with retry
 * @param options - Retry configuration options
 * @returns Promise resolving to the operation result
 * @throws The original error if all retries are exhausted or error is non-retryable
 *
 * @example
 * ```typescript
 * // Retry a browser connection
 * const page = await retry(
 *   async () => {
 *     const session = await browserbase.createSession();
 *     if (!session) throw new RetryableError('Session creation failed');
 *     return session;
 *   },
 *   { maxRetries: 5, initialDelay: 2000 }
 * );
 * ```
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (error: Error) => error instanceof RetryableError,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Execute the operation
      const result = await operation();

      // Log success if this was a retry
      if (attempt > 0) {
        log.info(
          { attempt, previousAttempts: attempt },
          "Operation succeeded after retry",
        );
      }

      return result;
    } catch (error) {
      // Ensure error is an Error instance
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;

      // Check if we should retry this error
      if (!shouldRetry(err)) {
        log.debug(
          { error: err.message, attempt },
          "Error is not retryable, throwing immediately",
        );
        throw err;
      }

      // Check if we've exhausted retries
      if (attempt >= maxRetries) {
        log.error(
          {
            error: err.message,
            attempt,
            maxRetries,
          },
          "Max retries exhausted, operation failed",
        );
        throw err;
      }

      // Calculate exponential backoff with jitter
      const exponentialDelay = Math.min(initialDelay * 2 ** attempt, maxDelay);

      // Add jitter: randomize delay by ±25%
      const jitterFactor = 0.75 + Math.random() * 0.5; // Range: 0.75 to 1.25
      const delayWithJitter = Math.floor(exponentialDelay * jitterFactor);

      // Log retry attempt
      log.warn(
        {
          error: err.message,
          attempt: attempt + 1,
          maxRetries,
          delay: delayWithJitter,
        },
        "Operation failed, retrying with exponential backoff",
      );

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delayWithJitter));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error("Retry failed with unknown error");
}
