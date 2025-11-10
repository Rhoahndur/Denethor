/**
 * Unit tests for Programmatic API.
 *
 * Tests the main API exports, wrapper function, and type exports.
 */

import { describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/orchestrator/qaOrchestrator", () => ({
  QAOrchestrator: vi.fn().mockImplementation(() => ({
    runTest: vi.fn().mockResolvedValue({
      report: {
        meta: {
          testId: "test-123",
          gameUrl: "https://example.com/game",
          timestamp: "2025-11-03T12:00:00Z",
          duration: 45,
          agentVersion: "1.0.0",
          browserSettings: {
            browser: "chrome",
            viewport: { width: 1280, height: 720 },
            arguments: [],
            device: "desktop",
            locale: "en-US",
          },
        },
        status: "success",
        scores: {
          loadSuccess: 100,
          responsiveness: 85,
          stability: 90,
          overallPlayability: 88,
        },
        evaluation: {
          reasoning: "Game loaded and played well",
          confidence: 95,
        },
        issues: [],
        evidence: {
          screenshots: [],
          logs: {
            console: "",
            actions: "",
            errors: "",
          },
        },
        actions: [],
      },
      reportPaths: {
        json: "/output/report.json",
        markdown: "/output/report.md",
        html: "/output/report.html",
      },
    }),
  })),
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

describe("Programmatic API", () => {
  describe("exports", () => {
    it("should export QAOrchestrator", async () => {
      const { QAOrchestrator } = await import("./index");
      expect(QAOrchestrator).toBeDefined();
    });

    it("should export runQATest wrapper function", async () => {
      const { runQATest } = await import("./index");
      expect(runQATest).toBeDefined();
      expect(typeof runQATest).toBe("function");
    });

    it("should export component classes", async () => {
      const { EvidenceStore, BrowserAgent, AIEvaluator, ReportGenerator } =
        await import("./index");
      expect(EvidenceStore).toBeDefined();
      expect(BrowserAgent).toBeDefined();
      expect(AIEvaluator).toBeDefined();
      expect(ReportGenerator).toBeDefined();
    });

    it("should export error classes", async () => {
      const { QAError, ValidationError, GameCrashError, RetryableError } =
        await import("./index");
      expect(QAError).toBeDefined();
      expect(ValidationError).toBeDefined();
      expect(GameCrashError).toBeDefined();
      expect(RetryableError).toBeDefined();
    });

    it("should have default export", async () => {
      const defaultExport = await import("./index");
      expect(defaultExport.default).toBeDefined();
      expect(typeof defaultExport.default).toBe("function");
    });
  });

  describe("runQATest wrapper function", () => {
    it("should accept gameUrl as minimum parameter", async () => {
      const { runQATest } = await import("./index");
      expect(() => {
        runQATest("https://example.com/game");
      }).not.toThrow();
    });

    it("should accept optional configuration", async () => {
      const { runQATest } = await import("./index");
      expect(() => {
        runQATest("https://example.com/game", {
          outputDir: "./custom-output",
          maxActions: 15,
          sessionTimeout: 60000,
        });
      }).not.toThrow();
    });

    it("should return promise", async () => {
      const { runQATest } = await import("./index");
      const result = runQATest("https://example.com/game");
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe("API usage patterns", () => {
    it("should support simple usage pattern", async () => {
      const { runQATest } = await import("./index");
      // Simple pattern: just provide URL
      const result = await runQATest("https://example.com/game");
      expect(result).toBeDefined();
      expect(result.report).toBeDefined();
      expect(result.reportPaths).toBeDefined();
    });

    it("should support advanced usage pattern", async () => {
      const { QAOrchestrator } = await import("./index");
      // Advanced pattern: use QAOrchestrator directly
      const orchestrator = new QAOrchestrator({
        gameUrl: "https://example.com/game",
        maxActions: 20,
      });
      expect(orchestrator).toBeDefined();
    });

    it("should support options pattern", async () => {
      const { runQATest } = await import("./index");
      // With options
      const result = await runQATest("https://example.com/game", {
        outputDir: "./results",
        maxActions: 10,
      });
      expect(result).toBeDefined();
    });
  });
});
