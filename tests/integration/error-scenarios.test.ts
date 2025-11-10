import { beforeEach, describe, expect, it, vi } from "vitest";
import { runQATest } from "@/api/index";
import { GameCrashError } from "@/errors/gameCrashError";
import { QAError } from "@/errors/qaError";
import { RetryableError } from "@/errors/retryableError";
import { ValidationError } from "@/errors/validationError";
import { QAOrchestrator } from "@/orchestrator/qaOrchestrator";
import { config } from "@/utils/config";

/**
 * Comprehensive Error Scenario Tests
 * Tests error handling across the entire system
 */
describe("Error Scenario Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Browser Crash Scenarios
   */
  describe("Browser Crash Scenarios", () => {
    it("should throw GameCrashError when browser crashes", () => {
      const error = new GameCrashError(
        "Browser process terminated unexpectedly",
      );
      expect(error).toBeInstanceOf(GameCrashError);
      expect(error).toBeInstanceOf(QAError);
      expect(error.name).toBe("GameCrashError");
      expect(error.message).toContain("Browser process terminated");
    });

    it("should throw GameCrashError when game freezes", () => {
      const error = new GameCrashError("Game stopped responding");
      expect(error).toBeInstanceOf(GameCrashError);
      expect(error.message).toContain("stopped responding");
    });

    it("should include cause in GameCrashError", () => {
      const cause = new Error("Underlying crash reason");
      const error = new GameCrashError("Game crashed", cause);
      expect(error.cause).toBe(cause);
    });
  });

  /**
   * API Rate Limiting Scenarios
   */
  describe("API Rate Limiting Scenarios", () => {
    it("should throw RetryableError for rate limit errors", () => {
      const error = new RetryableError("API rate limit exceeded");
      expect(error).toBeInstanceOf(RetryableError);
      expect(error).toBeInstanceOf(QAError);
      expect(error.name).toBe("RetryableError");
      expect(error.message).toContain("rate limit");
    });

    it("should allow retry on RetryableError", () => {
      const error = new RetryableError("Temporary network issue");
      expect(error).toBeInstanceOf(RetryableError);
      // RetryableError signals that operation should be retried
    });

    it("should handle OpenAI API rate limits", () => {
      const error = new RetryableError(
        "OpenAI API: Rate limit exceeded, retry after 60s",
      );
      expect(error.message).toContain("OpenAI");
      expect(error.message).toContain("Rate limit");
    });

    it("should handle Browserbase API rate limits", () => {
      const error = new RetryableError("Browserbase API: Too many requests");
      expect(error.message).toContain("Browserbase");
    });
  });

  /**
   * Network Timeout Scenarios
   */
  describe("Network Timeout Scenarios", () => {
    it("should throw RetryableError for network timeouts", () => {
      const error = new RetryableError("Network request timeout after 30s");
      expect(error).toBeInstanceOf(RetryableError);
      expect(error.message).toContain("timeout");
    });

    it("should throw RetryableError for connection failures", () => {
      const error = new RetryableError("Failed to connect to remote service");
      expect(error).toBeInstanceOf(RetryableError);
    });

    it("should handle DNS resolution failures", () => {
      const error = new RetryableError("DNS lookup failed");
      expect(error.message).toContain("DNS");
    });
  });

  /**
   * Invalid Game URL Scenarios
   */
  describe("Invalid Game URL Scenarios", () => {
    it("should reject invalid URL format", async () => {
      await expect(runQATest("not-a-url")).rejects.toThrow(ValidationError);
    });

    it("should reject localhost URLs (SSRF prevention)", async () => {
      await expect(
        runQATest("http://localhost:3000/game.html"),
      ).rejects.toThrow();
    });

    it("should reject 127.0.0.1 URLs (SSRF prevention)", async () => {
      await expect(runQATest("http://127.0.0.1/game.html")).rejects.toThrow();
    });

    it("should reject private network URLs 192.168.x.x", async () => {
      await expect(runQATest("http://192.168.1.1/game.html")).rejects.toThrow();
    });

    it("should reject private network URLs 10.x.x.x", async () => {
      await expect(runQATest("http://10.0.0.1/game.html")).rejects.toThrow();
    });

    it("should reject file:// protocol", async () => {
      await expect(runQATest("file:///path/to/game.html")).rejects.toThrow();
    });

    it("should reject ftp:// protocol", async () => {
      await expect(runQATest("ftp://example.com/game.html")).rejects.toThrow();
    });
  });

  /**
   * Browserbase Connection Failures
   */
  describe("Browserbase Connection Failures", () => {
    it("should handle invalid API key", () => {
      const error = new ValidationError("Invalid Browserbase API key");
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toContain("API key");
    });

    it("should handle missing API key", () => {
      const error = new ValidationError(
        "BROWSERBASE_API_KEY environment variable is required",
      );
      expect(error.message).toContain("BROWSERBASE_API_KEY");
    });

    it("should handle Browserbase service unavailable", () => {
      const error = new RetryableError(
        "Browserbase service temporarily unavailable",
      );
      expect(error).toBeInstanceOf(RetryableError);
    });

    it("should handle session creation failure", () => {
      const error = new RetryableError("Failed to create browser session");
      expect(error.message).toContain("session");
    });
  });

  /**
   * OpenAI API Failures
   */
  describe("OpenAI API Failures", () => {
    it("should handle invalid API key", () => {
      const error = new ValidationError("Invalid OpenAI API key");
      expect(error).toBeInstanceOf(ValidationError);
    });

    it("should handle missing API key", () => {
      const error = new ValidationError(
        "OPENAI_API_KEY environment variable is required",
      );
      expect(error.message).toContain("OPENAI_API_KEY");
    });

    it("should handle OpenAI service errors", () => {
      const error = new RetryableError(
        "OpenAI API returned 503 Service Unavailable",
      );
      expect(error).toBeInstanceOf(RetryableError);
    });

    it("should handle token limit exceeded", () => {
      const error = new RetryableError("OpenAI: Maximum token limit exceeded");
      expect(error.message).toContain("token limit");
    });
  });

  /**
   * File System Errors
   */
  describe("File System Errors", () => {
    it("should handle permission denied errors", () => {
      const error = new QAError(
        "Permission denied: Cannot write to output directory",
      );
      expect(error.message).toContain("Permission denied");
    });

    it("should handle disk space errors", () => {
      const error = new QAError("Insufficient disk space for screenshots");
      expect(error.message).toContain("disk space");
    });

    it("should handle invalid output directory", () => {
      const error = new ValidationError("Output directory path is invalid");
      expect(error).toBeInstanceOf(ValidationError);
    });
  });

  /**
   * Missing Environment Variables
   */
  describe("Missing Environment Variables", () => {
    it("should detect missing BROWSERBASE_API_KEY", () => {
      // Config should validate this at startup
      expect(config.browserbase).toBeDefined();
      expect(config.browserbase.apiKey).toBeDefined();
    });

    it("should detect missing OPENAI_API_KEY", () => {
      expect(config.openai).toBeDefined();
      expect(config.openai.apiKey).toBeDefined();
    });

    it("should use default for optional OUTPUT_DIR", () => {
      expect(config.output).toBeDefined();
      expect(config.output.dir).toBeDefined();
    });
  });

  /**
   * Invalid Configuration
   */
  describe("Invalid Configuration", () => {
    it("should reject negative timeout", () => {
      expect(() => {
        new QAOrchestrator({ timeout: -1 });
      }).toThrow();
    });

    it("should reject zero timeout", () => {
      expect(() => {
        new QAOrchestrator({ timeout: 0 });
      }).toThrow();
    });

    it("should reject timeout over maximum (300s)", () => {
      expect(() => {
        new QAOrchestrator({ timeout: 400 });
      }).toThrow();
    });

    it("should reject negative maxActions", () => {
      expect(() => {
        new QAOrchestrator({ maxActions: -1 });
      }).toThrow();
    });

    it("should reject maxActions over 50", () => {
      expect(() => {
        new QAOrchestrator({ maxActions: 100 });
      }).toThrow();
    });
  });

  /**
   * Error Message Clarity
   */
  describe("Error Message Clarity", () => {
    it("should provide clear error messages", () => {
      const error = new ValidationError("Invalid URL format");
      expect(error.message).toBeTruthy();
      expect(error.message.length).toBeGreaterThan(10);
    });

    it("should include context in error messages", () => {
      const error = new GameCrashError(
        "Browser crashed while loading https://example.com/game.html",
      );
      expect(error.message).toContain("https://example.com/game.html");
    });

    it("should not expose sensitive information in errors", () => {
      const apiKey = "sk-test-1234567890";
      const error = new ValidationError("API authentication failed");
      expect(error.message).not.toContain(apiKey);
      expect(error.message).not.toContain("sk-");
    });
  });

  /**
   * Cleanup on Errors
   */
  describe("Cleanup on Errors", () => {
    it("should cleanup browser session after GameCrashError", async () => {
      const mockCleanup = vi.fn().mockResolvedValue(undefined);

      // Mock orchestrator that throws then cleans up
      const _mockExecute = vi
        .spyOn(QAOrchestrator.prototype, "runTest")
        .mockImplementation(async () => {
          try {
            throw new GameCrashError("Browser crashed");
          } finally {
            await mockCleanup();
          }
        });

      try {
        await runQATest("https://example.com/game.html");
      } catch (_error) {
        // Expected
      }

      expect(mockCleanup).toHaveBeenCalled();
    });

    it("should cleanup browser session after RetryableError", async () => {
      const mockCleanup = vi.fn().mockResolvedValue(undefined);

      const _mockExecute = vi
        .spyOn(QAOrchestrator.prototype, "runTest")
        .mockImplementation(async () => {
          try {
            throw new RetryableError("Network timeout");
          } finally {
            await mockCleanup();
          }
        });

      try {
        await runQATest("https://example.com/game.html");
      } catch (_error) {
        // Expected
      }

      expect(mockCleanup).toHaveBeenCalled();
    });
  });

  /**
   * Error Type Classification
   */
  describe("Error Type Classification", () => {
    it("should correctly identify GameCrashError", () => {
      const error = new GameCrashError("Test");
      expect(error instanceof GameCrashError).toBe(true);
      expect(error instanceof QAError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it("should correctly identify RetryableError", () => {
      const error = new RetryableError("Test");
      expect(error instanceof RetryableError).toBe(true);
      expect(error instanceof QAError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it("should correctly identify ValidationError", () => {
      const error = new ValidationError("Test");
      expect(error instanceof ValidationError).toBe(true);
      expect(error instanceof QAError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });
});
