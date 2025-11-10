/**
 * Tests for Vision Analyzer.
 *
 * Verifies screenshot analysis, structured output, error handling,
 * and API integration for vision-based action recommendations.
 */

import { generateObject } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RetryableError } from "@/errors/retryableError";
import type { VisionContext, VisionResult } from "./visionAnalyzer";
import { VisionAnalyzer } from "./visionAnalyzer";

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

// Mock config
vi.mock("@/utils/config", () => ({
  config: {
    openai: {
      apiKey: "test-api-key",
    },
  },
}));

// Mock AI SDK
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn((model: string) => `openai-${model}`),
}));

describe("VisionAnalyzer", () => {
  let analyzer: VisionAnalyzer;
  let mockScreenshot: Buffer;
  let mockContext: VisionContext;
  let mockGenerateObject: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Get mocked function
    mockGenerateObject = vi.mocked(generateObject);

    // Create analyzer
    analyzer = new VisionAnalyzer();

    // Create mock screenshot
    mockScreenshot = Buffer.from("mock-screenshot-data");

    // Create mock context
    mockContext = {
      attempt: 1,
    };
  });

  describe("Constructor", () => {
    it("should create analyzer instance", () => {
      expect(analyzer).toBeInstanceOf(VisionAnalyzer);
    });
  });

  describe("analyzeScreenshot", () => {
    it("should analyze screenshot and return vision result", async () => {
      const mockResult: VisionResult = {
        nextAction: "Click the start button",
        actionType: "click",
        targetDescription: "Large green start button",
        confidence: 85,
        reasoning: "Game appears ready to start, start button is prominent",
      };

      mockGenerateObject.mockResolvedValue({
        object: mockResult,
      });

      const result = await analyzer.analyzeScreenshot(
        mockScreenshot,
        mockContext,
      );

      expect(result).toEqual(mockResult);
      expect(result.nextAction).toBe("Click the start button");
      expect(result.confidence).toBe(85);
      expect(result.actionType).toBe("click");
    });

    it("should convert screenshot to base64 data URL", async () => {
      const mockResult: VisionResult = {
        nextAction: "Test action",
        actionType: "click",
        confidence: 70,
        reasoning: "Test",
      };

      mockGenerateObject.mockResolvedValue({
        object: mockResult,
      });

      await analyzer.analyzeScreenshot(mockScreenshot, mockContext);

      // Verify generateObject was called with data URL
      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: "image",
                  image: expect.stringMatching(/^data:image\/png;base64,/),
                }),
              ]),
            }),
          ]),
        }),
      );

      // Verify base64 encoding
      const call = mockGenerateObject.mock.calls[0][0];
      const imageContent = call.messages[0].content.find(
        (c: any) => c.type === "image",
      );
      const base64 = imageContent.image.replace("data:image/png;base64,", "");
      const decoded = Buffer.from(base64, "base64").toString();

      expect(decoded).toBe("mock-screenshot-data");
    });

    it("should include context in prompt", async () => {
      const mockResult: VisionResult = {
        nextAction: "Test",
        actionType: "click",
        confidence: 70,
        reasoning: "Test",
      };

      mockGenerateObject.mockResolvedValue({
        object: mockResult,
      });

      const contextWithAction: VisionContext = {
        attempt: 2,
        previousAction: "Clicked center",
        gameState: "Loading",
      };

      await analyzer.analyzeScreenshot(mockScreenshot, contextWithAction);

      const call = mockGenerateObject.mock.calls[0][0];
      const textContent = call.messages[0].content.find(
        (c: any) => c.type === "text",
      );

      expect(textContent.text).toContain("Attempt: 2");
      expect(textContent.text).toContain("Previous Action: Clicked center");
      expect(textContent.text).toContain("Game State: Loading");
    });

    it("should use GPT-4o-mini model", async () => {
      const mockResult: VisionResult = {
        nextAction: "Test",
        actionType: "click",
        confidence: 70,
        reasoning: "Test",
      };

      mockGenerateObject.mockResolvedValue({
        object: mockResult,
      });

      await analyzer.analyzeScreenshot(mockScreenshot, mockContext);

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "openai-gpt-4o-mini",
        }),
      );
    });

    it("should include structured output schema", async () => {
      const mockResult: VisionResult = {
        nextAction: "Test",
        actionType: "click",
        confidence: 70,
        reasoning: "Test",
      };

      mockGenerateObject.mockResolvedValue({
        object: mockResult,
      });

      await analyzer.analyzeScreenshot(mockScreenshot, mockContext);

      expect(mockGenerateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          schema: expect.any(Object),
        }),
      );
    });
  });

  describe("Error Handling", () => {
    it("should throw RetryableError on rate limit (429)", async () => {
      mockGenerateObject.mockRejectedValue(
        new Error("Rate limit exceeded (429)"),
      );

      await expect(
        analyzer.analyzeScreenshot(mockScreenshot, mockContext),
      ).rejects.toThrow(RetryableError);

      await expect(
        analyzer.analyzeScreenshot(mockScreenshot, mockContext),
      ).rejects.toThrow("Vision API rate limit");
    });

    it("should throw RetryableError on rate limit message", async () => {
      mockGenerateObject.mockRejectedValue(
        new Error("You have exceeded your rate limit"),
      );

      await expect(
        analyzer.analyzeScreenshot(mockScreenshot, mockContext),
      ).rejects.toThrow(RetryableError);
    });

    it("should throw RetryableError on quota exceeded", async () => {
      mockGenerateObject.mockRejectedValue(new Error("Quota exceeded"));

      await expect(
        analyzer.analyzeScreenshot(mockScreenshot, mockContext),
      ).rejects.toThrow(RetryableError);
    });

    it("should throw Error on invalid API key (401)", async () => {
      mockGenerateObject.mockRejectedValue(new Error("Invalid API key (401)"));

      await expect(
        analyzer.analyzeScreenshot(mockScreenshot, mockContext),
      ).rejects.toThrow("Invalid OpenAI API key");

      await expect(
        analyzer.analyzeScreenshot(mockScreenshot, mockContext),
      ).rejects.not.toThrow(RetryableError);
    });

    it("should throw Error on unauthorized", async () => {
      mockGenerateObject.mockRejectedValue(new Error("Unauthorized API call"));

      await expect(
        analyzer.analyzeScreenshot(mockScreenshot, mockContext),
      ).rejects.toThrow("Invalid OpenAI API key");
    });

    it("should return low confidence on unknown errors", async () => {
      mockGenerateObject.mockRejectedValue(new Error("Network timeout"));

      const result = await analyzer.analyzeScreenshot(
        mockScreenshot,
        mockContext,
      );

      expect(result.confidence).toBe(0);
      expect(result.actionType).toBe("unknown");
      expect(result.reasoning).toContain("failed");
      expect(result.nextAction).toContain("Unable to analyze");
    });

    it("should handle non-Error thrown values", async () => {
      mockGenerateObject.mockRejectedValue("string error");

      const result = await analyzer.analyzeScreenshot(
        mockScreenshot,
        mockContext,
      );

      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain("string error");
    });
  });

  describe("Vision Result Types", () => {
    it("should support click action type", async () => {
      const mockResult: VisionResult = {
        nextAction: "Click play button",
        actionType: "click",
        targetDescription: "Play button",
        confidence: 80,
        reasoning: "Clear play button visible",
      };

      mockGenerateObject.mockResolvedValue({
        object: mockResult,
      });

      const result = await analyzer.analyzeScreenshot(
        mockScreenshot,
        mockContext,
      );

      expect(result.actionType).toBe("click");
      expect(result.targetDescription).toBe("Play button");
    });

    it("should support keyboard action type", async () => {
      const mockResult: VisionResult = {
        nextAction: "Press space to jump",
        actionType: "keyboard",
        targetDescription: "Space key",
        confidence: 75,
        reasoning: "Game appears to be a platformer",
      };

      mockGenerateObject.mockResolvedValue({
        object: mockResult,
      });

      const result = await analyzer.analyzeScreenshot(
        mockScreenshot,
        mockContext,
      );

      expect(result.actionType).toBe("keyboard");
    });

    it("should support wait action type", async () => {
      const mockResult: VisionResult = {
        nextAction: "Wait for loading to complete",
        actionType: "wait",
        confidence: 90,
        reasoning: "Loading spinner visible",
      };

      mockGenerateObject.mockResolvedValue({
        object: mockResult,
      });

      const result = await analyzer.analyzeScreenshot(
        mockScreenshot,
        mockContext,
      );

      expect(result.actionType).toBe("wait");
    });

    it("should support unknown action type", async () => {
      const mockResult: VisionResult = {
        nextAction: "Unable to determine",
        actionType: "unknown",
        confidence: 30,
        reasoning: "No clear interactive elements",
      };

      mockGenerateObject.mockResolvedValue({
        object: mockResult,
      });

      const result = await analyzer.analyzeScreenshot(
        mockScreenshot,
        mockContext,
      );

      expect(result.actionType).toBe("unknown");
    });

    it("should support optional targetDescription", async () => {
      const mockResult: VisionResult = {
        nextAction: "Wait for game",
        actionType: "wait",
        confidence: 80,
        reasoning: "Loading",
      };

      mockGenerateObject.mockResolvedValue({
        object: mockResult,
      });

      const result = await analyzer.analyzeScreenshot(
        mockScreenshot,
        mockContext,
      );

      expect(result.targetDescription).toBeUndefined();
    });
  });

  describe("Confidence Scoring", () => {
    it("should return confidence between 0 and 100", async () => {
      const mockResult: VisionResult = {
        nextAction: "Test",
        actionType: "click",
        confidence: 85,
        reasoning: "Clear action",
      };

      mockGenerateObject.mockResolvedValue({
        object: mockResult,
      });

      const result = await analyzer.analyzeScreenshot(
        mockScreenshot,
        mockContext,
      );

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it("should return 0 confidence on analysis failure", async () => {
      mockGenerateObject.mockRejectedValue(new Error("Parse error"));

      const result = await analyzer.analyzeScreenshot(
        mockScreenshot,
        mockContext,
      );

      expect(result.confidence).toBe(0);
    });
  });

  describe("Reasoning", () => {
    it("should provide reasoning for recommendations", async () => {
      const mockResult: VisionResult = {
        nextAction: "Click start",
        actionType: "click",
        confidence: 85,
        reasoning: "Start button is prominent and game appears ready to begin",
      };

      mockGenerateObject.mockResolvedValue({
        object: mockResult,
      });

      const result = await analyzer.analyzeScreenshot(
        mockScreenshot,
        mockContext,
      );

      expect(result.reasoning).toBeTruthy();
      expect(result.reasoning.length).toBeGreaterThan(10);
    });

    it("should provide error reasoning on failure", async () => {
      mockGenerateObject.mockRejectedValue(new Error("Test error"));

      const result = await analyzer.analyzeScreenshot(
        mockScreenshot,
        mockContext,
      );

      expect(result.reasoning).toContain("failed");
      expect(result.reasoning).toContain("Test error");
    });
  });

  describe("Multiple Attempts", () => {
    it("should handle multiple sequential analyses", async () => {
      const mockResult1: VisionResult = {
        nextAction: "Click center",
        actionType: "click",
        confidence: 70,
        reasoning: "First attempt",
      };

      const mockResult2: VisionResult = {
        nextAction: "Press space",
        actionType: "keyboard",
        confidence: 80,
        reasoning: "Second attempt",
      };

      mockGenerateObject
        .mockResolvedValueOnce({ object: mockResult1 })
        .mockResolvedValueOnce({ object: mockResult2 });

      const result1 = await analyzer.analyzeScreenshot(mockScreenshot, {
        attempt: 1,
      });
      const result2 = await analyzer.analyzeScreenshot(mockScreenshot, {
        attempt: 2,
        previousAction: "Click center",
      });

      expect(result1.nextAction).toBe("Click center");
      expect(result2.nextAction).toBe("Press space");
      expect(mockGenerateObject).toHaveBeenCalledTimes(2);
    });
  });
});
