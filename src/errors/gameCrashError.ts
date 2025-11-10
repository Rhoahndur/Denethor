import { QAError } from "./qaError";

/**
 * Game crash errors for critical failures.
 * These errors should fail fast without retry - the game has crashed and cannot continue.
 */
export class GameCrashError extends QAError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = "GameCrashError";
    Object.setPrototypeOf(this, GameCrashError.prototype);
  }
}
