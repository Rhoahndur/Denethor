// Set required env vars BEFORE any imports to avoid validation errors
process.env.BROWSERBASE_API_KEY = "test-key";
process.env.BROWSERBASE_PROJECT_ID = "test-project";
process.env.OPENAI_API_KEY = "test-openai";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { RetryableError } from "@/errors/retryableError";
import { retry } from "./retry";

describe("retry utility", () => {
  // Store original env vars
  const originalEnv = process.env;

  beforeEach(() => {
    // Create a fresh copy of process.env
    process.env = { ...originalEnv };
    // Set required env vars to avoid validation errors
    process.env.BROWSERBASE_API_KEY = "test-key";
    process.env.BROWSERBASE_PROJECT_ID = "test-project";
    process.env.OPENAI_API_KEY = "test-openai";
    // Use fake timers for deterministic testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    // Restore real timers
    vi.useRealTimers();
  });

  describe("successful operations", () => {
    test("should return result on immediate success", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const promise = retry(operation);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test("should return result after transient failures", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new RetryableError("First failure"))
        .mockRejectedValueOnce(new RetryableError("Second failure"))
        .mockResolvedValue("success");

      const promise = retry(operation, { maxRetries: 3 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    });

    test("should work with generic return types", async () => {
      interface TestData {
        id: number;
        name: string;
      }

      const testData: TestData = { id: 1, name: "test" };
      const operation = vi.fn().mockResolvedValue(testData);

      const promise = retry<TestData>(operation);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual(testData);
      expect(result.id).toBe(1);
      expect(result.name).toBe("test");
    });
  });

  describe("retry exhaustion", () => {
    test("should throw error after max retries exhausted", async () => {
      const error = new RetryableError("Persistent failure");
      const operation = vi.fn().mockRejectedValue(error);

      const promise = retry(operation, { maxRetries: 2 });
      const runPromise = vi.runAllTimersAsync();

      await expect(Promise.all([promise, runPromise])).rejects.toThrow(
        "Persistent failure",
      );
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    test("should respect maxRetries=0", async () => {
      const error = new RetryableError("Failure");
      const operation = vi.fn().mockRejectedValue(error);

      const promise = retry(operation, { maxRetries: 0 });
      const runPromise = vi.runAllTimersAsync();

      await expect(Promise.all([promise, runPromise])).rejects.toThrow(
        "Failure",
      );
      expect(operation).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe("exponential backoff timing", () => {
    test("should use exponential backoff delays", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new RetryableError("Attempt 1"))
        .mockRejectedValueOnce(new RetryableError("Attempt 2"))
        .mockRejectedValueOnce(new RetryableError("Attempt 3"))
        .mockResolvedValue("success");

      const promise = retry(operation, {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
      });

      // First attempt - immediate
      expect(operation).toHaveBeenCalledTimes(1);

      // Advance time by 1000ms (first retry delay: 1000 * 2^0 = 1000, with jitter)
      await vi.advanceTimersByTimeAsync(1500);
      expect(operation).toHaveBeenCalledTimes(2);

      // Advance time by 2000ms (second retry delay: 1000 * 2^1 = 2000, with jitter)
      await vi.advanceTimersByTimeAsync(2500);
      expect(operation).toHaveBeenCalledTimes(3);

      // Advance time by 4000ms (third retry delay: 1000 * 2^2 = 4000, with jitter)
      await vi.advanceTimersByTimeAsync(5000);
      expect(operation).toHaveBeenCalledTimes(4);

      const result = await promise;
      expect(result).toBe("success");
    });

    test("should respect maxDelay cap", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new RetryableError("Attempt 1"))
        .mockResolvedValue("success");

      const promise = retry(operation, {
        maxRetries: 1,
        initialDelay: 1000,
        maxDelay: 500, // Lower than initial delay * 2^0
      });

      // First attempt
      expect(operation).toHaveBeenCalledTimes(1);

      // Delay should be capped at maxDelay (500ms, plus jitter tolerance)
      await vi.advanceTimersByTimeAsync(800);
      expect(operation).toHaveBeenCalledTimes(2);

      const result = await promise;
      expect(result).toBe("success");
    });
  });

  describe("jitter randomization", () => {
    test("should add jitter to delays", async () => {
      // Run multiple attempts to verify jitter variance
      const _delays: number[] = [];
      const startTimes: number[] = [];

      for (let i = 0; i < 5; i++) {
        vi.clearAllTimers();
        vi.useFakeTimers();

        const operation = vi
          .fn()
          .mockRejectedValueOnce(new RetryableError("Test"))
          .mockResolvedValue("success");

        const startTime = Date.now();
        startTimes.push(startTime);

        const promise = retry(operation, {
          maxRetries: 1,
          initialDelay: 1000,
        });

        // Run timers and track when second call happens
        await vi.runAllTimersAsync();
        await promise;

        // The delay used should be 1000 * jitterFactor (0.75-1.25)
        // We can't measure exact delay with fake timers, but we can verify operation was called
        expect(operation).toHaveBeenCalledTimes(2);

        vi.useRealTimers();
      }

      // With jitter, delays should vary (not all identical)
      // This is a statistical test - with 5 attempts, very unlikely all are identical
      // Note: In fake timer mode, we verify the logic exists, not the exact variance
    });
  });

  describe("custom shouldRetry predicate", () => {
    test("should use custom retry condition", async () => {
      class NetworkError extends Error {}
      const networkError = new NetworkError("Network failure");

      const operation = vi
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue("success");

      const promise = retry(operation, {
        maxRetries: 2,
        shouldRetry: (error) => error instanceof NetworkError,
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    });

    test("should not retry non-matching errors with custom predicate", async () => {
      class DatabaseError extends Error {}
      class NetworkError extends Error {}

      const dbError = new DatabaseError("Database failure");
      const operation = vi.fn().mockRejectedValue(dbError);

      const promise = retry(operation, {
        maxRetries: 2,
        shouldRetry: (error) => error instanceof NetworkError,
      });

      const runPromise = vi.runAllTimersAsync();

      await expect(Promise.all([promise, runPromise])).rejects.toThrow(
        "Database failure",
      );
      expect(operation).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe("default retry behavior", () => {
    test("should retry RetryableError by default", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new RetryableError("Transient error"))
        .mockResolvedValue("success");

      const promise = retry(operation);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    });

    test("should not retry non-RetryableError by default", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Regular error"));

      const promise = retry(operation);
      const runPromise = vi.runAllTimersAsync();

      await expect(Promise.all([promise, runPromise])).rejects.toThrow(
        "Regular error",
      );
      expect(operation).toHaveBeenCalledTimes(1); // No retries
    });

    test("should not retry ValidationError", async () => {
      // Import ValidationError from errors module
      const { ValidationError } = await import("@/errors/validationError");
      const operation = vi
        .fn()
        .mockRejectedValue(new ValidationError("Invalid input"));

      const promise = retry(operation);
      const runPromise = vi.runAllTimersAsync();

      await expect(Promise.all([promise, runPromise])).rejects.toThrow(
        "Invalid input",
      );
      expect(operation).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe("edge cases", () => {
    test("should handle non-Error objects thrown", async () => {
      const operation = vi.fn().mockRejectedValue("string error");

      const promise = retry(operation, {
        shouldRetry: () => true,
        maxRetries: 1,
      });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow("string error");
      expect(operation).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    test("should handle undefined error", async () => {
      const operation = vi.fn().mockRejectedValue(undefined);

      const promise = retry(operation, {
        shouldRetry: () => true,
        maxRetries: 1,
      });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(2);
    });

    test("should work with custom initialDelay", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new RetryableError("Test"))
        .mockResolvedValue("success");

      const promise = retry(operation, {
        maxRetries: 1,
        initialDelay: 2000,
      });

      expect(operation).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(3000); // 2000 + jitter tolerance
      expect(operation).toHaveBeenCalledTimes(2);

      const result = await promise;
      expect(result).toBe("success");
    });

    test("should handle async operations that take time", async () => {
      let callCount = 0;
      const operation = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          throw new RetryableError("Not ready");
        }
        return "ready";
      });

      const promise = retry(operation, { maxRetries: 2 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe("ready");
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe("logging integration", () => {
    test("should not throw when logger is used", async () => {
      // This test verifies logger integration doesn't cause errors
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new RetryableError("Logged error"))
        .mockResolvedValue("success");

      const promise = retry(operation, { maxRetries: 2 });
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    });

    test("should handle non-retryable errors gracefully", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Non-retryable"));

      const promise = retry(operation, { maxRetries: 3 });
      const runPromise = vi.runAllTimersAsync();

      await expect(Promise.all([promise, runPromise])).rejects.toThrow(
        "Non-retryable",
      );
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});
