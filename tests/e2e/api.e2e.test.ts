import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runQATest } from "@/api/index";
import { GameCrashError } from "@/errors/gameCrashError";
import { RetryableError } from "@/errors/retryableError";
import { ValidationError } from "@/errors/validationError";
import { QAOrchestrator } from "@/orchestrator/qaOrchestrator";
import { sampleQAReport } from "../fixtures/sample-evidence";

/**
 * End-to-End API Tests
 * Tests the programmatic API usage with mocked external services
 */
describe("Programmatic API End-to-End Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should export runQATest function", () => {
    expect(typeof runQATest).toBe("function");
  });

  it("should validate URL before processing", async () => {
    await expect(runQATest("not-a-valid-url")).rejects.toThrow(ValidationError);
  });

  it("should reject localhost URLs (SSRF protection)", async () => {
    await expect(
      runQATest("http://localhost:8080/game.html"),
    ).rejects.toThrow();
  });

  it("should reject private IP URLs (SSRF protection)", async () => {
    await expect(runQATest("http://192.168.1.1/game.html")).rejects.toThrow();
    await expect(runQATest("http://10.0.0.1/game.html")).rejects.toThrow();
  });

  it("should accept valid HTTP URLs", async () => {
    // Mock the orchestrator execute method
    const mockExecute = vi
      .spyOn(QAOrchestrator.prototype, "runTest")
      .mockResolvedValue(sampleQAReport);

    const result = await runQATest("http://example.com/game.html");

    expect(mockExecute).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.meta.gameUrl).toBe("http://example.com/game.html");
  });

  it("should accept valid HTTPS URLs", async () => {
    const mockExecute = vi
      .spyOn(QAOrchestrator.prototype, "runTest")
      .mockResolvedValue(sampleQAReport);

    const result = await runQATest("https://example.com/game.html");

    expect(mockExecute).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.meta.gameUrl).toBe("https://example.com/game.html");
  });

  it("should return QAReport with correct structure", async () => {
    const _mockExecute = vi
      .spyOn(QAOrchestrator.prototype, "runTest")
      .mockResolvedValue(sampleQAReport);

    const result = await runQATest("https://example.com/game.html");

    // Verify QAReport structure
    expect(result).toHaveProperty("meta");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("scores");
    expect(result).toHaveProperty("evaluation");
    expect(result).toHaveProperty("issues");
    expect(result).toHaveProperty("evidence");
    expect(result).toHaveProperty("actions");

    // Verify meta structure
    expect(result.meta).toHaveProperty("testId");
    expect(result.meta).toHaveProperty("gameUrl");
    expect(result.meta).toHaveProperty("timestamp");
    expect(result.meta).toHaveProperty("duration");
    expect(result.meta).toHaveProperty("agentVersion");

    // Verify scores structure
    expect(result.scores).toHaveProperty("loadSuccess");
    expect(result.scores).toHaveProperty("responsiveness");
    expect(result.scores).toHaveProperty("stability");
    expect(result.scores).toHaveProperty("overallPlayability");
  });

  it("should accept options parameter", async () => {
    const mockExecute = vi
      .spyOn(QAOrchestrator.prototype, "runTest")
      .mockResolvedValue(sampleQAReport);

    const options = {
      outputDir: "./qa-tests/test-output",
      formats: ["json", "markdown"] as ("json" | "markdown" | "html")[],
      timeout: 120,
      maxActions: 10,
    };

    await runQATest("https://example.com/game.html", options);

    expect(mockExecute).toHaveBeenCalled();
  });

  it("should use default options when not provided", async () => {
    const mockExecute = vi
      .spyOn(QAOrchestrator.prototype, "runTest")
      .mockResolvedValue(sampleQAReport);

    await runQATest("https://example.com/game.html");

    expect(mockExecute).toHaveBeenCalled();
  });

  it("should propagate GameCrashError", async () => {
    const _mockExecute = vi
      .spyOn(QAOrchestrator.prototype, "runTest")
      .mockRejectedValue(new GameCrashError("Game crashed during test"));

    await expect(runQATest("https://example.com/game.html")).rejects.toThrow(
      GameCrashError,
    );
  });

  it("should propagate RetryableError", async () => {
    const _mockExecute = vi
      .spyOn(QAOrchestrator.prototype, "runTest")
      .mockRejectedValue(new RetryableError("Network timeout"));

    await expect(runQATest("https://example.com/game.html")).rejects.toThrow(
      RetryableError,
    );
  });
});

/**
 * QAOrchestrator Class Direct Usage Tests
 */
