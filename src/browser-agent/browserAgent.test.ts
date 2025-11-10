// Set required env vars BEFORE any imports to avoid validation errors
process.env.BROWSERBASE_API_KEY = "test-key";
process.env.BROWSERBASE_PROJECT_ID = "test-project";
process.env.OPENAI_API_KEY = "test-openai";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { RetryableError } from "@/errors/retryableError";
import { EvidenceStore } from "@/evidence-store/evidenceStore";
import { BrowserAgent } from "./browserAgent";

// Create mock session methods that can be overridden in tests
const mockSessionsCreate = vi.fn();
const mockSessionsUpdate = vi.fn();

// Mock Browserbase SDK
vi.mock("@browserbasehq/sdk", () => {
  class MockBrowserbase {
    sessions = {
      create: mockSessionsCreate,
      update: mockSessionsUpdate,
    };
  }

  return {
    default: MockBrowserbase,
  };
});

// Create mock Stagehand and Page
const mockPageGoto = vi.fn();
const mockPageWaitForLoadState = vi.fn();
const mockPageScreenshot = vi.fn();
const mockPageOn = vi.fn();

const mockPage = {
  goto: mockPageGoto,
  waitForLoadState: mockPageWaitForLoadState,
  screenshot: mockPageScreenshot,
  on: mockPageOn,
};

const mockStagehandInit = vi.fn();
const mockStagehandClose = vi.fn();

// Mock Stagehand SDK
vi.mock("@browserbasehq/stagehand", () => {
  class MockStagehand {
    page = mockPage;
    init = mockStagehandInit;
    close = mockStagehandClose;
  }

  return {
    Stagehand: MockStagehand,
  };
});

// Mock fs.promises for EvidenceStore
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  appendFile: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

// Mock VisionAnalyzer
const mockAnalyzeScreenshotFn = vi.fn();
vi.mock("./visionAnalyzer", () => ({
  VisionAnalyzer: class {
    analyzeScreenshot = mockAnalyzeScreenshotFn;
  },
}));

