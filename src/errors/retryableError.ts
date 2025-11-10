import { QAError } from "./qaError";

/**
 * Retryable errors for transient failures (network issues, timeouts).
 * These errors should be retried with exponential backoff.
 */
export class RetryableError extends QAError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = "RetryableError";
    Object.setPrototypeOf(this, RetryableError.prototype);
  }
}
