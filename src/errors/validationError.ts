import { QAError } from "./qaError";

/**
 * Validation errors for input validation failures.
 * These errors should fail immediately - user correction is needed.
 */
export class ValidationError extends QAError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