describe("BrowserAgent", () => {
  // Store original env vars
  const originalEnv = process.env;

  beforeEach(() => {
    // Don't reset modules - config needs to stay loaded with env vars
    // Create a fresh copy of process.env
    process.env = { ...originalEnv };
    // Set required env vars
    process.env.BROWSERBASE_API_KEY = "test-key";
    process.env.BROWSERBASE_PROJECT_ID = "test-project";
    process.env.OPENAI_API_KEY = "test-openai";
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe("constructor", () => {
    test("should create BrowserAgent instance", async () => {
      const store = new EvidenceStore("test-123", "./output");
      await store.initialize();

      const agent = new BrowserAgent("test-123", store);

      expect(agent).toBeInstanceOf(BrowserAgent);
    });

    test("should initialize with no active session", async () => {
      const store = new EvidenceStore("test-123", "./output");
      await store.initialize();

      const agent = new BrowserAgent("test-123", store);

      expect(agent.hasActiveSession()).toBe(false);
      expect(agent.getSessionId()).toBeNull();
    });

    test("should store testId and evidenceStore references", async () => {
      const store = new EvidenceStore("test-456", "./output");
      await store.initialize();

      const agent = new BrowserAgent("test-456", store);

      // Verify agent was created with correct testId (implicit in constructor)
      expect(agent).toBeDefined();
    });
  });

  describe("createSession()", () => {
    test("should successfully create a browser session", async () => {
      const store = new EvidenceStore("test-create", "./output");
      await store.initialize();

      const mockSession = {
        id: "session-123",
        status: "RUNNING",
      };

      mockSessionsCreate.mockResolvedValueOnce(mockSession);
      mockStagehandInit.mockResolvedValueOnce(undefined);

      const agent = new BrowserAgent("test-create", store);
      await agent.createSession();

      expect(agent.hasActiveSession()).toBe(true);
      expect(agent.getSessionId()).toBe("session-123");
      expect(mockSessionsCreate).toHaveBeenCalled();
      expect(mockStagehandInit).toHaveBeenCalled();
      expect(mockPageOn).toHaveBeenCalledWith("console", expect.any(Function));
    });

    test("should throw RetryableError when session creation fails", async () => {
      const store = new EvidenceStore("test-error", "./output");
      await store.initialize();

      mockSessionsCreate.mockRejectedValueOnce(new Error("Network timeout"));

      const agent = new BrowserAgent("test-error", store);

      await expect(agent.createSession()).rejects.toThrow(RetryableError);
      await expect(agent.createSession()).rejects.toThrow(
        /Failed to create browser session/,
      );
    });

    test("should throw RetryableError with original error message", async () => {
      const store = new EvidenceStore("test-msg", "./output");
      await store.initialize();

      mockSessionsCreate.mockRejectedValueOnce(new Error("API quota exceeded"));

      const agent = new BrowserAgent("test-msg", store);

      await expect(agent.createSession()).rejects.toThrow(/API quota exceeded/);
    });

    test("should handle non-Error thrown values", async () => {
      const store = new EvidenceStore("test-non-error", "./output");
      await store.initialize();

      mockSessionsCreate.mockRejectedValue("String error");

      const agent = new BrowserAgent("test-non-error", store);

      await expect(agent.createSession()).rejects.toThrow(RetryableError);
      await expect(agent.createSession()).rejects.toThrow(/String error/);
    });

    test("should store session reference after successful creation", async () => {
      const store = new EvidenceStore("test-reference", "./output");
      await store.initialize();

      const mockSession = {
        id: "session-456",
        status: "RUNNING",
        metadata: { browser: "chromium" },
      };

      mockSessionsCreate.mockResolvedValueOnce(mockSession);
      mockStagehandInit.mockResolvedValueOnce(undefined);

      const agent = new BrowserAgent("test-reference", store);
      await agent.createSession();

      expect(agent.getSessionId()).toBe("session-456");
      expect(agent.hasActiveSession()).toBe(true);
    });
  });

  describe("closeSession()", () => {
    test("should successfully close an active session", async () => {
      const store = new EvidenceStore("test-close", "./output");
      await store.initialize();

      const mockSession = {
        id: "session-789",
        status: "RUNNING",
      };

      mockSessionsCreate.mockResolvedValueOnce(mockSession);
      mockStagehandInit.mockResolvedValueOnce(undefined);
      mockStagehandClose.mockResolvedValueOnce(undefined);
      mockSessionsUpdate.mockResolvedValueOnce({ success: true });

      const agent = new BrowserAgent("test-close", store);
      await agent.createSession();
      await agent.closeSession();

      expect(mockStagehandClose).toHaveBeenCalled();
      expect(mockSessionsUpdate).toHaveBeenCalledWith("session-789", {
        status: "REQUEST_RELEASE",
      });
      expect(agent.hasActiveSession()).toBe(false);
      expect(agent.getSessionId()).toBeNull();
    });

    test("should be safe to call when no session exists", async () => {
      const store = new EvidenceStore("test-no-session", "./output");
      await store.initialize();

      const agent = new BrowserAgent("test-no-session", store);

      // Should not throw
      await expect(agent.closeSession()).resolves.toBeUndefined();
    });

    test("should be safe to call multiple times", async () => {
      const store = new EvidenceStore("test-multiple", "./output");
      await store.initialize();

      const mockSession = {
        id: "session-multi",
        status: "RUNNING",
      };

      mockSessionsCreate.mockResolvedValueOnce(mockSession);
      mockSessionsUpdate.mockResolvedValueOnce({ success: true });

      const agent = new BrowserAgent("test-multiple", store);
      await agent.createSession();
      await agent.closeSession();
      await agent.closeSession(); // Second call should be safe

      expect(agent.hasActiveSession()).toBe(false);
    });

    test("should handle close errors gracefully", async () => {
      const store = new EvidenceStore("test-close-error", "./output");
      await store.initialize();

      const mockSession = {
        id: "session-error",
        status: "RUNNING",
      };

      mockSessionsCreate.mockResolvedValueOnce(mockSession);
      mockSessionsUpdate.mockRejectedValueOnce(
        new Error("Session already closed"),
      );

      const agent = new BrowserAgent("test-close-error", store);
      await agent.createSession();

      // Should not throw, just log warning
      await expect(agent.closeSession()).resolves.toBeUndefined();
      expect(agent.hasActiveSession()).toBe(false);
    });

    test("should clear session reference even when close fails", async () => {
      const store = new EvidenceStore("test-clear-ref", "./output");
      await store.initialize();

      const mockSession = {
        id: "session-clear",
        status: "RUNNING",
      };

      mockSessionsCreate.mockResolvedValueOnce(mockSession);
      mockSessionsUpdate.mockRejectedValueOnce(new Error("Network error"));

      const agent = new BrowserAgent("test-clear-ref", store);
      await agent.createSession();
      expect(agent.hasActiveSession()).toBe(true);

      await agent.closeSession();

      expect(agent.hasActiveSession()).toBe(false);
      expect(agent.getSessionId()).toBeNull();
    });
  });

  describe("getSessionId()", () => {
    test("should return null when no session exists", async () => {
      const store = new EvidenceStore("test-get-id", "./output");
      await store.initialize();

      const agent = new BrowserAgent("test-get-id", store);

      expect(agent.getSessionId()).toBeNull();
    });

    test("should return session ID when session exists", async () => {
      const store = new EvidenceStore("test-has-id", "./output");
      await store.initialize();

      const mockSession = {
        id: "session-get-123",
        status: "RUNNING",
      };

      mockSessionsCreate.mockResolvedValueOnce(mockSession);

      const agent = new BrowserAgent("test-has-id", store);
      await agent.createSession();

      expect(agent.getSessionId()).toBe("session-get-123");
    });

    test("should return null after session is closed", async () => {
      const store = new EvidenceStore("test-after-close", "./output");
      await store.initialize();

      const mockSession = {
        id: "session-closed",
        status: "RUNNING",
      };

      mockSessionsCreate.mockResolvedValueOnce(mockSession);
      mockSessionsUpdate.mockResolvedValueOnce({ success: true });

      const agent = new BrowserAgent("test-after-close", store);
      await agent.createSession();
      await agent.closeSession();

      expect(agent.getSessionId()).toBeNull();
    });
  });

  describe("hasActiveSession()", () => {
    test("should return false when no session exists", async () => {
      const store = new EvidenceStore("test-has-active", "./output");
      await store.initialize();

      const agent = new BrowserAgent("test-has-active", store);

      expect(agent.hasActiveSession()).toBe(false);
    });

    test("should return true when session exists", async () => {
      const store = new EvidenceStore("test-active-true", "./output");
      await store.initialize();

      const mockSession = {
        id: "session-active",
        status: "RUNNING",
      };

      mockSessionsCreate.mockResolvedValueOnce(mockSession);

      const agent = new BrowserAgent("test-active-true", store);
      await agent.createSession();

      expect(agent.hasActiveSession()).toBe(true);
    });

    test("should return false after session is closed", async () => {
      const store = new EvidenceStore("test-active-after", "./output");
      await store.initialize();

      const mockSession = {
        id: "session-inactive",
        status: "RUNNING",
      };

      mockSessionsCreate.mockResolvedValueOnce(mockSession);
      mockSessionsUpdate.mockResolvedValueOnce({ success: true });

      const agent = new BrowserAgent("test-active-after", store);
      await agent.createSession();
      await agent.closeSession();

      expect(agent.hasActiveSession()).toBe(false);
    });
  });

  describe("Session lifecycle integration", () => {
    test("should handle complete session lifecycle", async () => {
      const store = new EvidenceStore("test-lifecycle", "./output");
      await store.initialize();

      const mockSession = {
        id: "session-lifecycle",
        status: "RUNNING",
      };

      mockSessionsCreate.mockResolvedValueOnce(mockSession);
      mockSessionsUpdate.mockResolvedValueOnce({ success: true });

      const agent = new BrowserAgent("test-lifecycle", store);

      // Initial state
      expect(agent.hasActiveSession()).toBe(false);

      // Create session
      await agent.createSession();
      expect(agent.hasActiveSession()).toBe(true);
      expect(agent.getSessionId()).toBe("session-lifecycle");

      // Close session
      await agent.closeSession();
      expect(agent.hasActiveSession()).toBe(false);
      expect(agent.getSessionId()).toBeNull();
    });

    test("should work with try-finally cleanup pattern", async () => {
      const store = new EvidenceStore("test-try-finally", "./output");
      await store.initialize();

      const mockSession = {
        id: "session-try-finally",
        status: "RUNNING",
      };

      mockSessionsCreate.mockResolvedValueOnce(mockSession);
      mockSessionsUpdate.mockResolvedValueOnce({ success: true });

      const agent = new BrowserAgent("test-try-finally", store);

      try {
        await agent.createSession();
        expect(agent.hasActiveSession()).toBe(true);
        // Simulate browser operations here
      } finally {
        await agent.closeSession();
      }

      expect(agent.hasActiveSession()).toBe(false);
    });
  });

  describe("navigateToGame()", () => {
    test("should successfully navigate to game URL", async () => {
      const { writeFile } = await import("node:fs/promises");
      const store = new EvidenceStore("test-navigate", "./output");
      await store.initialize();

      const mockSession = { id: "session-nav", status: "RUNNING" };
      mockSessionsCreate.mockResolvedValueOnce(mockSession);
      mockStagehandInit.mockResolvedValueOnce(undefined);
      mockPageGoto.mockResolvedValueOnce(undefined);
      mockPageWaitForLoadState.mockResolvedValueOnce(undefined);
      mockPageScreenshot.mockResolvedValueOnce(Buffer.from("screenshot"));

      const agent = new BrowserAgent("test-navigate", store);
      await agent.createSession();
      await agent.navigateToGame("https://example.com/game");

      expect(mockPageGoto).toHaveBeenCalledWith("https://example.com/game", {
        timeout: 60000,
        waitUntil: "domcontentloaded",
      });
      expect(mockPageWaitForLoadState).toHaveBeenCalledWith("networkidle", {
        timeout: 30000,
      });
      expect(mockPageScreenshot).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
    });

    test("should throw error when no active session", async () => {
      const store = new EvidenceStore("test-no-session-nav", "./output");
      await store.initialize();

      const agent = new BrowserAgent("test-no-session-nav", store);

      await expect(agent.navigateToGame("https://example.com")).rejects.toThrow(
        "No active browser session",
      );
    });
  });

  describe("waitForLoad()", () => {
    test("should wait for networkidle state", async () => {
      const store = new EvidenceStore("test-wait", "./output");
      await store.initialize();

      const mockSession = { id: "session-wait", status: "RUNNING" };
      mockSessionsCreate.mockResolvedValueOnce(mockSession);
      mockStagehandInit.mockResolvedValueOnce(undefined);
      mockPageWaitForLoadState.mockResolvedValueOnce(undefined);

      const agent = new BrowserAgent("test-wait", store);
      await agent.createSession();
      await agent.waitForLoad();

      expect(mockPageWaitForLoadState).toHaveBeenCalledWith("networkidle", {
        timeout: 30000,
      });
    });

    test("should throw error when no active session", async () => {
      const store = new EvidenceStore("test-no-session-wait", "./output");
      await store.initialize();

      const agent = new BrowserAgent("test-no-session-wait", store);

      await expect(agent.waitForLoad()).rejects.toThrow(
        "No active browser session",
      );
    });
  });

  describe("Console log monitoring", () => {
    test("should capture console logs to evidence store", async () => {
      const { appendFile } = await import("node:fs/promises");
      const store = new EvidenceStore("test-console", "./output");
      await store.initialize();

      const mockSession = { id: "session-console", status: "RUNNING" };
      mockSessionsCreate.mockResolvedValueOnce(mockSession);
      mockStagehandInit.mockResolvedValueOnce(undefined);

      const agent = new BrowserAgent("test-console", store);
      await agent.createSession();

      // Get the console handler that was registered
      const consoleHandler = mockPageOn.mock.calls.find(
        (call) => call[0] === "console",
      )?.[1];

      expect(consoleHandler).toBeDefined();

      // Simulate a console message
      const mockMsg = { text: () => "Test console message" };
      await consoleHandler(mockMsg);

      expect(appendFile).toHaveBeenCalled();
    });
  });

  describe("getPage()", () => {
    test("should return null when no session exists", async () => {
      const store = new EvidenceStore("test-get-page", "./output");
      await store.initialize();

      const agent = new BrowserAgent("test-get-page", store);

      expect(agent.getPage()).toBeNull();
    });

    test("should return page object when session exists", async () => {
      const store = new EvidenceStore("test-has-page", "./output");
      await store.initialize();

      const mockSession = { id: "session-page", status: "RUNNING" };
      mockSessionsCreate.mockResolvedValueOnce(mockSession);
      mockStagehandInit.mockResolvedValueOnce(undefined);

      const agent = new BrowserAgent("test-has-page", store);
      await agent.createSession();

      expect(agent.getPage()).toBe(mockPage);
    });
  });

  describe("executeAction()", () => {
    // Add mock functions for page interactions
    const mockMouseClick = vi.fn();
    const mockKeyboardPress = vi.fn();
    const mockPageClick = vi.fn();
    const mockViewportSize = vi.fn();

    beforeEach(() => {
      // Reset page mock with all required methods
      (mockPage as any).mouse = { click: mockMouseClick };
      (mockPage as any).keyboard = { press: mockKeyboardPress };
      (mockPage as any).click = mockPageClick;
      (mockPage as any).viewportSize = mockViewportSize;

      // Set default viewport size
      mockViewportSize.mockReturnValue({ width: 1280, height: 720 });
    });

    describe("No Active Session", () => {
      test("should fail gracefully when no session exists", async () => {
        const { appendFile } = await import("node:fs/promises");
        const store = new EvidenceStore("test-no-session-action", "./output");
        await store.initialize();

        const agent = new BrowserAgent("test-no-session-action", store);

        const result = await agent.executeAction(
          { type: "click", target: "center" },
          "Test click",
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe("No active browser session");
        expect(appendFile).toHaveBeenCalledWith(
          expect.stringContaining("actions.log"),
          expect.stringContaining("Test click"),
          "utf-8",
        );
      });
    });

    describe("Click Actions", () => {
      test("should execute click on center", async () => {
        const { appendFile } = await import("node:fs/promises");
        const store = new EvidenceStore("test-click-center", "./output");
        await store.initialize();

        const mockSession = { id: "session-click", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);
        mockPageScreenshot.mockResolvedValue(Buffer.from("screenshot"));

        const agent = new BrowserAgent("test-click-center", store);
        await agent.createSession();

        const result = await agent.executeAction(
          { type: "click", target: "center" },
          "Click center",
        );

        expect(result.success).toBe(true);
        expect(result.action.type).toBe("click");
        expect(mockMouseClick).toHaveBeenCalledWith(640, 360); // center of 1280x720
        expect(mockPageScreenshot).toHaveBeenCalledTimes(2); // before + after
        expect(appendFile).toHaveBeenCalled(); // action logged
      });

      test("should execute click with offset", async () => {
        const store = new EvidenceStore("test-click-offset", "./output");
        await store.initialize();

        const mockSession = { id: "session-click-offset", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);
        mockPageScreenshot.mockResolvedValue(Buffer.from("screenshot"));

        const agent = new BrowserAgent("test-click-offset", store);
        await agent.createSession();

        const result = await agent.executeAction(
          { type: "click", target: "offset:100,-50" },
          "Click offset",
        );

        expect(result.success).toBe(true);
        expect(mockMouseClick).toHaveBeenCalledWith(740, 310); // 640+100, 360-50
      });

      test("should execute click by selector", async () => {
        const store = new EvidenceStore("test-click-selector", "./output");
        await store.initialize();

        const mockSession = { id: "session-click-sel", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);
        mockPageScreenshot.mockResolvedValue(Buffer.from("screenshot"));
        mockPageClick.mockResolvedValueOnce(undefined);

        const agent = new BrowserAgent("test-click-selector", store);
        await agent.createSession();

        const result = await agent.executeAction(
          { type: "click", target: "#start-button" },
          "Click start button",
        );

        expect(result.success).toBe(true);
        expect(mockPageClick).toHaveBeenCalledWith("#start-button");
      });

      test("should fallback to center when selector fails", async () => {
        const store = new EvidenceStore("test-click-fallback", "./output");
        await store.initialize();

        const mockSession = { id: "session-fallback", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);
        mockPageScreenshot.mockResolvedValue(Buffer.from("screenshot"));
        mockPageClick.mockRejectedValueOnce(new Error("Selector not found"));

        const agent = new BrowserAgent("test-click-fallback", store);
        await agent.createSession();

        const result = await agent.executeAction(
          { type: "click", target: "#nonexistent" },
          "Click nonexistent",
        );

        expect(result.success).toBe(true);
        expect(mockMouseClick).toHaveBeenCalledWith(640, 360); // fell back to center
      });

      test("should capture before and after screenshots", async () => {
        const { writeFile } = await import("node:fs/promises");
        const store = new EvidenceStore("test-screenshots", "./output");
        await store.initialize();

        // Clear previous writeFile calls (from metadata.json)
        vi.clearAllMocks();

        const mockSession = { id: "session-screenshots", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);
        mockPageScreenshot.mockResolvedValue(Buffer.from("screenshot"));

        const agent = new BrowserAgent("test-screenshots", store);
        await agent.createSession();

        const result = await agent.executeAction(
          { type: "click", target: "center" },
          "Test action",
        );

        expect(result.success).toBe(true);
        expect(result.beforeScreenshot).toBeDefined();
        expect(result.afterScreenshot).toBeDefined();
        expect(mockPageScreenshot).toHaveBeenCalledTimes(2);
        expect(writeFile).toHaveBeenCalledTimes(2); // 2 screenshots
      });
    });

    describe("Keyboard Actions", () => {
      test("should execute keyboard action", async () => {
        const store = new EvidenceStore("test-keyboard", "./output");
        await store.initialize();

        const mockSession = { id: "session-keyboard", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);
        mockPageScreenshot.mockResolvedValue(Buffer.from("screenshot"));

        const agent = new BrowserAgent("test-keyboard", store);
        await agent.createSession();

        const result = await agent.executeAction(
          { type: "keyboard", value: "Space" },
          "Press spacebar",
        );

        expect(result.success).toBe(true);
        expect(mockKeyboardPress).toHaveBeenCalledWith("Space");
        expect(mockPageScreenshot).toHaveBeenCalledTimes(2); // before + after
      });

      test("should fail when keyboard action has no value", async () => {
        const store = new EvidenceStore("test-keyboard-no-value", "./output");
        await store.initialize();

        const mockSession = { id: "session-kb-noval", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);
        mockPageScreenshot.mockResolvedValue(Buffer.from("screenshot"));

        const agent = new BrowserAgent("test-keyboard-no-value", store);
        await agent.createSession();

        const result = await agent.executeAction(
          { type: "keyboard" } as any,
          "Invalid keyboard action",
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("requires a value");
      });
    });

    describe("Wait Actions", () => {
      test("should execute wait action with default delay", async () => {
        const store = new EvidenceStore("test-wait-default", "./output");
        await store.initialize();

        const mockSession = { id: "session-wait", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);

        const agent = new BrowserAgent("test-wait-default", store);
        await agent.createSession();

        const startTime = Date.now();
        const result = await agent.executeAction(
          { type: "wait" },
          "Wait default",
        );
        const duration = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(duration).toBeGreaterThanOrEqual(1000); // default is 1000ms
        expect(mockPageScreenshot).not.toHaveBeenCalled(); // wait doesn't capture screenshots
      });

      test("should execute wait action with custom delay", async () => {
        const store = new EvidenceStore("test-wait-custom", "./output");
        await store.initialize();

        const mockSession = { id: "session-wait-custom", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);

        const agent = new BrowserAgent("test-wait-custom", store);
        await agent.createSession();

        const startTime = Date.now();
        const result = await agent.executeAction(
          { type: "wait", delay: 500 },
          "Wait 500ms",
        );
        const duration = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(duration).toBeGreaterThanOrEqual(500);
        expect(duration).toBeLessThan(600); // some tolerance
      });
    });

    describe("Screenshot Actions", () => {
      test("should capture screenshot", async () => {
        const { writeFile } = await import("node:fs/promises");
        const store = new EvidenceStore("test-screenshot", "./output");
        await store.initialize();

        // Clear previous writeFile calls (from metadata.json)
        vi.clearAllMocks();

        const mockSession = { id: "session-screenshot", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);
        mockPageScreenshot.mockResolvedValue(Buffer.from("screenshot"));

        const agent = new BrowserAgent("test-screenshot", store);
        await agent.createSession();

        const result = await agent.executeAction(
          { type: "screenshot" },
          "Capture state",
        );

        expect(result.success).toBe(true);
        expect(result.afterScreenshot).toBeDefined();
        expect(result.beforeScreenshot).toBeUndefined(); // screenshot doesn't capture "before"
        expect(mockPageScreenshot).toHaveBeenCalledTimes(1);
        expect(writeFile).toHaveBeenCalledTimes(1);
      });
    });

    describe("Error Handling", () => {
      test("should handle screenshot capture errors gracefully", async () => {
        const store = new EvidenceStore("test-screenshot-error", "./output");
        await store.initialize();

        const mockSession = { id: "session-scr-err", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);
        mockPageScreenshot
          .mockRejectedValueOnce(new Error("Screenshot failed"))
          .mockResolvedValueOnce(Buffer.from("after"));

        const agent = new BrowserAgent("test-screenshot-error", store);
        await agent.createSession();

        const result = await agent.executeAction(
          { type: "click", target: "center" },
          "Click with screenshot error",
        );

        // Should still succeed despite screenshot error
        expect(result.success).toBe(true);
        expect(result.beforeScreenshot).toBeUndefined(); // failed
        expect(result.afterScreenshot).toBeDefined(); // succeeded
      });

      test("should handle action execution errors", async () => {
        const store = new EvidenceStore("test-action-error", "./output");
        await store.initialize();

        const mockSession = { id: "session-act-err", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);
        mockPageScreenshot.mockResolvedValue(Buffer.from("screenshot"));
        mockMouseClick.mockRejectedValueOnce(new Error("Click failed"));

        const agent = new BrowserAgent("test-action-error", store);
        await agent.createSession();

        const result = await agent.executeAction(
          { type: "click", target: "center" },
          "Failing click",
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("Click failed");
      });

      test("should log action details on failure", async () => {
        const { appendFile } = await import("node:fs/promises");
        const store = new EvidenceStore("test-log-failure", "./output");
        await store.initialize();

        const mockSession = { id: "session-log-fail", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);
        mockPageScreenshot.mockResolvedValue(Buffer.from("screenshot"));
        mockKeyboardPress.mockRejectedValueOnce(new Error("Key press failed"));

        const agent = new BrowserAgent("test-log-failure", store);
        await agent.createSession();

        await agent.executeAction(
          { type: "keyboard", value: "Enter" },
          "Press enter",
        );

        expect(appendFile).toHaveBeenCalledWith(
          expect.stringContaining("actions.log"),
          expect.stringMatching(/Press enter.*false.*Key press failed/s),
          "utf-8",
        );
      });
    });

    describe("Unsupported Actions", () => {
      test("should handle unsupported action types", async () => {
        const store = new EvidenceStore("test-unsupported", "./output");
        await store.initialize();

        const mockSession = { id: "session-unsupported", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);
        mockPageScreenshot.mockResolvedValue(Buffer.from("screenshot"));

        const agent = new BrowserAgent("test-unsupported", store);
        await agent.createSession();

        const result = await agent.executeAction(
          { type: "invalid" } as any,
          "Unsupported action",
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("Unsupported action type");
      });
    });
  });

  describe("detectGameType()", () => {
    const mockPageEvaluate = vi.fn();

    beforeEach(() => {
      (mockPage as any).evaluate = mockPageEvaluate;
    });

    describe("No Active Session", () => {
      test("should throw when no session exists", async () => {
        const store = new EvidenceStore("test-no-session-detect", "./output");
        await store.initialize();

        const agent = new BrowserAgent("test-no-session-detect", store);

        await expect(agent.detectGameType()).rejects.toThrow(
          "No active browser session",
        );
      });
    });

    describe("DOM Analysis - Platformer", () => {
      test("should detect platformer with canvas and keyboard controls", async () => {
        const store = new EvidenceStore("test-detect-platformer", "./output");
        await store.initialize();

        const mockSession = { id: "session-detect", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);

        // Mock DOM with platformer indicators
        mockPageEvaluate.mockResolvedValueOnce({
          hasCanvas: true,
          canvasCount: 1,
          hasArrowKeys: true,
          hasSpacebar: true,
          hasClick: false,
          hasIncrement: false,
          hasMatch: false,
          hasGrid: false,
          platformerScore: 3, // "platform", "jump", "level"
          clickerScore: 0,
          puzzleScore: 0,
          bodyLength: 500,
        });

        const agent = new BrowserAgent("test-detect-platformer", store);
        await agent.createSession();

        const result = await agent.detectGameType();

        expect(result.gameType).toBe("platformer");
        expect(result.confidence).toBeGreaterThanOrEqual(75);
        expect(result.method).toBe("dom");
        expect(result.reasoning).toContain("Canvas element");
      });

      test("should detect platformer with single canvas", async () => {
        const store = new EvidenceStore(
          "test-detect-platformer-canvas",
          "./output",
        );
        await store.initialize();

        const mockSession = { id: "session-canvas", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);

        mockPageEvaluate.mockResolvedValueOnce({
          hasCanvas: true,
          canvasCount: 1,
          hasArrowKeys: false,
          hasSpacebar: false,
          hasClick: false,
          hasIncrement: false,
          hasMatch: false,
          hasGrid: false,
          platformerScore: 0,
          clickerScore: 0,
          puzzleScore: 0,
          bodyLength: 200,
        });

        const agent = new BrowserAgent("test-detect-platformer-canvas", store);
        await agent.createSession();

        const result = await agent.detectGameType();

        expect(result.gameType).toBe("platformer");
        expect(result.confidence).toBe(60);
        expect(result.method).toBe("dom");
      });
    });

    describe("DOM Analysis - Clicker", () => {
      test("should detect clicker with click and increment keywords", async () => {
        const store = new EvidenceStore("test-detect-clicker", "./output");
        await store.initialize();

        const mockSession = { id: "session-clicker", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);

        mockPageEvaluate.mockResolvedValueOnce({
          hasCanvas: false,
          canvasCount: 0,
          hasArrowKeys: false,
          hasSpacebar: false,
          hasClick: true,
          hasIncrement: true,
          hasMatch: false,
          hasGrid: false,
          platformerScore: 0,
          clickerScore: 3, // "click", "upgrade", "idle"
          puzzleScore: 0,
          bodyLength: 400,
        });

        const agent = new BrowserAgent("test-detect-clicker", store);
        await agent.createSession();

        const result = await agent.detectGameType();

        expect(result.gameType).toBe("clicker");
        expect(result.confidence).toBeGreaterThanOrEqual(70);
        expect(result.method).toBe("dom");
        expect(result.reasoning).toContain("Click interactions");
      });

      test("should detect clicker with medium confidence", async () => {
        const store = new EvidenceStore(
          "test-detect-clicker-medium",
          "./output",
        );
        await store.initialize();

        const mockSession = { id: "session-click-med", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);

        mockPageEvaluate.mockResolvedValueOnce({
          hasCanvas: false,
          canvasCount: 0,
          hasArrowKeys: false,
          hasSpacebar: false,
          hasClick: true,
          hasIncrement: true,
          hasMatch: false,
          hasGrid: false,
          platformerScore: 0,
          clickerScore: 1,
          puzzleScore: 0,
          bodyLength: 300,
        });

        const agent = new BrowserAgent("test-detect-clicker-medium", store);
        await agent.createSession();

        const result = await agent.detectGameType();

        expect(result.gameType).toBe("clicker");
        expect(result.confidence).toBe(55);
        expect(result.method).toBe("dom");
      });
    });

    describe("DOM Analysis - Puzzle", () => {
      test("should detect puzzle with match and grid keywords", async () => {
        const store = new EvidenceStore("test-detect-puzzle", "./output");
        await store.initialize();

        const mockSession = { id: "session-puzzle", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);

        mockPageEvaluate.mockResolvedValueOnce({
          hasCanvas: false,
          canvasCount: 0,
          hasArrowKeys: false,
          hasSpacebar: false,
          hasClick: false,
          hasIncrement: false,
          hasMatch: true,
          hasGrid: true,
          platformerScore: 0,
          clickerScore: 0,
          puzzleScore: 3, // "puzzle", "match", "tile"
          bodyLength: 350,
        });

        const agent = new BrowserAgent("test-detect-puzzle", store);
        await agent.createSession();

        const result = await agent.detectGameType();

        expect(result.gameType).toBe("puzzle");
        expect(result.confidence).toBeGreaterThanOrEqual(70);
        expect(result.method).toBe("dom");
        expect(result.reasoning).toContain("Grid/match");
      });
    });

    describe("DOM Analysis - Generic", () => {
      test("should fallback to generic with low confidence", async () => {
        const store = new EvidenceStore("test-detect-generic", "./output");
        await store.initialize();

        const mockSession = { id: "session-generic", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);

        mockPageEvaluate.mockResolvedValueOnce({
          hasCanvas: false,
          canvasCount: 0,
          hasArrowKeys: false,
          hasSpacebar: false,
          hasClick: false,
          hasIncrement: false,
          hasMatch: false,
          hasGrid: false,
          platformerScore: 0,
          clickerScore: 0,
          puzzleScore: 0,
          bodyLength: 100,
        });

        const agent = new BrowserAgent("test-detect-generic", store);
        await agent.createSession();

        const result = await agent.detectGameType();

        expect(result.gameType).toBe("generic");
        expect(result.confidence).toBe(40);
        expect(result.method).toBe("dom");
        expect(result.reasoning).toContain("No specific game type");
      });
    });

    describe("Vision Analysis Fallback", () => {
      test("should use vision analysis when DOM confidence < 70%", async () => {
        const store = new EvidenceStore("test-vision-fallback", "./output");
        await store.initialize();

        const mockSession = { id: "session-vision", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);
        mockPageScreenshot.mockResolvedValue(Buffer.from("screenshot"));

        // Mock low confidence DOM result
        mockPageEvaluate.mockResolvedValueOnce({
          hasCanvas: false,
          canvasCount: 0,
          hasArrowKeys: false,
          hasSpacebar: false,
          hasClick: true,
          hasIncrement: false,
          hasMatch: false,
          hasGrid: false,
          platformerScore: 0,
          clickerScore: 0,
          puzzleScore: 0,
          bodyLength: 150,
        });

        // Mock VisionAnalyzer response
        mockAnalyzeScreenshotFn.mockResolvedValueOnce({
          action: { type: "click", target: "center" },
          confidence: 85,
          reasoning:
            "This appears to be a platformer game with jumping mechanics",
        });

        const agent = new BrowserAgent("test-vision-fallback", store);
        await agent.createSession();

        const result = await agent.detectGameType();

        expect(result.gameType).toBe("platformer");
        expect(result.confidence).toBe(85);
        expect(result.method).toBe("vision");
        expect(result.reasoning).toContain("Vision analysis");
      });

      test("should fallback to DOM result when vision fails", async () => {
        const store = new EvidenceStore("test-vision-error", "./output");
        await store.initialize();

        const mockSession = { id: "session-vision-err", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);
        mockPageScreenshot.mockRejectedValue(new Error("Screenshot failed"));

        // Mock low confidence DOM result
        mockPageEvaluate.mockResolvedValueOnce({
          hasCanvas: true,
          canvasCount: 1,
          hasArrowKeys: false,
          hasSpacebar: false,
          hasClick: false,
          hasIncrement: false,
          hasMatch: false,
          hasGrid: false,
          platformerScore: 0,
          clickerScore: 0,
          puzzleScore: 0,
          bodyLength: 100,
        });

        const agent = new BrowserAgent("test-vision-error", store);
        await agent.createSession();

        const result = await agent.detectGameType();

        expect(result.gameType).toBe("platformer");
        expect(result.confidence).toBe(60);
        expect(result.method).toBe("dom");
      });
    });

    describe("Vision Analysis Game Type Extraction", () => {
      test("should extract clicker type from vision reasoning", async () => {
        const store = new EvidenceStore(
          "test-vision-extract-clicker",
          "./output",
        );
        await store.initialize();

        const mockSession = { id: "session-vis-clicker", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);
        mockPageScreenshot.mockResolvedValue(Buffer.from("screenshot"));

        mockPageEvaluate.mockResolvedValueOnce({
          hasCanvas: false,
          canvasCount: 0,
          hasArrowKeys: false,
          hasSpacebar: false,
          hasClick: false,
          hasIncrement: false,
          hasMatch: false,
          hasGrid: false,
          platformerScore: 0,
          clickerScore: 0,
          puzzleScore: 0,
          bodyLength: 50,
        });

        mockAnalyzeScreenshotFn.mockResolvedValueOnce({
          action: { type: "click", target: "center" },
          confidence: 80,
          reasoning:
            "This is an idle clicker game with upgrade buttons visible",
        });

        const agent = new BrowserAgent("test-vision-extract-clicker", store);
        await agent.createSession();

        const result = await agent.detectGameType();

        expect(result.gameType).toBe("clicker");
      });

      test("should extract puzzle type from vision reasoning", async () => {
        const store = new EvidenceStore(
          "test-vision-extract-puzzle",
          "./output",
        );
        await store.initialize();

        const mockSession = { id: "session-vis-puzzle", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);
        mockPageScreenshot.mockResolvedValue(Buffer.from("screenshot"));

        mockPageEvaluate.mockResolvedValueOnce({
          hasCanvas: false,
          canvasCount: 0,
          hasArrowKeys: false,
          hasSpacebar: false,
          hasClick: false,
          hasIncrement: false,
          hasMatch: false,
          hasGrid: false,
          platformerScore: 0,
          clickerScore: 0,
          puzzleScore: 0,
          bodyLength: 50,
        });

        mockAnalyzeScreenshotFn.mockResolvedValueOnce({
          action: { type: "click", target: "tile" },
          confidence: 82,
          reasoning: "This is a match-3 puzzle game with a grid of tiles",
        });

        const agent = new BrowserAgent("test-vision-extract-puzzle", store);
        await agent.createSession();

        const result = await agent.detectGameType();

        expect(result.gameType).toBe("puzzle");
      });

      test("should default to generic when no keywords match", async () => {
        const store = new EvidenceStore(
          "test-vision-extract-generic",
          "./output",
        );
        await store.initialize();

        const mockSession = { id: "session-vis-generic", status: "RUNNING" };
        mockSessionsCreate.mockResolvedValueOnce(mockSession);
        mockStagehandInit.mockResolvedValueOnce(undefined);
        mockPageScreenshot.mockResolvedValue(Buffer.from("screenshot"));

        mockPageEvaluate.mockResolvedValueOnce({
          hasCanvas: false,
          canvasCount: 0,
          hasArrowKeys: false,
          hasSpacebar: false,
          hasClick: false,
          hasIncrement: false,
          hasMatch: false,
          hasGrid: false,
          platformerScore: 0,
          clickerScore: 0,
          puzzleScore: 0,
          bodyLength: 50,
        });

        mockAnalyzeScreenshotFn.mockResolvedValueOnce({
          action: { type: "wait" },
          confidence: 75,
          reasoning: "Game is loading, no clear type indicators yet",
        });

        const agent = new BrowserAgent("test-vision-extract-generic", store);
        await agent.createSession();

        const result = await agent.detectGameType();

        expect(result.gameType).toBe("generic");
      });
    });
  });
});
