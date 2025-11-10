import { describe, expect, test } from "vitest";
import { GameCrashError } from "./gameCrashError";
import { QAError } from "./qaError";
import { RetryableError } from "./retryableError";
import { ValidationError } from "./validationError";

describe("QAError", () => {
  test("should be instantiable with message only", () => {
    const error = new QAError("Test error");
    expect(error).toBeInstanceOf(QAError);
    expect(error.message).toBe("Test error");
    expect(error.cause).toBeUndefined();
  });

  test("should be instantiable with message and cause", () => {
    const cause = new Error("Original error");
    const error = new QAError("Test error", cause);
    expect(error).toBeInstanceOf(QAError);
    expect(error.message).toBe("Test error");
    expect(error.cause).toBe(cause);
  });

  test("should set name property to 'QAError'", () => {
    const error = new QAError("Test error");
    expect(error.name).toBe("QAError");
  });

  test("should be instanceof Error", () => {
    const error = new QAError("Test error");
    expect(error).toBeInstanceOf(Error);
  });

  test("should be instanceof QAError", () => {
    const error = new QAError("Test error");
    expect(error).toBeInstanceOf(QAError);
  });

  test("should preserve error stack trace", () => {
    const error = new QAError("Test error");
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("QAError");
  });
});

describe("RetryableError", () => {
  test("should extend QAError", () => {
    const error = new RetryableError("Network timeout");
    expect(error).toBeInstanceOf(QAError);
    expect(error).toBeInstanceOf(Error);
  });

  test("should be instanceof RetryableError", () => {
    const error = new RetryableError("Network timeout");
    expect(error).toBeInstanceOf(RetryableError);
  });

  test("should set name property to 'RetryableError'", () => {
    const error = new RetryableError("Network timeout");
    expect(error.name).toBe("RetryableError");
  });

  test("should preserve message", () => {
    const error = new RetryableError("Connection refused");
    expect(error.message).toBe("Connection refused");
  });

  test("should preserve cause parameter", () => {
    const cause = new Error("Socket timeout");
    const error = new RetryableError("Network error", cause);
    expect(error.cause).toBe(cause);
  });

  test("should work without cause parameter", () => {
    const error = new RetryableError("Network error");
    expect(error.cause).toBeUndefined();
  });

  test("should preserve error stack trace", () => {
    const error = new RetryableError("Network timeout");
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("RetryableError");
  });
});

describe("GameCrashError", () => {
  test("should extend QAError", () => {
    const error = new GameCrashError("Game crashed");
    expect(error).toBeInstanceOf(QAError);
    expect(error).toBeInstanceOf(Error);
  });

  test("should be instanceof GameCrashError", () => {
    const error = new GameCrashError("Game crashed");
    expect(error).toBeInstanceOf(GameCrashError);
  });

  test("should set name property to 'GameCrashError'", () => {
    const error = new GameCrashError("Game crashed");
    expect(error.name).toBe("GameCrashError");
  });

  test("should preserve message", () => {
    const error = new GameCrashError("Fatal: WebGL context lost");
    expect(error.message).toBe("Fatal: WebGL context lost");
  });

  test("should preserve cause parameter", () => {
    const cause = new Error("Out of memory");
    const error = new GameCrashError("Game crashed", cause);
    expect(error.cause).toBe(cause);
  });

  test("should work without cause parameter", () => {
    const error = new GameCrashError("Game crashed");
    expect(error.cause).toBeUndefined();
  });

  test("should preserve error stack trace", () => {
    const error = new GameCrashError("Game crashed");
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("GameCrashError");
  });
});

describe("ValidationError", () => {
  test("should extend QAError", () => {
    const error = new ValidationError("Invalid URL");
    expect(error).toBeInstanceOf(QAError);
    expect(error).toBeInstanceOf(Error);
  });

  test("should be instanceof ValidationError", () => {
    const error = new ValidationError("Invalid URL");
    expect(error).toBeInstanceOf(ValidationError);
  });

  test("should set name property to 'ValidationError'", () => {
    const error = new ValidationError("Invalid URL");
    expect(error.name).toBe("ValidationError");
  });

  test("should preserve message", () => {
    const error = new ValidationError("Missing required field: apiKey");
    expect(error.message).toBe("Missing required field: apiKey");
  });

  test("should preserve cause parameter", () => {
    const cause = new Error("Type mismatch");
    const error = new ValidationError("Invalid input", cause);
    expect(error.cause).toBe(cause);
  });

  test("should work without cause parameter", () => {
    const error = new ValidationError("Invalid input");
    expect(error.cause).toBeUndefined();
  });

  test("should preserve error stack trace", () => {
    const error = new ValidationError("Invalid URL");
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("ValidationError");
  });
});

describe("Error Type Discrimination", () => {
  test("should distinguish RetryableError from other error types", () => {
    const retryable = new RetryableError("Network error");
    const _crash = new GameCrashError("Game crashed");
    const _validation = new ValidationError("Invalid input");

    expect(retryable).toBeInstanceOf(RetryableError);
    expect(retryable).not.toBeInstanceOf(GameCrashError);
    expect(retryable).not.toBeInstanceOf(ValidationError);
  });

  test("should distinguish GameCrashError from other error types", () => {
    const _retryable = new RetryableError("Network error");
    const crash = new GameCrashError("Game crashed");
    const _validation = new ValidationError("Invalid input");

    expect(crash).toBeInstanceOf(GameCrashError);
    expect(crash).not.toBeInstanceOf(RetryableError);
    expect(crash).not.toBeInstanceOf(ValidationError);
  });

  test("should distinguish ValidationError from other error types", () => {
    const _retryable = new RetryableError("Network error");
    const _crash = new GameCrashError("Game crashed");
    const validation = new ValidationError("Invalid input");

    expect(validation).toBeInstanceOf(ValidationError);
    expect(validation).not.toBeInstanceOf(RetryableError);
    expect(validation).not.toBeInstanceOf(GameCrashError);
  });

  test("all custom errors should be instanceof QAError", () => {
    const retryable = new RetryableError("Network error");
    const crash = new GameCrashError("Game crashed");
    const validation = new ValidationError("Invalid input");

    expect(retryable).toBeInstanceOf(QAError);
    expect(crash).toBeInstanceOf(QAError);
    expect(validation).toBeInstanceOf(QAError);
  });

  test("all custom errors should be instanceof Error", () => {
    const retryable = new RetryableError("Network error");
    const crash = new GameCrashError("Game crashed");
    const validation = new ValidationError("Invalid input");

    expect(retryable).toBeInstanceOf(Error);
    expect(crash).toBeInstanceOf(Error);
    expect(validation).toBeInstanceOf(Error);
  });
});
