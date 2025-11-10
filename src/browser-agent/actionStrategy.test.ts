/**
 * Tests for Hybrid Action Strategy Orchestrator.
 *
 * Verifies layer coordination, confidence-based escalation,
 * and error handling across the 3-layer strategy.
 */

import type { Page } from "@browserbasehq/stagehand";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameCrashError } from "@/errors/gameCrashError";
import { executeHybridStrategy, type StrategyContext } from "./actionStrategy";
import { executeHeuristic } from "./heuristics/coreHeuristics";

// Mock logger
vi.mock("@/utils/logger", () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

// Mock heuristics
vi.mock("./heuristics/coreHeuristics", () => ({
  executeHeuristic: vi.fn(),
  HEURISTICS: {
    PLATFORMER: { name: "platformer", triggers: [], actions: [] },
    CLICKER: { name: "clicker", triggers: [], actions: [] },
    PUZZLE: { name: "puzzle", triggers: [], actions: [] },
    GENERIC: { name: "generic", triggers: [], actions: [] },
  },
}));

// Create a module-level mock for analyzeScreenshot
const mockAnalyzeScreenshotFn = vi.fn();

// Mock vision analyzer
vi.mock("./visionAnalyzer", () => {
  return {
    VisionAnalyzer: class MockVisionAnalyzer {
      analyzeScreenshot = mockAnalyzeScreenshotFn;
    },
  };
});

describe("ActionStrategy", () => {
  let mockPage: any;
  let mockContext: StrategyContext;
  let mockExecuteHeuristic: ReturnType<typeof vi.fn>;
  let mockAnalyzeScreenshot: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Get mocked functions
    mockExecuteHeuristic = executeHeuristic as ReturnType<typeof vi.fn>;
    mockAnalyzeScreenshot = mockAnalyzeScreenshotFn;

    // Create mock page
    mockPage = {
      screenshot: vi.fn().mockResolvedValue(Buffer.from("screenshot")),
    } as unknown as Page;

    // Create default context
    mockContext = {
      attempt: 1,
    };
  });

  describe("Layer 1 - Heuristics", () => {
    it("should return Layer 1 result when confidence > 80%", async () => {
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 85,
        reasoning: "Heuristic matched pattern",
        actions: [
          { type: "click", target: "center" },
          { type: "keyboard", value: "Space" },
        ],
      });

      const result = await executeHybridStrategy(mockPage, mockContext);

      expect(result.layer).toBe(1);
      expect(result.confidence).toBe(85);
      expect(result.actionType).toBe("click");
      expect(result.target).toBe("center");
      expect(mockExecuteHeuristic).toHaveBeenCalledTimes(1);
      expect(mockAnalyzeScreenshot).not.toHaveBeenCalled(); // No escalation
    });

    it("should select PLATFORMER heuristic for platformer game type", async () => {
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 85,
        reasoning: "Platformer pattern",
        actions: [{ type: "keyboard", value: "ArrowRight" }],
      });

      await executeHybridStrategy(mockPage, {
        ...mockContext,
        gameType: "platformer",
      });

      expect(mockExecuteHeuristic).toHaveBeenCalledWith(
        mockPage,
        expect.objectContaining({ name: "platformer" }),
      );
    });

    it("should select CLICKER heuristic for clicker game type", async () => {
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 90,
        reasoning: "Clicker pattern",
        actions: [{ type: "click", target: "center" }],
      });

      await executeHybridStrategy(mockPage, {
        ...mockContext,
        gameType: "clicker",
      });

      expect(mockExecuteHeuristic).toHaveBeenCalledWith(
        mockPage,
        expect.objectContaining({ name: "clicker" }),
      );
    });

    it("should select CLICKER heuristic for idle game type", async () => {
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 90,
        reasoning: "Clicker pattern",
        actions: [{ type: "click", target: "center" }],
      });

      await executeHybridStrategy(mockPage, {
        ...mockContext,
        gameType: "idle",
      });

      expect(mockExecuteHeuristic).toHaveBeenCalledWith(
        mockPage,
        expect.objectContaining({ name: "clicker" }),
      );
    });

    it("should select PUZZLE heuristic for puzzle game type", async () => {
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 85, // Above 80 threshold to return from Layer 1
        reasoning: "Puzzle pattern",
        actions: [{ type: "click", target: "tile-1" }],
      });

      await executeHybridStrategy(mockPage, {
        ...mockContext,
        gameType: "puzzle",
      });

      expect(mockExecuteHeuristic).toHaveBeenCalledWith(
        mockPage,
        expect.objectContaining({ name: "puzzle" }),
      );
    });

    it("should select GENERIC heuristic when game type is unknown", async () => {
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 85,
        reasoning: "Generic pattern",
        actions: [{ type: "click", target: "center" }],
      });

      await executeHybridStrategy(mockPage, {
        ...mockContext,
        gameType: undefined,
      });

      expect(mockExecuteHeuristic).toHaveBeenCalledWith(
        mockPage,
        expect.objectContaining({ name: "generic" }),
      );
    });

    it("should handle confidence exactly at threshold (80%)", async () => {
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 80,
        reasoning: "Exactly at threshold",
        actions: [{ type: "click", target: "center" }],
      });

      // Confidence = 80 is NOT > 80, so should escalate
      mockAnalyzeScreenshot.mockResolvedValue({
        nextAction: "Vision action",
        actionType: "click",
        confidence: 75,
        reasoning: "Vision analysis",
      });

      const result = await executeHybridStrategy(mockPage, mockContext);

      expect(result.layer).toBe(2); // Escalated to Layer 2
      expect(mockAnalyzeScreenshot).toHaveBeenCalled();
    });
  });

  describe("Layer 1 → Layer 2 Escalation", () => {
    it("should escalate to Layer 2 when confidence < 80%", async () => {
      // Layer 1: Low confidence
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 70, // Below 80%
        reasoning: "Uncertain heuristic",
        actions: [{ type: "click", target: "center" }],
      });

      // Layer 2: High confidence
      mockAnalyzeScreenshot.mockResolvedValue({
        nextAction: "Click the start button",
        actionType: "click",
        targetDescription: "Start button",
        confidence: 85,
        reasoning: "Vision identified start button",
      });

      const result = await executeHybridStrategy(mockPage, mockContext);

      expect(result.layer).toBe(2);
      expect(result.confidence).toBe(85);
      expect(result.action).toBe("Click the start button");
      expect(mockExecuteHeuristic).toHaveBeenCalledTimes(1);
      expect(mockAnalyzeScreenshot).toHaveBeenCalledTimes(1);
    });

    it("should escalate to Layer 2 when Layer 1 fails", async () => {
      // Layer 1: Error
      mockExecuteHeuristic.mockRejectedValue(new Error("Heuristic failed"));

      // Layer 2: Success
      mockAnalyzeScreenshot.mockResolvedValue({
        nextAction: "Press space",
        actionType: "keyboard",
        confidence: 80,
        reasoning: "Vision fallback",
      });

      const result = await executeHybridStrategy(mockPage, mockContext);

      expect(result.layer).toBe(2);
      expect(result.confidence).toBe(80);
    });

    it("should pass context to vision analyzer", async () => {
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 60,
        reasoning: "Low confidence",
        actions: [],
      });

      mockAnalyzeScreenshot.mockResolvedValue({
        nextAction: "Action",
        actionType: "click",
        confidence: 75,
        reasoning: "Reasoning",
      });

      const contextWithHistory: StrategyContext = {
        attempt: 2,
        previousAction: "Clicked center",
        gameState: "Playing",
        gameType: "platformer",
      };

      await executeHybridStrategy(mockPage, contextWithHistory);

      expect(mockAnalyzeScreenshot).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          previousAction: "Clicked center",
          gameState: "Playing",
          attempt: 2,
        }),
      );
    });
  });

  describe("Layer 2 - Vision Analysis", () => {
    it("should return Layer 2 result when confidence > 70%", async () => {
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 50,
        reasoning: "Low confidence",
        actions: [],
      });

      mockAnalyzeScreenshot.mockResolvedValue({
        nextAction: "Click play button",
        actionType: "click",
        targetDescription: "Play button",
        confidence: 75,
        reasoning: "Clear play button visible",
      });

      const result = await executeHybridStrategy(mockPage, mockContext);

      expect(result.layer).toBe(2);
      expect(result.confidence).toBe(75);
      expect(result.action).toBe("Click play button");
      expect(result.target).toBe("Play button");
    });

    it("should handle confidence exactly at threshold (70%)", async () => {
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 50,
        reasoning: "Low confidence",
        actions: [],
      });

      mockAnalyzeScreenshot.mockResolvedValue({
        nextAction: "Action",
        actionType: "click",
        confidence: 70, // Exactly at threshold
        reasoning: "At threshold",
      });

      // Confidence = 70 is NOT > 70, so should throw
      await expect(
        executeHybridStrategy(mockPage, mockContext),
      ).rejects.toThrow(GameCrashError);
    });

    it("should capture screenshot for vision analysis", async () => {
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 60,
        reasoning: "Low confidence",
        actions: [],
      });

      mockAnalyzeScreenshot.mockResolvedValue({
        nextAction: "Action",
        actionType: "click",
        confidence: 75,
        reasoning: "Reasoning",
      });

      await executeHybridStrategy(mockPage, mockContext);

      expect(mockPage.screenshot).toHaveBeenCalled();
      expect(mockAnalyzeScreenshot).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.any(Object),
      );
    });
  });

  describe("Layer 2 → Layer 3 Escalation", () => {
    it("should throw GameCrashError when Layer 2 confidence < 70%", async () => {
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 60,
        reasoning: "Low confidence",
        actions: [],
      });

      mockAnalyzeScreenshot.mockResolvedValue({
        nextAction: "Uncertain action",
        actionType: "unknown",
        confidence: 50, // Below 70%
        reasoning: "Unable to determine",
      });

      await expect(
        executeHybridStrategy(mockPage, mockContext),
      ).rejects.toThrow(GameCrashError);

      await expect(
        executeHybridStrategy(mockPage, mockContext),
      ).rejects.toThrow(
        "Unable to determine next action after trying all available layers",
      );
    });

    it("should throw GameCrashError when Layer 2 fails", async () => {
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 60,
        reasoning: "Low confidence",
        actions: [],
      });

      mockAnalyzeScreenshot.mockRejectedValue(new Error("Vision API failed"));

      await expect(
        executeHybridStrategy(mockPage, mockContext),
      ).rejects.toThrow(GameCrashError);
    });

    it("should throw GameCrashError when all layers fail", async () => {
      mockExecuteHeuristic.mockRejectedValue(new Error("Layer 1 failed"));
      mockAnalyzeScreenshot.mockRejectedValue(new Error("Layer 2 failed"));

      await expect(
        executeHybridStrategy(mockPage, mockContext),
      ).rejects.toThrow(GameCrashError);
    });
  });

  describe("Action Type Handling", () => {
    it("should handle click action type from Layer 1", async () => {
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 85,
        reasoning: "Click action",
        actions: [{ type: "click", target: "#button" }],
      });

      const result = await executeHybridStrategy(mockPage, mockContext);

      expect(result.actionType).toBe("click");
      expect(result.target).toBe("#button");
    });

    it("should handle keyboard action type from Layer 1", async () => {
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 85,
        reasoning: "Keyboard action",
        actions: [{ type: "keyboard", value: "Space" }],
      });

      const result = await executeHybridStrategy(mockPage, mockContext);

      expect(result.actionType).toBe("keyboard");
    });

    it("should handle wait action type from Layer 2", async () => {
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 50,
        reasoning: "Low confidence",
        actions: [],
      });

      mockAnalyzeScreenshot.mockResolvedValue({
        nextAction: "Wait for loading",
        actionType: "wait",
        confidence: 90,
        reasoning: "Loading screen visible",
      });

      const result = await executeHybridStrategy(mockPage, mockContext);

      expect(result.actionType).toBe("wait");
    });

    it("should handle unknown action type", async () => {
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 85,
        reasoning: "Unknown action",
        actions: [],
      });

      const result = await executeHybridStrategy(mockPage, mockContext);

      expect(result.actionType).toBe("unknown");
    });
  });

  describe("Reasoning", () => {
    it("should include reasoning from Layer 1", async () => {
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 85,
        reasoning: "Platformer pattern matched well",
        actions: [{ type: "keyboard", value: "ArrowRight" }],
      });

      const result = await executeHybridStrategy(mockPage, mockContext);

      expect(result.reasoning).toBe("Platformer pattern matched well");
    });

    it("should include reasoning from Layer 2", async () => {
      mockExecuteHeuristic.mockResolvedValue({
        success: true,
        confidence: 60,
        reasoning: "Low confidence",
        actions: [],
      });

      mockAnalyzeScreenshot.mockResolvedValue({
        nextAction: "Action",
        actionType: "click",
        confidence: 80,
        reasoning: "Start button clearly visible in center",
      });

      const result = await executeHybridStrategy(mockPage, mockContext);

      expect(result.reasoning).toBe("Start button clearly visible in center");
    });
  });
});
