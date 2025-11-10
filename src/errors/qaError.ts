/**
 * Base error class for all Denethor custom errors.
 * Provides a common parent for typed error handling.
 */
export class QAError extends Error {
  constructor(
    message: string,
    public override cause?: Error,
  ) {
    super(message);
    this.name = "QAError";
    Object.setPrototypeOf(this, QAError.prototype);
  }
}
