// Set required env vars BEFORE any imports to avoid validation errors
process.env.BROWSERBASE_API_KEY = "test-key";
process.env.BROWSERBASE_PROJECT_ID = "test-project";
process.env.OPENAI_API_KEY = "test-openai";

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { access, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { EvidenceStore } from "./evidenceStore";

describe("EvidenceStore", () => {
  // Store original env vars
  const originalEnv = process.env;
  const testOutputBase = "./qa-tests/test-output-evidence-store";

  beforeEach(async () => {
    // Create a fresh copy of process.env
    process.env = { ...originalEnv };
    // Set required env vars to avoid validation errors
    process.env.BROWSERBASE_API_KEY = "test-key";
    process.env.BROWSERBASE_PROJECT_ID = "test-project";
    process.env.OPENAI_API_KEY = "test-openai";

    // Create base test output directory
    await mkdir(testOutputBase, { recursive: true });
  });

  afterEach(async () => {
    // Restore original env
    process.env = originalEnv;

    // Clean up test directories
    await rm(testOutputBase, { recursive: true, force: true });
  });

  describe("constructor", () => {
    it("should create instance with test ID and output directory", () => {
      const store = new EvidenceStore("test-123", testOutputBase);

      expect(store).toBeInstanceOf(EvidenceStore);
      expect(store.getTestId()).toBe("test-123");
    });

    it("should generate test directory with UUID and timestamp", () => {
      const store = new EvidenceStore("test-abc-123", testOutputBase);
      const testDir = store.getTestDirectory();

      // Should match pattern: output/test-{uuid}-{timestamp} (path.join normalizes ./)
      expect(testDir).toMatch(/test-test-abc-123-\d{8}T\d{6}$/);
    });

    it("should use default output directory when not specified", () => {
      const store = new EvidenceStore("test-456");
      const testDir = store.getTestDirectory();

      expect(testDir).toMatch(/output\/test-test-456-\d{8}T\d{6}$/);
    });

    it("should set subdirectory paths correctly", () => {
      const store = new EvidenceStore("test-789", testOutputBase);
      const testDir = store.getTestDirectory();

      expect(store.getScreenshotsDirectory()).toBe(`${testDir}/screenshots`);
      expect(store.getLogsDirectory()).toBe(`${testDir}/logs`);
      expect(store.getReportsDirectory()).toBe(`${testDir}/reports`);
    });
  });

  describe("initialize()", () => {
    it("should create test directory structure", async () => {
      const store = new EvidenceStore("test-123", testOutputBase);
      await store.initialize();

      const testDir = store.getTestDirectory();

      // Verify directories exist
      await access(testDir);
      await access(join(testDir, "screenshots"));
      await access(join(testDir, "logs"));
      await access(join(testDir, "reports"));
    });

    it("should create metadata.json with test metadata", async () => {
      const store = new EvidenceStore("test-456", testOutputBase);
      await store.initialize();

      const testDir = store.getTestDirectory();
      const metadataPath = join(testDir, "metadata.json");

      const metadataContent = await readFile(metadataPath, "utf-8");
      const metadata = JSON.parse(metadataContent);

      expect(metadata).toHaveProperty("testId", "test-456");
      expect(metadata).toHaveProperty("gameUrl");
      expect(metadata).toHaveProperty("timestamp");
      expect(metadata).toHaveProperty("duration");
      expect(metadata).toHaveProperty("agentVersion");
    });

    it("should handle directory creation errors", async () => {
      const store = new EvidenceStore(
        "test-error",
        "/invalid/path/that/does/not/exist",
      );

      await expect(store.initialize()).rejects.toThrow(
        "Failed to initialize evidence store",
      );
    });
  });

  describe("getter methods", () => {
    it("should return correct test directory path", () => {
      const store = new EvidenceStore("test-get-1", testOutputBase);
      const testDir = store.getTestDirectory();

      expect(testDir).toMatch(/test-test-get-1-\d{8}T\d{6}$/);
    });

    it("should return correct screenshots directory path", () => {
      const store = new EvidenceStore("test-get-2", testOutputBase);
      const screenshotsDir = store.getScreenshotsDirectory();

      expect(screenshotsDir).toMatch(
        /test-test-get-2-\d{8}T\d{6}\/screenshots$/,
      );
    });

    it("should return correct logs directory path", () => {
      const store = new EvidenceStore("test-get-3", testOutputBase);
      const logsDir = store.getLogsDirectory();

      expect(logsDir).toMatch(/test-test-get-3-\d{8}T\d{6}\/logs$/);
    });

    it("should return correct reports directory path", () => {
      const store = new EvidenceStore("test-get-4", testOutputBase);
      const reportsDir = store.getReportsDirectory();

      expect(reportsDir).toMatch(/test-test-get-4-\d{8}T\d{6}\/reports$/);
    });

    it("should return correct test ID", () => {
      const store = new EvidenceStore("test-get-5", testOutputBase);

      expect(store.getTestId()).toBe("test-get-5");
    });
  });

  describe("directory structure", () => {
    it("should create unique directories for different test IDs", () => {
      const store1 = new EvidenceStore("test-unique-1", testOutputBase);
      const store2 = new EvidenceStore("test-unique-2", testOutputBase);

      const testDir1 = store1.getTestDirectory();
      const testDir2 = store2.getTestDirectory();

      expect(testDir1).not.toBe(testDir2);
      expect(testDir1).toContain("test-unique-1");
      expect(testDir2).toContain("test-unique-2");
    });

    it("should create unique directories for same test ID at different times", () => {
      const store1 = new EvidenceStore("test-same-id", testOutputBase);
      const testDir1 = store1.getTestDirectory();

      const store2 = new EvidenceStore("test-same-id", testOutputBase);
      const testDir2 = store2.getTestDirectory();

      expect(testDir1).toContain("test-same-id");
      expect(testDir2).toContain("test-same-id");
    });
  });

  describe("metadata", () => {
    it("should store metadata with all required TestMetadata fields", async () => {
      const store = new EvidenceStore("test-metadata", testOutputBase);
      await store.initialize();

      const testDir = store.getTestDirectory();
      const metadataPath = join(testDir, "metadata.json");
      const metadataContent = await readFile(metadataPath, "utf-8");
      const metadata = JSON.parse(metadataContent);

      expect(metadata).toHaveProperty("testId");
      expect(metadata).toHaveProperty("gameUrl");
      expect(metadata).toHaveProperty("timestamp");
      expect(metadata).toHaveProperty("duration");
      expect(metadata).toHaveProperty("agentVersion");

      expect(typeof metadata.testId).toBe("string");
      expect(typeof metadata.gameUrl).toBe("string");
      expect(typeof metadata.timestamp).toBe("string");
      expect(typeof metadata.duration).toBe("number");
      expect(typeof metadata.agentVersion).toBe("string");
    });

    it("should store metadata with ISO 8601 timestamp", async () => {
      const store = new EvidenceStore("test-iso", testOutputBase);
      await store.initialize();

      const metadata = await store.getMetadata();
      expect(metadata?.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it("should store formatted JSON metadata", async () => {
      const store = new EvidenceStore("test-format", testOutputBase);
      await store.initialize();

      const testDir = store.getTestDirectory();
      const metadataPath = join(testDir, "metadata.json");
      const metadataContent = await readFile(metadataPath, "utf-8");

      expect(metadataContent).toContain("\n");
      expect(metadataContent).toContain("  ");
    });
  });

  describe("captureScreenshot()", () => {
    it("should save screenshot with correct naming format", async () => {
      const store = new EvidenceStore("test-screenshot", testOutputBase);
      await store.initialize();

      const imageBuffer = Buffer.from("fake-image-data");
      const screenshotPath = await store.captureScreenshot(
        imageBuffer,
        "Initial page load",
      );

      expect(screenshotPath).toMatch(/00-initial-page-load\.png$/);

      // Verify file exists
      const content = await readFile(screenshotPath);
      expect(content.toString()).toBe("fake-image-data");
    });

    it("should increment sequence counter correctly", async () => {
      const store = new EvidenceStore("test-seq", testOutputBase);
      await store.initialize();

      const buffer = Buffer.from("test");

      const path1 = await store.captureScreenshot(buffer, "First action");
      const path2 = await store.captureScreenshot(buffer, "Second action");
      const path3 = await store.captureScreenshot(buffer, "Third action");

      expect(path1).toMatch(/00-first-action\.png$/);
      expect(path2).toMatch(/01-second-action\.png$/);
      expect(path3).toMatch(/02-third-action\.png$/);
    });

    it("should sanitize action description to kebab-case", async () => {
      const store = new EvidenceStore("test-kebab", testOutputBase);
      await store.initialize();

      const buffer = Buffer.from("test");

      const path1 = await store.captureScreenshot(buffer, "Click Start Button");
      const path2 = await store.captureScreenshot(
        buffer,
        "Type User@Email.com",
      );
      const path3 = await store.captureScreenshot(
        buffer,
        "Press  Multiple   Spaces",
      );

      expect(path1).toMatch(/00-click-start-button\.png$/);
      expect(path2).toMatch(/01-type-user-email-com\.png$/);
      expect(path3).toMatch(/02-press-multiple-spaces\.png$/);
    });

    it("should truncate action description to max 30 chars", async () => {
      const store = new EvidenceStore("test-truncate", testOutputBase);
      await store.initialize();

      const buffer = Buffer.from("test");
      const longDescription =
        "This is a very long action description that exceeds the maximum length";

      const path = await store.captureScreenshot(buffer, longDescription);

      const filename = path.split("/").pop() || "";
      const descriptionPart = filename
        .replace(/^\d{2}-/, "")
        .replace(/\.png$/, "");

      expect(descriptionPart.length).toBeLessThanOrEqual(30);
      expect(descriptionPart).toBe("this-is-a-very-long-action-des");
    });

    it("should remove special characters from description", async () => {
      const store = new EvidenceStore("test-special", testOutputBase);
      await store.initialize();

      const buffer = Buffer.from("test");

      const path1 = await store.captureScreenshot(
        buffer,
        'Click "Start" Button!',
      );
      const path2 = await store.captureScreenshot(buffer, "Action #1 (test)");
      const path3 = await store.captureScreenshot(buffer, "Item @ position $5");

      expect(path1).toMatch(/00-click-start-button\.png$/);
      expect(path2).toMatch(/01-action-1-test\.png$/);
      expect(path3).toMatch(/02-item-position-5\.png$/);
    });
  });

  describe("log collection methods", () => {
    it("collectConsoleLog should append to console.log with correct format", async () => {
      const store = new EvidenceStore("test-console", testOutputBase);
      await store.initialize();

      await store.collectConsoleLog("Page loaded successfully");

      const logPath = store.getLogPath("console");
      const logContent = await readFile(logPath, "utf-8");

      expect(logContent).toMatch(
        /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[CONSOLE\] Page loaded successfully\n$/,
      );
    });

    it("collectActionLog should append to actions.log with correct format", async () => {
      const store = new EvidenceStore("test-action", testOutputBase);
      await store.initialize();

      await store.collectActionLog("Click button", {
        selector: "#start",
        result: "success",
      });

      const logPath = store.getLogPath("actions");
      const logContent = await readFile(logPath, "utf-8");

      expect(logContent).toMatch(/\[ACTION\] Click button:/);
      expect(logContent).toContain('"selector":"#start"');
      expect(logContent).toContain('"result":"success"');
    });

    it("collectErrorLog should append to errors.log with Error object", async () => {
      const store = new EvidenceStore("test-error-obj", testOutputBase);
      await store.initialize();

      const testError = new Error("Network timeout");
      await store.collectErrorLog(testError, { url: "https://example.com" });

      const logPath = store.getLogPath("errors");
      const logContent = await readFile(logPath, "utf-8");

      expect(logContent).toMatch(/\[ERROR\] Network timeout/);
      expect(logContent).toMatch(/stack:/);
      expect(logContent).toContain("https://example.com");
    });

    it("collectErrorLog should handle string errors", async () => {
      const store = new EvidenceStore("test-error-str", testOutputBase);
      await store.initialize();

      await store.collectErrorLog("Something went wrong");

      const logPath = store.getLogPath("errors");
      const logContent = await readFile(logPath, "utf-8");

      expect(logContent).toMatch(/\[ERROR\] Something went wrong/);
      expect(logContent).toMatch(/stack: N\/A/);
    });

    it("should append multiple console logs in sequence", async () => {
      const store = new EvidenceStore("test-multi-console", testOutputBase);
      await store.initialize();

      await store.collectConsoleLog("First log");
      await store.collectConsoleLog("Second log");
      await store.collectConsoleLog("Third log");

      const logPath = store.getLogPath("console");
      const logContent = await readFile(logPath, "utf-8");
      const lines = logContent.split("\n").filter((l) => l.length > 0);

      expect(lines).toHaveLength(3);
      expect(lines[0]).toContain("First log");
      expect(lines[1]).toContain("Second log");
      expect(lines[2]).toContain("Third log");
    });
  });

  describe("Evidence retrieval methods", () => {
    describe("getScreenshots()", () => {
      it("should return array of screenshot file paths", async () => {
        const store = new EvidenceStore("test-get-screenshots", testOutputBase);
        await store.initialize();

        await store.captureScreenshot(Buffer.from("img1"), "Initial load");
        await store.captureScreenshot(Buffer.from("img2"), "Click button");
        await store.captureScreenshot(Buffer.from("img3"), "Game state");

        const screenshots = await store.getScreenshots();

        expect(screenshots).toHaveLength(3);
        expect(screenshots[0]).toMatch(/00-initial-load\.png$/);
        expect(screenshots[1]).toMatch(/01-click-button\.png$/);
        expect(screenshots[2]).toMatch(/02-game-state\.png$/);
      });

      it("should return empty array when directory is empty", async () => {
        const store = new EvidenceStore("test-empty-dir", testOutputBase);
        await store.initialize();

        const screenshots = await store.getScreenshots();
        expect(screenshots).toEqual([]);
      });

      it("should sort screenshots by sequence number", async () => {
        const store = new EvidenceStore("test-sort", testOutputBase);
        await store.initialize();

        // Create screenshots
        for (let i = 0; i < 12; i++) {
          await store.captureScreenshot(Buffer.from(`img${i}`), `Action ${i}`);
        }

        const screenshots = await store.getScreenshots();

        // Natural sort should order them correctly
        expect(screenshots[0]).toMatch(/00-action-0\.png$/);
        expect(screenshots[1]).toMatch(/01-action-1\.png$/);
        expect(screenshots[9]).toMatch(/09-action-9\.png$/);
        expect(screenshots[10]).toMatch(/10-action-10\.png$/);
        expect(screenshots[11]).toMatch(/11-action-11\.png$/);
      });
    });

    describe("getLogPath()", () => {
      it("should return path for console log", () => {
        const store = new EvidenceStore("test-console-path", testOutputBase);
        const path = store.getLogPath("console");
        expect(path).toMatch(/logs\/console\.log$/);
      });

      it("should return path for actions log", () => {
        const store = new EvidenceStore("test-actions-path", testOutputBase);
        const path = store.getLogPath("actions");
        expect(path).toMatch(/logs\/actions\.log$/);
      });

      it("should return path for errors log", () => {
        const store = new EvidenceStore("test-errors-path", testOutputBase);
        const path = store.getLogPath("errors");
        expect(path).toMatch(/logs\/errors\.log$/);
      });

      it("should return null for invalid log type", () => {
        const store = new EvidenceStore("test-invalid-type", testOutputBase);
        // @ts-expect-error - Testing invalid input
        const path = store.getLogPath("invalid");
        expect(path).toBeNull();
      });
    });

    describe("getMetadata()", () => {
      it("should return parsed metadata object", async () => {
        const store = new EvidenceStore("test-get-metadata", testOutputBase);
        await store.initialize();

        const metadata = await store.getMetadata();

        expect(metadata?.testId).toBe("test-get-metadata");
        expect(metadata).toHaveProperty("gameUrl");
        expect(metadata).toHaveProperty("timestamp");
        expect(metadata).toHaveProperty("duration");
        expect(metadata).toHaveProperty("agentVersion");
      });

      it("should return null when metadata file is missing", async () => {
        const store = new EvidenceStore(
          "test-missing-metadata",
          testOutputBase,
        );
        // Don't initialize - no metadata file exists

        const metadata = await store.getMetadata();
        expect(metadata).toBeNull();
      });
    });

    describe("getAllEvidence()", () => {
      it("should return complete evidence collection", async () => {
        const store = new EvidenceStore("test-all-evidence", testOutputBase);
        await store.initialize();

        await store.captureScreenshot(Buffer.from("img1"), "Initial");
        await store.captureScreenshot(Buffer.from("img2"), "Action");
        await store.collectConsoleLog("Test log");
        await store.collectActionLog("Test action", { test: true });

        const evidence = await store.getAllEvidence();

        expect(evidence).toHaveProperty("screenshots");
        expect(evidence).toHaveProperty("logs");
        expect(evidence).toHaveProperty("metadata");
        expect(evidence.screenshots).toHaveLength(2);
        expect(evidence.logs.console).toMatch(/logs\/console\.log$/);
        expect(evidence.logs.actions).toMatch(/logs\/actions\.log$/);
        expect(evidence.logs.errors).toMatch(/logs\/errors\.log$/);
        expect(evidence.metadata?.testId).toBe("test-all-evidence");
      });

      it("should handle empty evidence collection", async () => {
        const store = new EvidenceStore("test-empty-evidence", testOutputBase);
        await store.initialize();

        const evidence = await store.getAllEvidence();

        expect(evidence.screenshots).toEqual([]);
        expect(evidence.metadata?.testId).toBe("test-empty-evidence");
        expect(evidence.logs.console).toBeTruthy();
      });
    });
  });
});
