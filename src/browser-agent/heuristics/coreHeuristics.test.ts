/**
 * Tests for core heuristic patterns.
 *
 * Verifies heuristic execution, action sequencing, confidence scoring,
 * and error handling for all game type patterns.
 */

import type { Page } from "@browserbasehq/stagehand";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLICKER_HEURISTIC,
  executeHeuristic,
  GENERIC_HEURISTIC,
  HEURISTICS,
  PLATFORMER_HEURISTIC,
  PUZZLE_HEURISTIC,
} from "./coreHeuristics";

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

describe("CoreHeuristics", () => {
  // Mock page object
  let mockPage: any;
  let mockMouseClick: any;
  let mockKeyboardPress: any;
  let mockPageClick: any;
  let mockScreenshot: any;
  let mockViewportSize: any;

  beforeEach(() => {
    // Reset mocks before each test
    mockMouseClick = vi.fn().mockResolvedValue(undefined);
    mockKeyboardPress = vi.fn().mockResolvedValue(undefined);
    mockPageClick = vi.fn().mockResolvedValue(undefined);
    mockScreenshot = vi.fn().mockResolvedValue(Buffer.from("screenshot-data"));
    mockViewportSize = vi.fn().mockReturnValue({ width: 1024, height: 768 });

    mockPage = {
      mouse: {
        click: mockMouseClick,
      },
      keyboard: {
        press: mockKeyboardPress,
      },
      click: mockPageClick,
      screenshot: mockScreenshot,
      viewportSize: mockViewportSize,
    } as unknown as Page;
  });

  describe("PLATFORMER_HEURISTIC", () => {
    it("should have correct name and triggers", () => {
      expect(PLATFORMER_HEURISTIC.name).toBe("platformer");
      expect(PLATFORMER_HEURISTIC.triggers).toContain("platformer");
      expect(PLATFORMER_HEURISTIC.triggers).toContain("jump");
    });

    it("should define action sequence with keyboard inputs", () => {
      const actions = PLATFORMER_HEURISTIC.actions;

      expect(actions).toContainEqual(
        expect.objectContaining({ type: "click", target: "center" }),
      );
      expect(actions).toContainEqual(
        expect.objectContaining({ type: "keyboard", value: "ArrowRight" }),
      );
      expect(actions).toContainEqual(
        expect.objectContaining({ type: "keyboard", value: "Space" }),
      );
      expect(actions).toContainEqual(
        expect.objectContaining({ type: "keyboard", value: "ArrowLeft" }),
      );
      expect(actions).toContainEqual(
        expect.objectContaining({ type: "screenshot" }),
      );
    });

    it("should return high confidence on successful execution", async () => {
      const results = [{ type: "screenshot" }];
      const result = await PLATFORMER_HEURISTIC.evaluate(mockPage, results);

      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
      expect(result.reasoning).toContain("platformer");
    });
  });

  describe("CLICKER_HEURISTIC", () => {
    it("should have correct name and triggers", () => {
      expect(CLICKER_HEURISTIC.name).toBe("clicker");
      expect(CLICKER_HEURISTIC.triggers).toContain("clicker");
      expect(CLICKER_HEURISTIC.triggers).toContain("idle");
    });

    it("should define action sequence with repeated clicks", () => {
      const actions = CLICKER_HEURISTIC.actions;
      const clickActions = actions.filter((a) => a.type === "click");

      expect(clickActions.length).toBeGreaterThanOrEqual(4);
      expect(actions).toContainEqual(
        expect.objectContaining({ type: "screenshot" }),
      );
      expect(actions).toContainEqual(expect.objectContaining({ type: "wait" }));
    });

    it("should return high confidence with multiple screenshots", async () => {
      const results = [{ type: "screenshot" }, { type: "screenshot" }];
      const result = await CLICKER_HEURISTIC.evaluate(mockPage, results);

      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(75);
      expect(result.reasoning).toContain("clicker");
    });

    it("should return lower confidence with fewer screenshots", async () => {
      const results = [{ type: "screenshot" }];
      const result = await CLICKER_HEURISTIC.evaluate(mockPage, results);

      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
    });
  });

  describe("PUZZLE_HEURISTIC", () => {
    it("should have correct name and triggers", () => {
      expect(PUZZLE_HEURISTIC.name).toBe("puzzle");
      expect(PUZZLE_HEURISTIC.triggers).toContain("puzzle");
      expect(PUZZLE_HEURISTIC.triggers).toContain("match");
    });

    it("should define action sequence with varied clicks", () => {
      const actions = PUZZLE_HEURISTIC.actions;
      const clickActions = actions.filter((a) => a.type === "click");

      expect(clickActions.length).toBeGreaterThanOrEqual(3);
      expect(actions).toContainEqual(
        expect.objectContaining({ type: "screenshot" }),
      );
    });

    it("should return moderate confidence", async () => {
      const results = [{ type: "screenshot" }];
      const result = await PUZZLE_HEURISTIC.evaluate(mockPage, results);

      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(60);
      expect(result.confidence).toBeLessThanOrEqual(85);
    });
  });

  describe("GENERIC_HEURISTIC", () => {
    it("should have correct name and wildcard trigger", () => {
      expect(GENERIC_HEURISTIC.name).toBe("generic");
      expect(GENERIC_HEURISTIC.triggers).toContain("*");
    });

    it("should define action sequence with mixed inputs", () => {
      const actions = GENERIC_HEURISTIC.actions;

      expect(actions).toContainEqual(
        expect.objectContaining({ type: "click" }),
      );
      expect(actions).toContainEqual(
        expect.objectContaining({ type: "keyboard" }),
      );
      expect(actions).toContainEqual(
        expect.objectContaining({ type: "screenshot" }),
      );
    });

    it("should return lower confidence than specific patterns", async () => {
      const results = [{ type: "screenshot" }];
      const result = await GENERIC_HEURISTIC.evaluate(mockPage, results);

      expect(result.success).toBe(true);
      expect(result.confidence).toBeLessThanOrEqual(60);
    });
  });

  describe("executeHeuristic", () => {
    it("should execute all actions in sequence", async () => {
      const result = await executeHeuristic(mockPage, PLATFORMER_HEURISTIC);

      expect(mockMouseClick).toHaveBeenCalled(); // Center click
      expect(mockKeyboardPress).toHaveBeenCalledWith("ArrowRight");
      expect(mockKeyboardPress).toHaveBeenCalledWith("Space");
      expect(mockKeyboardPress).toHaveBeenCalledWith("ArrowLeft");
      expect(mockScreenshot).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should handle click actions with center target", async () => {
      const heuristic = {
        name: "test",
        triggers: ["test"],
        actions: [{ type: "click" as const, target: "center" }],
        evaluate: async () => ({
          success: true,
          confidence: 100,
          reasoning: "test",
          actions: [],
        }),
      };

      await executeHeuristic(mockPage, heuristic);

      expect(mockMouseClick).toHaveBeenCalledWith(512, 384); // Center of 1024x768
    });

    it("should handle click actions with offset target", async () => {
      const heuristic = {
        name: "test",
        triggers: ["test"],
        actions: [{ type: "click" as const, target: "offset:100,50" }],
        evaluate: async () => ({
          success: true,
          confidence: 100,
          reasoning: "test",
          actions: [],
        }),
      };

      await executeHeuristic(mockPage, heuristic);

      expect(mockMouseClick).toHaveBeenCalledWith(612, 434); // 512+100, 384+50
    });

    it("should handle click actions with negative offset", async () => {
      const heuristic = {
        name: "test",
        triggers: ["test"],
        actions: [{ type: "click" as const, target: "offset:-100,-50" }],
        evaluate: async () => ({
          success: true,
          confidence: 100,
          reasoning: "test",
          actions: [],
        }),
      };

      await executeHeuristic(mockPage, heuristic);

      expect(mockMouseClick).toHaveBeenCalledWith(412, 334); // 512-100, 384-50
    });

    it("should handle click actions with selector", async () => {
      const heuristic = {
        name: "test",
        triggers: ["test"],
        actions: [{ type: "click" as const, target: "#button" }],
        evaluate: async () => ({
          success: true,
          confidence: 100,
          reasoning: "test",
          actions: [],
        }),
      };

      await executeHeuristic(mockPage, heuristic);

      expect(mockPageClick).toHaveBeenCalledWith("#button");
    });

    it("should fall back to center click if selector fails", async () => {
      mockPageClick.mockRejectedValueOnce(new Error("Element not found"));

      const heuristic = {
        name: "test",
        triggers: ["test"],
        actions: [{ type: "click" as const, target: "#missing" }],
        evaluate: async () => ({
          success: true,
          confidence: 100,
          reasoning: "test",
          actions: [],
        }),
      };

      await executeHeuristic(mockPage, heuristic);

      expect(mockPageClick).toHaveBeenCalledWith("#missing");
      expect(mockMouseClick).toHaveBeenCalledWith(512, 384);
    });

    it("should handle keyboard actions", async () => {
      const heuristic = {
        name: "test",
        triggers: ["test"],
        actions: [{ type: "keyboard" as const, value: "Enter" }],
        evaluate: async () => ({
          success: true,
          confidence: 100,
          reasoning: "test",
          actions: [],
        }),
      };

      await executeHeuristic(mockPage, heuristic);

      expect(mockKeyboardPress).toHaveBeenCalledWith("Enter");
    });

    it("should handle wait actions", async () => {
      const startTime = Date.now();

      const heuristic = {
        name: "test",
        triggers: ["test"],
        actions: [{ type: "wait" as const, delay: 100 }],
        evaluate: async () => ({
          success: true,
          confidence: 100,
          reasoning: "test",
          actions: [],
        }),
      };

      await executeHeuristic(mockPage, heuristic);

      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow some margin
    });

    it("should capture screenshots", async () => {
      const heuristic = {
        name: "test",
        triggers: ["test"],
        actions: [{ type: "screenshot" as const }],
        evaluate: async () => ({
          success: true,
          confidence: 100,
          reasoning: "test",
          actions: [],
        }),
      };

      await executeHeuristic(mockPage, heuristic);

      expect(mockScreenshot).toHaveBeenCalled();
    });

    it("should respect action delays", async () => {
      const startTime = Date.now();

      const heuristic = {
        name: "test",
        triggers: ["test"],
        actions: [{ type: "click" as const, target: "center", delay: 100 }],
        evaluate: async () => ({
          success: true,
          confidence: 100,
          reasoning: "test",
          actions: [],
        }),
      };

      await executeHeuristic(mockPage, heuristic);

      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThanOrEqual(90);
    });

    it("should continue execution if individual action fails", async () => {
      mockKeyboardPress.mockRejectedValueOnce(new Error("Key press failed"));

      const result = await executeHeuristic(mockPage, PLATFORMER_HEURISTIC);

      // Should still complete and return result
      expect(result.success).toBe(true);
      expect(mockScreenshot).toHaveBeenCalled();
    });

    it("should return low confidence on complete failure", async () => {
      mockMouseClick.mockRejectedValue(new Error("Page closed"));
      mockKeyboardPress.mockRejectedValue(new Error("Page closed"));
      mockScreenshot.mockRejectedValue(new Error("Page closed"));

      const heuristic = {
        name: "test",
        triggers: ["test"],
        actions: [
          { type: "click" as const, target: "center" },
          { type: "keyboard" as const, value: "Space" },
          { type: "screenshot" as const },
        ],
        evaluate: vi.fn().mockRejectedValue(new Error("Evaluation failed")),
      };

      const result = await executeHeuristic(mockPage, heuristic as any);

      expect(result.success).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain("failed");
    });

    it("should call evaluate with collected results", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        success: true,
        confidence: 95,
        reasoning: "Great success",
        actions: [],
      });

      const heuristic = {
        name: "test",
        triggers: ["test"],
        actions: [
          { type: "click" as const, target: "center" },
          { type: "screenshot" as const },
        ],
        evaluate: mockEvaluate,
      };

      await executeHeuristic(mockPage, heuristic);

      expect(mockEvaluate).toHaveBeenCalledWith(
        mockPage,
        expect.arrayContaining([
          expect.objectContaining({ type: "click" }),
          expect.objectContaining({ type: "screenshot" }),
        ]),
      );
    });
  });

  describe("HEURISTICS collection", () => {
    it("should export all heuristic patterns", () => {
      expect(HEURISTICS.PLATFORMER).toBe(PLATFORMER_HEURISTIC);
      expect(HEURISTICS.CLICKER).toBe(CLICKER_HEURISTIC);
      expect(HEURISTICS.PUZZLE).toBe(PUZZLE_HEURISTIC);
      expect(HEURISTICS.GENERIC).toBe(GENERIC_HEURISTIC);
    });

    it("should have distinct names for all heuristics", () => {
      const names = Object.values(HEURISTICS).map((h) => h.name);
      const uniqueNames = new Set(names);

      expect(uniqueNames.size).toBe(names.length);
    });

    it("should have at least one action for each heuristic", () => {
      for (const heuristic of Object.values(HEURISTICS)) {
        expect(heuristic.actions.length).toBeGreaterThan(0);
      }
    });

    it("should have at least one trigger for each heuristic", () => {
      for (const heuristic of Object.values(HEURISTICS)) {
        expect(heuristic.triggers.length).toBeGreaterThan(0);
      }
    });
  });
});