describe("QAOrchestrator Direct Usage Tests", () => {
  it("should allow direct instantiation of QAOrchestrator", () => {
    const orchestrator = new QAOrchestrator();
    expect(orchestrator).toBeDefined();
    expect(orchestrator).toBeInstanceOf(QAOrchestrator);
  });

  it("should have execute method", () => {
    const orchestrator = new QAOrchestrator();
    expect(typeof orchestrator.execute).toBe("function");
  });

  it("should handle configuration options", async () => {
    const mockExecute = vi
      .spyOn(QAOrchestrator.prototype, "runTest")
      .mockResolvedValue(sampleQAReport);

    const orchestrator = new QAOrchestrator({
      outputDir: "./qa-tests/test-output",
      timeout: 120,
      maxActions: 15,
    });

    const result = await orchestrator.execute("https://example.com/game.html");

    expect(result).toBeDefined();
    expect(mockExecute).toHaveBeenCalled();
  });
});

/**
 * API Error Handling Tests
 */
describe("API Error Handling", () => {
  it("should provide clear error messages for validation failures", async () => {
    try {
      await runQATest("invalid-url");
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBeTruthy();
      expect(error.message.length).toBeGreaterThan(0);
    }
  });

  it("should handle missing environment variables", async () => {
    // Temporarily unset API key
    const originalKey = process.env.BROWSERBASE_API_KEY;
    delete process.env.BROWSERBASE_API_KEY;

    try {
      await runQATest("https://example.com/game.html");
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error).toBeDefined();
    } finally {
      // Restore
      if (originalKey) {
        process.env.BROWSERBASE_API_KEY = originalKey;
      }
    }
  });

  it("should handle timeout errors gracefully", async () => {
    const _mockExecute = vi
      .spyOn(QAOrchestrator.prototype, "runTest")
      .mockRejectedValue(new Error("Test execution timeout"));

    await expect(runQATest("https://example.com/game.html")).rejects.toThrow(
      "Test execution timeout",
    );
  });
});

/**
 * API Response Format Tests
 */
describe("API Response Format", () => {
  it("should return scores as numbers", async () => {
    const _mockExecute = vi
      .spyOn(QAOrchestrator.prototype, "runTest")
      .mockResolvedValue(sampleQAReport);

    const result = await runQATest("https://example.com/game.html");

    expect(typeof result.scores.loadSuccess).toBe("number");
    expect(typeof result.scores.responsiveness).toBe("number");
    expect(typeof result.scores.stability).toBe("number");
    expect(typeof result.scores.overallPlayability).toBe("number");
  });

  it("should return scores in valid range (0-100)", async () => {
    const _mockExecute = vi
      .spyOn(QAOrchestrator.prototype, "runTest")
      .mockResolvedValue(sampleQAReport);

    const result = await runQATest("https://example.com/game.html");

    expect(result.scores.loadSuccess).toBeGreaterThanOrEqual(0);
    expect(result.scores.loadSuccess).toBeLessThanOrEqual(100);
    expect(result.scores.responsiveness).toBeGreaterThanOrEqual(0);
    expect(result.scores.responsiveness).toBeLessThanOrEqual(100);
    expect(result.scores.stability).toBeGreaterThanOrEqual(0);
    expect(result.scores.stability).toBeLessThanOrEqual(100);
    expect(result.scores.overallPlayability).toBeGreaterThanOrEqual(0);
    expect(result.scores.overallPlayability).toBeLessThanOrEqual(100);
  });

  it("should return issues as array", async () => {
    const _mockExecute = vi
      .spyOn(QAOrchestrator.prototype, "runTest")
      .mockResolvedValue(sampleQAReport);

    const result = await runQATest("https://example.com/game.html");

    expect(Array.isArray(result.issues)).toBe(true);
  });

  it("should return actions as array", async () => {
    const _mockExecute = vi
      .spyOn(QAOrchestrator.prototype, "runTest")
      .mockResolvedValue(sampleQAReport);

    const result = await runQATest("https://example.com/game.html");

    expect(Array.isArray(result.actions)).toBe(true);
  });

  it("should return evidence with correct structure", async () => {
    const _mockExecute = vi
      .spyOn(QAOrchestrator.prototype, "runTest")
      .mockResolvedValue(sampleQAReport);

    const result = await runQATest("https://example.com/game.html");

    expect(result.evidence).toHaveProperty("screenshots");
    expect(result.evidence).toHaveProperty("logs");
    expect(Array.isArray(result.evidence.screenshots)).toBe(true);
    expect(result.evidence.logs).toHaveProperty("console");
    expect(result.evidence.logs).toHaveProperty("actions");
    expect(result.evidence.logs).toHaveProperty("errors");
  });
});
