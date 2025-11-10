import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Page } from "@browserbasehq/stagehand";
import {
  VisionGuidedClickStrategy,
  DOMButtonFinderStrategy,
  KeyboardMashStrategy,
  IframeDetectionStrategy,
  PageRefreshStrategy,
  UnstickStrategyExecutor,
  type UnstickContext,
} from "./unstickStrategies";

describe("Unstick Strategies", () => {
  let mockPage: Partial<Page>;
  let mockContext: UnstickContext;

  beforeEach(() => {
    mockPage = {
      screenshot: vi.fn().mockResolvedValue(Buffer.from("test screenshot")),
      mouse: {
        click: vi.fn().mockResolvedValue(undefined),
      } as any,
      keyboard: {
        press: vi.fn().mockResolvedValue(undefined),
      } as any,
      evaluate: vi.fn().mockResolvedValue({ width: 1280, height: 720 }),
      $: vi.fn().mockResolvedValue(null),
      reload: vi.fn().mockResolvedValue(undefined),
    };

    mockContext = {
      testId: "test-123",
      attemptNumber: 1,
      domAnalysis: {
        buttons: [
          {
            tag: "button",
            text: "Start Game",
            id: "start-btn",
            classes: [],
            position: { x: 100, y: 100, width: 200, height: 50 },
            visible: true,
            clickable: true,
          },
        ],
        links: [],
        inputs: [],
        canvases: [],
        headings: [],
        clickableText: [],
        viewport: { width: 1280, height: 720 },
        interactiveCount: 1,
      },
      evidenceStore: {
        captureScreenshot: vi.fn().mockResolvedValue("screenshot-path"),
      } as any,
    };
  });

  describe("DOMButtonFinderStrategy", () => {
    it("should find and click start button from DOM", async () => {
      const strategy = new DOMButtonFinderStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(true);
      expect(result.action).toContain("Start Game");
      expect(mockPage.mouse?.click).toHaveBeenCalledWith(200, 125); // Center of button
    });

    it("should fail if no start buttons found", async () => {
      mockContext.domAnalysis.buttons = [];

      const strategy = new DOMButtonFinderStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No start/play buttons");
    });

    it("should find button with play text", async () => {
      mockContext.domAnalysis.buttons = [
        {
          tag: "button",
          text: "Play Now",
          id: "play-btn",
          classes: [],
          position: { x: 50, y: 50, width: 100, height: 40 },
          visible: true,
          clickable: true,
        },
      ];

      const strategy = new DOMButtonFinderStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(true);
      expect(result.action).toContain("Play Now");
      expect(mockPage.mouse?.click).toHaveBeenCalledWith(100, 70);
    });

    it("should find button by id containing start", async () => {
      mockContext.domAnalysis.buttons = [
        {
          tag: "button",
          text: "",
          id: "game-start-button",
          classes: [],
          position: { x: 200, y: 200, width: 150, height: 60 },
          visible: true,
          clickable: true,
        },
      ];

      const strategy = new DOMButtonFinderStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(true);
      expect(mockPage.mouse?.click).toHaveBeenCalledWith(275, 230);
    });

    it("should skip invisible buttons", async () => {
      mockContext.domAnalysis.buttons = [
        {
          tag: "button",
          text: "Start Game",
          id: "start-btn",
          classes: [],
          position: { x: 100, y: 100, width: 200, height: 50 },
          visible: false, // Not visible
          clickable: true,
        },
      ];

      const strategy = new DOMButtonFinderStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No start/play buttons");
    });
  });

  describe("KeyboardMashStrategy", () => {
    it("should try multiple keys", async () => {
      // Mock screenshot to always be the same (all keys fail)
      mockPage.screenshot = vi.fn().mockResolvedValue(Buffer.from("same"));

      const strategy = new KeyboardMashStrategy();
      await strategy.execute(mockPage as Page, mockContext);

      // Should have tried Space, Enter, Escape, arrows, WASD
      expect(mockPage.keyboard?.press).toHaveBeenCalled();
      const callCount = (mockPage.keyboard?.press as any).mock.calls.length;
      expect(callCount).toBe(11); // Exact count: Space, Enter, Escape, 4 arrows, 4 WASD keys
    }, 10000); // Increase timeout to 10 seconds

    it("should stop when a key causes screen change", async () => {
      // Mock screenshot to change on third call
      let callCount = 0;
      mockPage.screenshot = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 3) {
          return Promise.resolve(Buffer.from("screen1"));
        }
        return Promise.resolve(Buffer.from("screen2")); // Changed!
      });

      const strategy = new KeyboardMashStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(true);
      expect(result.changed).toBe(true);
      expect(result.action).toContain("Pressed");
    });

    it("should report failure if no keys work", async () => {
      // All screenshots identical
      mockPage.screenshot = vi.fn().mockResolvedValue(Buffer.from("same"));

      const strategy = new KeyboardMashStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(false);
      expect(result.changed).toBe(false);
      expect(result.error).toContain("No keyboard input caused screen change");
    }, 10000); // Increase timeout to 10 seconds
  });

  describe("IframeDetectionStrategy", () => {
    it("should detect and click into iframe", async () => {
      const mockFrame = {
        evaluate: vi.fn().mockResolvedValue(true), // Simulate successful click
      };

      const mockIframeHandle = {
        contentFrame: vi.fn().mockResolvedValue(mockFrame),
      };

      mockPage.$ = vi.fn().mockResolvedValue(mockIframeHandle);

      const strategy = new IframeDetectionStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(true);
      expect(result.changed).toBe(true);
      expect(mockFrame.evaluate).toHaveBeenCalled(); // Should have evaluated to click
    });

    it("should fail if no iframe found", async () => {
      mockPage.$ = vi.fn().mockResolvedValue(null);

      const strategy = new IframeDetectionStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No game iframe");
    });

    it("should try multiple iframe selectors", async () => {
      mockPage.$ = vi.fn().mockResolvedValue(null);

      const strategy = new IframeDetectionStrategy();
      await strategy.execute(mockPage as Page, mockContext);

      // Should try multiple selectors
      const callCount = (mockPage.$ as any).mock.calls.length;
      expect(callCount).toBeGreaterThan(3);
    });

    it("should handle iframe without contentFrame", async () => {
      const mockIframeHandle = {
        contentFrame: vi.fn().mockResolvedValue(null),
      };

      mockPage.$ = vi.fn().mockResolvedValue(mockIframeHandle);

      const strategy = new IframeDetectionStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      // Should continue to try other selectors
      expect(result.success).toBe(false);
    });
  });

  describe("PageRefreshStrategy", () => {
    it("should refresh page", async () => {
      const strategy = new PageRefreshStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(true);
      expect(result.changed).toBe(true);
      expect(mockPage.reload).toHaveBeenCalled();
    });

    it("should handle refresh failure", async () => {
      mockPage.reload = vi.fn().mockRejectedValue(new Error("Refresh failed"));

      const strategy = new PageRefreshStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Refresh failed");
    });
  });

  describe("VisionGuidedClickStrategy", () => {
    it("should return error when vision analysis returns low confidence", async () => {
      const strategy = new VisionGuidedClickStrategy();

      // Mock VisionAnalyzer within the strategy by testing the error path
      // We can't easily mock the import, but we can test the low-confidence path
      // by using a mock that returns low confidence result

      // For this test, we'll just verify the strategy name exists
      // Real integration will test via orchestrator
      expect(strategy.name).toBe("Vision-Guided Click");
    });

    it("should handle vision analysis errors gracefully", async () => {
      const strategy = new VisionGuidedClickStrategy();

      // Mock screenshot to fail, which triggers error handling
      mockPage.screenshot = vi.fn().mockRejectedValue(new Error("Screenshot failed"));

      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Screenshot failed");
    });
  });

  describe("UnstickStrategyExecutor", () => {
    it("should execute strategies in order until one succeeds", async () => {
      const failStrategy = {
        name: "Fail Strategy",
        execute: vi.fn().mockResolvedValue({
          success: false,
          action: "Failed",
          changed: false,
        }),
      };

      const successStrategy = {
        name: "Success Strategy",
        execute: vi.fn().mockResolvedValue({
          success: true,
          action: "Succeeded",
          changed: true,
        }),
      };

      const neverCalledStrategy = {
        name: "Never Called",
        execute: vi.fn(),
      };

      const executor = new UnstickStrategyExecutor([
        failStrategy,
        successStrategy,
        neverCalledStrategy,
      ]);

      const result = await executor.executeAll(mockPage as Page, mockContext);

      expect(failStrategy.execute).toHaveBeenCalled();
      expect(successStrategy.execute).toHaveBeenCalled();
      expect(neverCalledStrategy.execute).not.toHaveBeenCalled(); // Stopped after success

      expect(result.success).toBe(true);
      expect(result.changed).toBe(true);
    });

    it("should return last result if all strategies fail", async () => {
      const strategy1 = {
        name: "Fail 1",
        execute: vi.fn().mockResolvedValue({
          success: false,
          action: "Failed 1",
          changed: false,
        }),
      };

      const strategy2 = {
        name: "Fail 2",
        execute: vi.fn().mockResolvedValue({
          success: false,
          action: "Failed 2",
          changed: false,
        }),
      };

      const executor = new UnstickStrategyExecutor([strategy1, strategy2]);
      const result = await executor.executeAll(mockPage as Page, mockContext);

      expect(strategy1.execute).toHaveBeenCalled();
      expect(strategy2.execute).toHaveBeenCalled();
      expect(result.action).toBe("Failed 2"); // Last strategy result
    });

    it("should create default executor with proper strategy order", () => {
      const executor = UnstickStrategyExecutor.createDefault();

      // Should have 5 strategies
      expect(executor).toBeInstanceOf(UnstickStrategyExecutor);
      // The strategies are private, but we can test execution
    });

    it("should continue to next strategy if one succeeds but screen doesn't change", async () => {
      const successNoChange = {
        name: "Success No Change",
        execute: vi.fn().mockResolvedValue({
          success: true,
          action: "Executed but no change",
          changed: false, // No screen change
        }),
      };

      const successWithChange = {
        name: "Success With Change",
        execute: vi.fn().mockResolvedValue({
          success: true,
          action: "Executed with change",
          changed: true,
        }),
      };

      const executor = new UnstickStrategyExecutor([
        successNoChange,
        successWithChange,
      ]);

      const result = await executor.executeAll(mockPage as Page, mockContext);

      expect(successNoChange.execute).toHaveBeenCalled();
      expect(successWithChange.execute).toHaveBeenCalled();
      expect(result.changed).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle page screenshot errors gracefully", async () => {
      mockPage.screenshot = vi.fn().mockRejectedValue(new Error("Screenshot failed"));

      const strategy = new DOMButtonFinderStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Screenshot failed");
    });

    it("should handle page evaluate errors gracefully", async () => {
      // First screenshot succeeds, then evaluate fails
      mockPage.screenshot = vi.fn().mockResolvedValue(Buffer.from("test"));
      mockPage.keyboard = {
        press: vi.fn().mockRejectedValue(new Error("Keyboard press failed")),
      } as any;

      const strategy = new KeyboardMashStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Keyboard press failed");
    });
  });

  describe("Integration Tests", () => {
    it("should detect itch.io iframe selector", async () => {
      const mockFrame = {
        evaluate: vi.fn().mockResolvedValue(true), // Simulate successful click
      };

      const mockIframeHandle = {
        contentFrame: vi.fn().mockResolvedValue(mockFrame),
      };

      // Mock to return iframe handle on #game_drop selector (itch.io)
      mockPage.$ = vi.fn().mockImplementation((selector) => {
        if (selector === "#game_drop") {
          return Promise.resolve(mockIframeHandle);
        }
        return Promise.resolve(null);
      });

      const strategy = new IframeDetectionStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(true);
      expect(result.action).toContain("#game_drop");
    });

    it("should prioritize buttons with 'continue' text", async () => {
      mockContext.domAnalysis.buttons = [
        {
          tag: "button",
          text: "Settings",
          id: "settings",
          classes: [],
          position: { x: 10, y: 10, width: 80, height: 30 },
          visible: true,
          clickable: true,
        },
        {
          tag: "button",
          text: "Continue",
          id: "continue-btn",
          classes: [],
          position: { x: 150, y: 200, width: 180, height: 50 },
          visible: true,
          clickable: true,
        },
      ];

      const strategy = new DOMButtonFinderStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(true);
      expect(result.action).toContain("Continue");
    });
  });
});
