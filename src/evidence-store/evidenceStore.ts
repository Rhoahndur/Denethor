/**
 * Evidence Store for capturing and organizing test artifacts.
 *
 * Manages the creation and organization of test evidence including screenshots,
 * logs, and reports in a structured directory hierarchy.
 *
 * @module evidenceStore
 *
 * @example
 * ```typescript
 * import { EvidenceStore } from '@/evidence-store/evidenceStore';
 *
 * // Create evidence store for a test
 * const store = new EvidenceStore('test-uuid-123', './output');
 * await store.initialize();
 *
 * // Directory structure created:
 * // output/test-uuid-123-20251103T120000/
 * //   ├── screenshots/
 * //   ├── logs/
 * //   ├── reports/
 * //   └── metadata.json
 * ```
 */

import {
  appendFile,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import type { TestMetadata } from "@/types";
import { logger } from "@/utils/logger";
import { getVersion } from "@/utils/version";

/**
 * Valid log types for evidence collection.
 */
export type LogType = "console" | "actions" | "errors";

/**
 * Complete evidence collection for a test.
 */
export interface EvidenceCollection {
  /** Array of screenshot file paths */
  screenshots: string[];
  /** Paths to log files by type */
  logs: {
    console: string | null;
    actions: string | null;
    errors: string | null;
  };
  /** Test metadata */
  metadata: TestMetadata | null;
}

const log = logger.child({ component: "EvidenceStore" });

/**
 * Evidence Store for managing test artifacts and evidence collection.
 *
 * Creates a structured directory hierarchy for organizing screenshots, logs,
 * and reports from test executions. Each test gets a unique directory with
 * a timestamp to ensure no conflicts.
 *
 * **Directory Structure:**
 * ```
 * output/test-{uuid}-{timestamp}/
 *   ├── screenshots/     - Screenshot evidence files
 *   ├── logs/            - Console, action, and error logs
 *   ├── reports/         - Generated QA reports (JSON, MD, HTML)
 *   └── metadata.json    - Test metadata
 * ```
 *
 * @example
 * ```typescript
 * const store = new EvidenceStore('abc-123', './output');
 * await store.initialize();
 *
 * console.log(store.testDirectory);
 * // => './output/test-abc-123-20251103T120000'
 *
 * console.log(store.screenshotsDir);
 * // => './output/test-abc-123-20251103T120000/screenshots'
 * ```
 */
export class EvidenceStore {
  /** Unique test identifier (UUID) */
  private readonly testId: string;

  /** Full path to test-specific directory */
  private readonly testDirectory: string;

  /** Path to screenshots subdirectory */
  private readonly screenshotsDir: string;

  /** Path to logs subdirectory */
  private readonly logsDir: string;

  /** Path to reports subdirectory */
  private readonly reportsDir: string;

  /** Test start timestamp */
  private readonly timestamp: string;

  /** Screenshot sequence counter for auto-naming */
  private sequenceCounter: number;

  /**
   * Creates a new Evidence Store instance.
   *
   * @param testId - Unique test identifier (UUID format recommended)
   * @param outputDir - Base output directory path (default: './output')
   *
   * @example
   * ```typescript
   * const store = new EvidenceStore('test-uuid-123', './output');
   * await store.initialize();
   * ```
   */
  constructor(testId: string, outputDir = "./output") {
    this.testId = testId;
    this.sequenceCounter = 0; // Initialize screenshot sequence counter

    // Generate timestamp in ISO 8601 format (compact for directory name)
    this.timestamp =
      new Date().toISOString().split(".")[0]?.replace(/[-:]/g, "") || ""; // 20251103T120000

    // Generate test directory name: test-{uuid}-{timestamp}
    const testDirName = `test-${testId}-${this.timestamp}`;
    this.testDirectory = join(outputDir, testDirName);

    // Define subdirectory paths
    this.screenshotsDir = join(this.testDirectory, "screenshots");
    this.logsDir = join(this.testDirectory, "logs");
    this.reportsDir = join(this.testDirectory, "reports");

    log.debug(
      {
        testId,
        testDirectory: this.testDirectory,
      },
      "EvidenceStore instance created",
    );
  }

  /**
   * Initializes the evidence store by creating the directory structure
   * and storing test metadata.
   *
   * Creates:
   * - Main test directory
   * - Screenshots subdirectory
   * - Logs subdirectory
   * - Reports subdirectory
   * - metadata.json file
   *
   * @throws Error if directory creation fails
   *
   * @example
   * ```typescript
   * const store = new EvidenceStore('test-123', './output');
   * await store.initialize();
   * ```
   */
  async initialize(): Promise<void> {
    try {
      log.info(
        { testDirectory: this.testDirectory },
        "Initializing evidence store",
      );

      // Create main test directory and all subdirectories
      await mkdir(this.testDirectory, { recursive: true });
      log.debug({ directory: this.testDirectory }, "Created test directory");

      await mkdir(this.screenshotsDir, { recursive: true });
      log.debug(
        { directory: this.screenshotsDir },
        "Created screenshots directory",
      );

      await mkdir(this.logsDir, { recursive: true });
      log.debug({ directory: this.logsDir }, "Created logs directory");

      await mkdir(this.reportsDir, { recursive: true });
      log.debug({ directory: this.reportsDir }, "Created reports directory");

      // Create empty log files so they always exist
      await this.createEmptyLogFiles();

      // Create and store test metadata
      await this.storeMetadata();

      log.info(
        {
          testId: this.testId,
          testDirectory: this.testDirectory,
        },
        "Evidence store initialized successfully",
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        {
          error: err.message,
          testId: this.testId,
          testDirectory: this.testDirectory,
        },
        "Failed to initialize evidence store",
      );
      throw new Error(`Failed to initialize evidence store: ${err.message}`);
    }
  }

  /**
   * Creates empty log files to ensure they always exist.
   *
   * This prevents file-not-found errors when reading logs later,
   * even if no logs were collected during the test.
   *
   * @private
   */
  private async createEmptyLogFiles(): Promise<void> {
    const logFiles = ["console.log", "actions.log", "errors.log"];

    for (const logFile of logFiles) {
      const logPath = join(this.logsDir, logFile);
      try {
        await writeFile(logPath, "", "utf-8");
        log.debug({ logPath }, "Created empty log file");
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        log.error({ error: err.message, logPath }, "Failed to create log file");
        throw new Error(`Failed to create log file: ${err.message}`);
      }
    }
  }

  /**
   * Stores test metadata to metadata.json.
   *
   * @private
   */
  private async storeMetadata(): Promise<void> {
    const metadata: TestMetadata = {
      testId: this.testId,
      gameUrl: "", // Will be set by test orchestrator
      timestamp: new Date().toISOString(),
      duration: 0, // Will be updated on test completion
      agentVersion: getVersion(),
      browserSettings: {
        browser: "chrome",
        viewport: { width: 1280, height: 720 },
        arguments: [],
        device: "desktop",
        locale: "en-US",
      },
    };

    const metadataPath = join(this.testDirectory, "metadata.json");

    try {
      await writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
      log.debug({ metadataPath }, "Stored test metadata");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        { error: err.message, metadataPath },
        "Failed to store metadata",
      );
      throw new Error(`Failed to store metadata: ${err.message}`);
    }
  }

  /**
   * Gets the path to the test directory.
   *
   * @returns Full path to the test directory
   */
  getTestDirectory(): string {
    return this.testDirectory;
  }

  /**
   * Gets the path to the screenshots directory.
   *
   * @returns Full path to the screenshots directory
   */
  getScreenshotsDirectory(): string {
    return this.screenshotsDir;
  }

  /**
   * Gets the path to the logs directory.
   *
   * @returns Full path to the logs directory
   */
  getLogsDirectory(): string {
    return this.logsDir;
  }

  /**
   * Gets the path to the reports directory.
   *
   * @returns Full path to the reports directory
   */
  getReportsDirectory(): string {
    return this.reportsDir;
  }

  /**
   * Gets the test ID.
   *
   * @returns Test identifier
   */
  getTestId(): string {
    return this.testId;
  }

  /**
   * Captures and saves a screenshot with automatic naming.
   *
   * Generates filenames in the format: `{sequence}-{action-description}.png`
   * where sequence is a zero-padded 2-digit number (00-99) and action description
   * is sanitized to kebab-case with max 30 characters.
   *
   * @param imageBuffer - Screenshot image data as Buffer
   * @param actionDescription - Human-readable description of the action
   * @returns Full path to the saved screenshot
   * @throws Error if screenshot save fails
   *
   * @example
   * ```typescript
   * const screenshotPath = await store.captureScreenshot(
   *   imageBuffer,
   *   'Initial page load'
   * );
   * // => './output/test-abc-123-20251103T120000/screenshots/00-initial-page-load.png'
   * ```
   */
  async captureScreenshot(
    imageBuffer: Buffer,
    actionDescription: string,
  ): Promise<string> {
    try {
      // Format sequence number with zero padding (00-99)
      const sequence = String(this.sequenceCounter).padStart(2, "0");

      // Sanitize action description
      const sanitized = this.sanitizeDescription(actionDescription);

      // Generate filename: {sequence}-{description}.png
      const filename = `${sequence}-${sanitized}.png`;
      const screenshotPath = join(this.screenshotsDir, filename);

      // Write screenshot to file
      await writeFile(screenshotPath, imageBuffer);

      // Increment sequence counter for next screenshot
      this.sequenceCounter++;

      log.debug(
        {
          sequence,
          filename,
          path: screenshotPath,
          description: actionDescription,
        },
        "Screenshot captured",
      );

      return screenshotPath;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        {
          error: err.message,
          sequence: this.sequenceCounter,
          description: actionDescription,
        },
        "Failed to capture screenshot",
      );
      throw new Error(`Failed to capture screenshot: ${err.message}`);
    }
  }

  /**
   * Sanitizes action description for use in filename.
   *
   * Converts to lowercase, replaces spaces and special characters with hyphens,
   * removes consecutive hyphens, and truncates to max 30 characters.
   *
   * @param description - Raw action description
   * @returns Sanitized kebab-case string
   * @private
   *
   * @example
   * sanitizeDescription('Initial Page Load!') => 'initial-page-load'
   * sanitizeDescription('Click "Start Game" Button') => 'click-start-game-button'
   * sanitizeDescription('Very Long Description That Exceeds Maximum Length') => 'very-long-description-that-ex'
   */
  private sanitizeDescription(description: string): string {
    return description
      .toLowerCase() // Convert to lowercase
      .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
      .replace(/-+/g, "-") // Replace consecutive hyphens with single hyphen
      .replace(/^-|-$/g, "") // Remove leading/trailing hyphens
      .substring(0, 30); // Truncate to max 30 chars
  }

  /**
   * Collects and appends a console log entry.
   *
   * Appends console output to logs/console.log with ISO 8601 timestamp.
   * Creates file if it doesn't exist, appends if it does.
   *
   * @param message - Console message to log
   * @throws Error if log write fails
   *
   * @example
   * ```typescript
   * await store.collectConsoleLog('Page loaded successfully');
   * // Appends to logs/console.log:
   * // [2025-11-04T16:30:00.123Z] [CONSOLE] Page loaded successfully
   * ```
   */
  async collectConsoleLog(message: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] [CONSOLE] ${message}\n`;
      const logPath = join(this.logsDir, "console.log");

      await appendFile(logPath, logEntry, "utf-8");

      log.debug(
        {
          logType: "console",
          path: logPath,
          message: message.substring(0, 100), // Truncate for logging
        },
        "Console log collected",
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        {
          error: err.message,
          logType: "console",
          message: message.substring(0, 100),
        },
        "Failed to collect console log",
      );
      throw new Error(`Failed to collect console log: ${err.message}`);
    }
  }

  /**
   * Collects and appends an action log entry.
   *
   * Appends action taken by the agent to logs/actions.log with ISO 8601 timestamp
   * and structured details.
   *
   * @param action - Description of the action taken
   * @param details - Additional structured details about the action
   * @throws Error if log write fails
   *
   * @example
   * ```typescript
   * await store.collectActionLog('Click button', { selector: '#start-btn', result: 'success' });
   * // Appends to logs/actions.log:
   * // [2025-11-04T16:30:00.123Z] [ACTION] Click button: {"selector":"#start-btn","result":"success"}
   * ```
   */
  async collectActionLog(
    action: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const detailsJson = JSON.stringify(details);
      const logEntry = `[${timestamp}] [ACTION] ${action}: ${detailsJson}\n`;
      const logPath = join(this.logsDir, "actions.log");

      await appendFile(logPath, logEntry, "utf-8");

      log.debug(
        {
          logType: "action",
          path: logPath,
          action,
          details,
        },
        "Action log collected",
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        {
          error: err.message,
          logType: "action",
          action,
        },
        "Failed to collect action log",
      );
      throw new Error(`Failed to collect action log: ${err.message}`);
    }
  }

  /**
   * Collects and appends an error log entry.
   *
   * Appends error information to logs/errors.log with ISO 8601 timestamp,
   * error message, stack trace (if available), and optional context.
   *
   * @param error - Error object or error message string
   * @param context - Optional additional context about the error
   * @throws Error if log write fails
   *
   * @example
   * ```typescript
   * await store.collectErrorLog(new Error('Network timeout'), { url: 'https://example.com' });
   * // Appends to logs/errors.log:
   * // [2025-11-04T16:30:00.123Z] [ERROR] Network timeout | stack: Error: Network timeout... | context: {"url":"https://example.com"}
   * ```
   */
  async collectErrorLog(
    error: Error | string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString();

      // Extract error message and stack
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack =
        error instanceof Error ? error.stack || "No stack trace" : "N/A";

      // Build log entry with optional context
      const contextJson = context ? JSON.stringify(context) : "{}";
      const logEntry = `[${timestamp}] [ERROR] ${errorMessage} | stack: ${errorStack} | context: ${contextJson}\n`;
      const logPath = join(this.logsDir, "errors.log");

      await appendFile(logPath, logEntry, "utf-8");

      log.debug(
        {
          logType: "error",
          path: logPath,
          error: errorMessage,
          context,
        },
        "Error log collected",
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      log.error(
        {
          error: error.message,
          logType: "error",
        },
        "Failed to collect error log",
      );
      throw new Error(`Failed to collect error log: ${error.message}`);
    }
  }

  /**
   * Saves DOM analysis to a JSON file for later reference.
   *
   * Stores comprehensive DOM structure analysis in logs/dom-analysis.json.
   * This provides context about page elements, canvases, and interactive
   * components for debugging and analysis.
   *
   * @param domAnalysis - DOM analysis data to save
   * @throws Error if file write fails
   *
   * @example
   * ```typescript
   * const domAnalysis = await browserAgent.analyzeDOMElements();
   * await store.saveDOMAnalysis(domAnalysis);
   * // Creates logs/dom-analysis.json with structured element data
   * ```
   */
  async saveDOMAnalysis(domAnalysis: unknown): Promise<void> {
    const data = domAnalysis as Record<string, unknown>;
    try {
      const filePath = join(this.logsDir, "dom-analysis.json");
      await writeFile(filePath, JSON.stringify(domAnalysis, null, 2), "utf-8");

      log.debug(
        {
          path: filePath,
          elementsCount: {
            buttons: (data.buttons as unknown[])?.length || 0,
            canvases: (data.canvases as unknown[])?.length || 0,
            interactive: data.interactiveCount || 0,
          },
        },
        "DOM analysis saved",
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        {
          error: err.message,
        },
        "Failed to save DOM analysis",
      );
      throw new Error(`Failed to save DOM analysis: ${err.message}`);
    }
  }

  /**
   * Retrieves all screenshot file paths from the screenshots directory.
   *
   * Returns an array of full paths to all screenshot files, sorted by
   * sequence number (00-99). Returns empty array if directory is empty
   * or if read fails.
   *
   * @returns Array of screenshot file paths
   *
   * @example
   * ```typescript
   * const screenshots = await store.getScreenshots();
   * // => [
   * //   './output/test-abc-123-20251104T120000/screenshots/00-initial-load.png',
   * //   './output/test-abc-123-20251104T120000/screenshots/01-click-button.png'
   * // ]
   * ```
   */
  async getScreenshots(): Promise<string[]> {
    try {
      const files = await readdir(this.screenshotsDir);

      // Filter for PNG files and construct full paths
      const screenshots = files
        .filter((file) => file.endsWith(".png"))
        .sort() // Natural sort by filename (sequence-based naming ensures correct order)
        .map((file) => join(this.screenshotsDir, file));

      log.debug(
        {
          count: screenshots.length,
          directory: this.screenshotsDir,
        },
        "Retrieved screenshots",
      );

      return screenshots;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        {
          error: err.message,
          directory: this.screenshotsDir,
        },
        "Failed to retrieve screenshots",
      );
      // Return empty array on error (graceful handling)
      return [];
    }
  }

  /**
   * Gets the full path to a specific log file.
   *
   * Returns the path to the specified log file type. Returns null
   * for invalid log types.
   *
   * @param logType - Type of log file ('console' | 'actions' | 'errors')
   * @returns Full path to log file, or null if invalid type
   *
   * @example
   * ```typescript
   * const consolePath = await store.getLogPath('console');
   * // => './output/test-abc-123-20251104T120000/logs/console.log'
   *
   * const invalid = await store.getLogPath('invalid');
   * // => null
   * ```
   */
  getLogPath(logType: LogType): string | null {
    // Map log type to filename
    const logFileMap: Record<LogType, string> = {
      console: "console.log",
      actions: "actions.log",
      errors: "errors.log",
    };

    const filename = logFileMap[logType];
    if (!filename) {
      log.warn({ logType }, "Invalid log type requested");
      return null;
    }

    const logPath = join(this.logsDir, filename);
    log.debug({ logType, path: logPath }, "Retrieved log path");

    return logPath;
  }

  /**
   * Gets the path to a subdirectory within the test directory.
   *
   * @param subdirName - Name of subdirectory (e.g., "templates", "cache")
   * @returns Full path to the subdirectory
   *
   * @example
   * ```typescript
   * const templatesPath = store.getSubdirectoryPath('templates');
   * // => './output/test-abc-123-20251104T120000/templates'
   * ```
   */
  getSubdirectoryPath(subdirName: string): string {
    return join(this.testDirectory, subdirName);
  }

  /**
   * Reads a screenshot file from disk.
   *
   * @param screenshotPath - Full path to screenshot file
   * @returns Screenshot buffer
   * @throws Error if file doesn't exist or can't be read
   *
   * @example
   * ```typescript
   * const screenshot = await store.readScreenshot('./screenshots/action-1-before.png');
   * ```
   */
  async readScreenshot(screenshotPath: string): Promise<Buffer> {
    try {
      const { readFile } = await import("node:fs/promises");
      return await readFile(screenshotPath);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ error: err.message, screenshotPath }, "Failed to read screenshot");
      throw new Error(`Failed to read screenshot: ${err.message}`);
    }
  }

  /**
   * Retrieves and parses the test metadata.
   *
   * Reads the metadata.json file and returns the parsed TestMetadata object.
   * Returns null if the file doesn't exist or if parsing fails.
   *
   * @returns Parsed test metadata, or null if unavailable
   *
   * @example
   * ```typescript
   * const metadata = await store.getMetadata();
   * // => {
   * //   testId: 'abc-123',
   * //   gameUrl: 'https://example.com/game',
   * //   timestamp: '2025-11-04T16:30:00.000Z',
   * //   duration: 45000,
   * //   agentVersion: '1.0.0'
   * // }
   * ```
   */
  async getMetadata(): Promise<TestMetadata | null> {
    try {
      const metadataPath = join(this.testDirectory, "metadata.json");
      const content = await readFile(metadataPath, "utf-8");
      const metadata = JSON.parse(content) as TestMetadata;

      log.debug(
        {
          testId: metadata.testId,
          path: metadataPath,
        },
        "Retrieved metadata",
      );

      return metadata;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        {
          error: err.message,
          testDirectory: this.testDirectory,
        },
        "Failed to retrieve metadata",
      );
      // Return null on error (graceful handling)
      return null;
    }
  }

  /**
   * Retrieves all evidence collected for the test.
   *
   * Returns a complete evidence collection including screenshots, log paths,
   * and metadata. This is a convenience method that aggregates all retrieval
   * methods.
   *
   * @returns Complete evidence collection
   *
   * @example
   * ```typescript
   * const evidence = await store.getAllEvidence();
   * // => {
   * //   screenshots: ['./output/.../screenshots/00-load.png', ...],
   * //   logs: {
   * //     console: './output/.../logs/console.log',
   * //     actions: './output/.../logs/actions.log',
   * //     errors: './output/.../logs/errors.log'
   * //   },
   * //   metadata: { testId: '...', ... }
   * // }
   * ```
   */
  async getAllEvidence(): Promise<EvidenceCollection> {
    try {
      const [screenshots, metadata] = await Promise.all([
        this.getScreenshots(),
        this.getMetadata(),
      ]);

      const evidence: EvidenceCollection = {
        screenshots,
        logs: {
          console: this.getLogPath("console"),
          actions: this.getLogPath("actions"),
          errors: this.getLogPath("errors"),
        },
        metadata,
      };

      log.debug(
        {
          screenshotCount: screenshots.length,
          hasMetadata: metadata !== null,
        },
        "Retrieved all evidence",
      );

      return evidence;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        {
          error: err.message,
          testDirectory: this.testDirectory,
        },
        "Failed to retrieve all evidence",
      );
      throw new Error(`Failed to retrieve all evidence: ${err.message}`);
    }
  }
}
