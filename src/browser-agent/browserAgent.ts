/**
 * Browser Agent for automated game testing via Browserbase.
 *
 * Manages browser session lifecycle and provides the foundation for
 * automated browser interactions. Integrates with Browserbase cloud
 * browsers for reliable, scalable testing.
 *
 * @module browserAgent
 *
 * @example
 * ```typescript
 * import { BrowserAgent } from '@/browser-agent/browserAgent';
 * import { EvidenceStore } from '@/evidence-store/evidenceStore';
 *
 * const store = new EvidenceStore('test-123', './output');
 * await store.initialize();
 *
 * const agent = new BrowserAgent('test-123', store);
 * await agent.createSession();
 * // ... perform browser operations
 * await agent.closeSession();
 * ```
 */

import Browserbase from "@browserbasehq/sdk";
import type { Page } from "@browserbasehq/stagehand";
import { Stagehand } from "@browserbasehq/stagehand";
import { RetryableError } from "@/errors/retryableError";
import type { EvidenceStore } from "@/evidence-store/evidenceStore";
import type { DOMAnalysis } from "@/types/qaReport";
import { config } from "@/utils/config";
import { logger } from "@/utils/logger";
import { retry } from "@/utils/retry";
import type { Action } from "./heuristics/types";
import { ObjectRegistry } from "./objectRegistry";
import { TemplateMatcher } from "./templateMatcher";
import { VisionAnalyzer } from "./visionAnalyzer";

const log = logger.child({ component: "BrowserAgent" });

/**
 * Browser session information from Browserbase.
 */
interface BrowserSession {
  /** Unique session identifier */
  id: string;
  /** Session status */
  status?: string;
  /** Additional session metadata */
  [key: string]: unknown;
}

/**
 * Result of executing an action.
 */
export interface ActionExecutionResult {
  /** Whether the action executed successfully */
  success: boolean;
  /** Action that was executed */
  action: Action;
  /** Error message if action failed */
  error?: string;
  /** Screenshot captured before action (if applicable) */
  beforeScreenshot?: string;
  /** Screenshot captured after action (if applicable) */
  afterScreenshot?: string;
  /** Action execution duration in milliseconds (NEW) */
  durationMs?: number;
  /** Action start time in milliseconds since epoch (NEW) */
  startTime?: number;
  /** Action end time in milliseconds since epoch (NEW) */
  endTime?: number;
}

/**
 * Detected game type.
 */
export type GameType =
  | "platformer"     // Side-scrolling, jumping games (Mario-style)
  | "clicker"        // Idle/incremental games (Cookie Clicker)
  | "puzzle"         // Match-3, tile-based puzzle games
  | "visual-novel"   // Story-driven, narrative games with choices
  | "shooter"        // Action games with shooting mechanics
  | "racing"         // Driving/racing games
  | "rpg"            // Role-playing games with stats/inventory
  | "strategy"       // Strategy, tower defense, tactical games
  | "arcade"         // Classic arcade-style games (Pac-Man, Space Invaders)
  | "card"           // Card games (Solitaire, deck-building)
  | "sports"         // Sports games (Soccer, Basketball)
  | "simulation"     // Simulation games (farming, city-building)
  | "generic";       // Fallback for unclassified games

/**
 * Game type detection result.
 */
export interface GameTypeDetectionResult {
  /** Detected game type */
  gameType: GameType;
  /** Confidence in detection (0-100) */
  confidence: number;
  /** Detection method used */
  method: "dom" | "vision";
  /** Reasoning for detection */
  reasoning: string;
}

/**
 * Browser Agent for managing cloud browser sessions via Browserbase.
 *
 * Handles browser session lifecycle (creation, cleanup) and provides
 * the foundation for automated game testing. Integrates with Browserbase
 * for cloud-based browser instances.
 *
 * **Session Lifecycle:**
 * 1. Create agent instance with testId and evidenceStore
 * 2. Call createSession() to start browser
 * 3. Perform browser operations (implemented in later stories)
 * 4. Call closeSession() to cleanup
 *
 * @example
 * ```typescript
 * const agent = new BrowserAgent('test-uuid-123', evidenceStore);
 * try {
 *   await agent.createSession();
 *   // Browser operations here
 * } finally {
 *   await agent.closeSession();
 * }
 * ```
 */
export class BrowserAgent {
  /** Browserbase SDK client */
  private readonly browserbaseClient: Browserbase;

  /** Active browser session (null when no session) */
  private session: BrowserSession | null = null;

  /** Stagehand instance for browser control */
  private stagehand: Stagehand | null = null;

  /** Playwright page object */
  private page: Page | null = null;

  /** Unique test identifier */
  private readonly testId: string;

  /** Evidence store for capturing test artifacts */
  private readonly evidenceStore: EvidenceStore;

  /** Browser settings used for this session */
  private browserSettings: {
    browser: string;
    viewport: { width: number; height: number };
    arguments: string[];
    device: string;
    locale: string;
  } | null = null;

  /** Latest DOM analysis from navigateToGame */
  private latestDOMAnalysis: DOMAnalysis | null = null;

  /** Object registry for coordinate mapping */
  private readonly objectRegistry: ObjectRegistry;

  /** Template matcher for precise canvas element location */
  private readonly templateMatcher: TemplateMatcher;

  /**
   * Creates a new Browser Agent instance.
   *
   * Initializes the Browserbase client with credentials from config.
   * Does not create a browser session - call createSession() separately.
   *
   * @param testId - Unique test identifier (UUID format recommended)
   * @param evidenceStore - Evidence store for capturing test artifacts
   *
   * @example
   * ```typescript
   * const store = new EvidenceStore('test-123', './output');
   * await store.initialize();
   * const agent = new BrowserAgent('test-123', store);
   * ```
   */
  constructor(testId: string, evidenceStore: EvidenceStore) {
    this.testId = testId;
    this.evidenceStore = evidenceStore;

    // Initialize Browserbase client with credentials from config
    this.browserbaseClient = new Browserbase({
      apiKey: config.browserbase.apiKey,
    });

    // Initialize object registry
    this.objectRegistry = new ObjectRegistry();

    // Initialize template matcher
    const templateDir = evidenceStore.getSubdirectoryPath("templates");
    this.templateMatcher = new TemplateMatcher(templateDir);

    log.debug(
      {
        testId: this.testId,
        projectId: config.browserbase.projectId,
      },
      "BrowserAgent instance created",
    );
  }

  /**
   * Gets the browser settings used for this session.
   *
   * @returns Browser settings object, or null if session not created
   *
   * @example
   * ```typescript
   * const agent = new BrowserAgent('test-123', evidenceStore);
   * await agent.createSession();
   * const settings = agent.getBrowserSettings();
   * console.log(settings.viewport); // { width: 1280, height: 720 }
   * ```
   */
  getBrowserSettings(): {
    browser: string;
    viewport: { width: number; height: number };
    arguments: string[];
    device: string;
    locale: string;
  } | null {
    return this.browserSettings;
  }

  /**
   * Gets the latest DOM analysis from the most recent navigation.
   *
   * @returns DOM analysis object, or null if navigation hasn't occurred
   *
   * @example
   * ```typescript
   * const agent = new BrowserAgent('test-123', evidenceStore);
   * await agent.createSession();
   * await agent.navigateToGame('https://example.com/game');
   * const domAnalysis = agent.getDOMAnalysis();
   * console.log(`Found ${domAnalysis.buttons.length} buttons`);
   * ```
   */
  getDOMAnalysis(): DOMAnalysis | null {
    return this.latestDOMAnalysis;
  }

  /**
   * Gets the template matcher instance for precise element location.
   *
   * @returns Template matcher instance
   *
   * @example
   * ```typescript
   * const agent = new BrowserAgent('test-123', evidenceStore);
   * await agent.createSession();
   * const matcher = agent.getTemplateMatcher();
   * const match = await matcher.findTemplate(screenshot, 'start-button');
   * ```
   */
  getTemplateMatcher(): TemplateMatcher {
    return this.templateMatcher;
  }

  /**
   * Creates a new Browserbase browser session.
   *
   * Starts a cloud browser instance via Browserbase. The session remains
   * active until closeSession() is called. Network errors are wrapped in
   * RetryableError to allow retry logic.
   *
   * @throws {RetryableError} When session creation fails (network, auth, quota)
   *
   * @example
   * ```typescript
   * const agent = new BrowserAgent('test-123', evidenceStore);
   * await agent.createSession(); // Browser session now active
   * ```
   */
  async createSession(): Promise<void> {
    try {
      log.info({ testId: this.testId }, "Creating Browserbase session");

      // Create session via Browserbase SDK with browser settings
      const session = await this.browserbaseClient.sessions.create({
        projectId: config.browserbase.projectId,
        browserSettings: {
          fingerprint: {
            browsers: ["chrome"], // Use Chrome for consistency
            devices: ["desktop"], // Desktop device
            locales: ["en-US"], // US English
          },
          viewport: {
            width: 1280,
            height: 720,
          },
        },
      });

      // Store session reference and browser settings
      this.session = session as unknown as BrowserSession;
      this.browserSettings = {
        browser: "chrome",
        viewport: { width: 1280, height: 720 },
        arguments: [], // Browserbase manages browser arguments internally
        device: "desktop",
        locale: "en-US",
      };

      log.info(
        {
          testId: this.testId,
          sessionId: this.session.id,
          status: this.session.status,
        },
        "Browserbase session created successfully",
      );

      // Initialize Stagehand with existing Browserbase session
      log.debug(
        {
          testId: this.testId,
          sessionId: this.session.id,
        },
        "Initializing Stagehand with existing session",
      );

      this.stagehand = new Stagehand({
        env: "BROWSERBASE",
        apiKey: config.browserbase.apiKey,
        projectId: config.browserbase.projectId,
        browserbaseSessionID: this.session.id, // Use existing session!
      });

      await this.stagehand.init();
      this.page = this.stagehand.page;

      log.info({ testId: this.testId }, "Stagehand initialized successfully");

      // Initialize template matcher
      await this.templateMatcher.initialize();

      // Set up console log monitoring
      this.setupConsoleListener();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        {
          error: err.message,
          testId: this.testId,
        },
        "Failed to create browser session",
      );
      throw new RetryableError(
        `Failed to create browser session: ${err.message}`,
      );
    }
  }

  /**
   * Closes the active Browserbase session.
   *
   * Cleans up the cloud browser instance. Safe to call multiple times
   * or when no session exists (no-op). Errors during close are logged
   * but not thrown to allow cleanup to complete.
   *
   * @example
   * ```typescript
   * await agent.closeSession(); // Session cleaned up
   * await agent.closeSession(); // Safe to call again (no-op)
   * ```
   */
  async closeSession(): Promise<void> {
    if (!this.session) {
      log.debug({ testId: this.testId }, "No active session to close");
      return;
    }

    const sessionId = this.session.id;

    // Close Stagehand first
    if (this.stagehand) {
      try {
        log.debug({ testId: this.testId }, "Closing Stagehand");
        await this.stagehand.close();
        this.stagehand = null;
        this.page = null;
        log.debug({ testId: this.testId }, "Stagehand closed successfully");
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        log.warn(
          {
            error: err.message,
            testId: this.testId,
          },
          "Error closing Stagehand, continuing with cleanup",
        );
        this.stagehand = null;
        this.page = null;
      }
    }

    // Then close Browserbase session
    try {
      log.info(
        {
          testId: this.testId,
          sessionId,
        },
        "Closing Browserbase session",
      );

      await this.browserbaseClient.sessions.update(sessionId, {
        status: "REQUEST_RELEASE",
        projectId: config.browserbase.projectId,
      });

      log.info(
        {
          testId: this.testId,
          sessionId,
        },
        "Browserbase session closed successfully",
      );

      this.session = null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.warn(
        {
          error: err.message,
          testId: this.testId,
          sessionId,
        },
        "Error closing Browserbase session, continuing with cleanup",
      );
      // Don't throw - allow cleanup to continue
      this.session = null;
    }
  }

  /**
   * Gets the current session ID.
   *
   * @returns Session ID if session exists, null otherwise
   */
  getSessionId(): string | null {
    return this.session?.id ?? null;
  }

  /**
   * Checks if a session is currently active.
   *
   * @returns True if session exists, false otherwise
   */
  hasActiveSession(): boolean {
    return this.session !== null;
  }

  /**
   * Analyzes the DOM to extract interactive elements, canvases, and page structure.
   *
   * This method performs a comprehensive scan of the page DOM to identify:
   * - Buttons and links (potential UI interaction points)
   * - Input fields (for games requiring text/keyboard input)
   * - Canvas elements (HTML5 game containers)
   * - Headings (page structure/titles)
   * - Clickable text elements (non-standard interactive elements)
   *
   * **Use Case:** Layer 0.5 of action strategy - provides DOM context before
   * attempting heuristics or vision analysis.
   *
   * @returns Promise<DOMAnalysis> Structured analysis of page elements
   * @throws {Error} When no active browser session exists
   *
   * @example
   * ```typescript
   * await agent.navigateToGame('https://example.com/game');
   * const domAnalysis = await agent.analyzeDOMElements();
   * console.log(`Found ${domAnalysis.buttons.length} buttons`);
   * console.log(`Found ${domAnalysis.canvases.length} canvas elements`);
   * ```
   */
  async analyzeDOMElements(): Promise<DOMAnalysis> {
    if (!this.page) {
      throw new Error("No active browser session");
    }

    log.debug({ testId: this.testId }, "Analyzing DOM elements");

    const domAnalysis = (await this.page.evaluate(`
      (() => {
      // Helper function to check if element is a download link (out of scope)
      function isDownloadElement(element) {
        // Check href attribute for download indicators
        const href = element.getAttribute("href") || "";
        const downloadAttr = element.hasAttribute("download");

        // Common download file extensions
        const downloadExtensions = [
          ".zip", ".rar", ".7z", ".tar", ".gz",
          ".exe", ".dmg", ".pkg", ".apk", ".ipa",
          ".pdf", ".doc", ".docx", ".xls", ".xlsx",
          ".app", ".deb", ".rpm"
        ];

        const hasDownloadExtension = downloadExtensions.some(ext =>
          href.toLowerCase().endsWith(ext)
        );

        // Check text content for download keywords
        const text = (element.textContent || "").toLowerCase();
        const downloadKeywords = [
          "download",
          "get it on",
          "install",
          "available on",
          ".zip",
          ".exe",
          "windows",
          "macos",
          "linux",
          "android",
          "ios"
        ];

        const hasDownloadKeyword = downloadKeywords.some(keyword =>
          text.includes(keyword) && text.length < 100 // Short text likely a button
        );

        // Check for common download button classes
        const classes = Array.from(element.classList).join(" ").toLowerCase();
        const hasDownloadClass = classes.includes("download") ||
                                 classes.includes("install") ||
                                 classes.includes("get-app");

        // Element is download-related if any indicator is present
        return downloadAttr || hasDownloadExtension ||
               (hasDownloadKeyword && (downloadAttr || hasDownloadExtension || hasDownloadClass));
      }

      // Helper function to extract element info
      function extractElementInfo(element) {
        const rect = element.getBoundingClientRect();
        const hasClickHandler =
          element.hasAttribute("onclick") ||
          element.hasAttribute("ng-click") ||
          element.hasAttribute("@click");

        return {
          tag: element.tagName.toLowerCase(),
          text: (element.textContent || "").trim().substring(0, 200),
          id: element.id || undefined,
          classes: Array.from(element.classList),
          position: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          },
          visible:
            rect.width > 0 && rect.height > 0 && element.offsetParent !== null,
          clickable:
            hasClickHandler ||
            element.tagName === "A" ||
            element.tagName === "BUTTON",
        };
      }

      // Extract buttons (only visible ones, exclude downloads)
      const buttons = Array.from(
        document.querySelectorAll("button, [role='button']"),
      )
        .filter((el) => !isDownloadElement(el)) // Exclude download buttons
        .map(extractElementInfo)
        .filter((el) => (el.text.length > 0 || el.id) && el.visible); // Only visible elements

      // Extract links (only visible ones, exclude downloads)
      const links = Array.from(document.querySelectorAll("a"))
        .filter((el) => !isDownloadElement(el)) // Exclude download links
        .map(extractElementInfo)
        .filter((el) => (el.text.length > 0 || el.id) && el.visible); // Only visible elements

      // Extract inputs
      const inputs = Array.from(document.querySelectorAll("input, textarea"))
        .map(extractElementInfo)
        .filter((el) => el.visible); // Only visible inputs

      // Extract canvases (important for HTML5 games)
      const canvases = Array.from(document.querySelectorAll("canvas")).map(
        function (canvas) {
          const rect = canvas.getBoundingClientRect();
          const area = rect.width * rect.height;

          // Heuristic: primary game canvas is usually large and visible
          const canvasId = canvas.id || "";
          const canvasClass = canvas.className || "";
          const isPrimaryGame =
            area > 100000 &&
            canvas.offsetParent !== null &&
            (canvasId.toLowerCase().includes("game") ||
              canvasId.toLowerCase().includes("unity") ||
              canvasClass.toLowerCase().includes("game"));

          return {
            id: canvas.id || undefined,
            width: canvas.width,
            height: canvas.height,
            position: {
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height,
            },
            visible: canvas.offsetParent !== null,
            isPrimaryGame: isPrimaryGame,
          };
        },
      );

      // Extract headings (help understand page structure)
      const headings = Array.from(
        document.querySelectorAll("h1, h2, h3, h4, h5, h6"),
      )
        .map(extractElementInfo)
        .filter((el) => el.text.length > 0);

      // Extract clickable text (divs/spans with onclick)
      const clickableText = Array.from(
        document.querySelectorAll(
          "div[onclick], span[onclick], div[ng-click], span[ng-click]",
        ),
      )
        .map(extractElementInfo)
        .filter((el) => el.text.length > 0 && el.visible);

      // Get viewport dimensions
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      // Calculate total interactive elements
      const interactiveCount =
        buttons.length + links.length + inputs.length + clickableText.length;

      return {
        buttons,
        links,
        inputs,
        canvases,
        headings,
        clickableText,
        viewport,
        interactiveCount,
      };
      })()
    `)) as DOMAnalysis;

    log.info(
      {
        testId: this.testId,
        buttonsFound: domAnalysis.buttons.length,
        linksFound: domAnalysis.links.length,
        inputsFound: domAnalysis.inputs.length,
        canvasesFound: domAnalysis.canvases.length,
        headingsFound: domAnalysis.headings.length,
        clickableTextFound: domAnalysis.clickableText.length,
        interactiveCount: domAnalysis.interactiveCount,
      },
      "DOM analysis complete (download/install elements excluded)",
    );

    return domAnalysis;
  }

  /**
   * Navigates to the specified game URL.
   *
   * Uses Stagehand to navigate to the game with a 60s timeout.
   * Automatically retries up to 3 times on failure. Waits for page
   * load and captures an initial screenshot after navigation.
   *
   * @param url - Game URL to navigate to
   * @throws {RetryableError} When navigation fails after retries
   *
   * @example
   * ```typescript
   * await agent.createSession();
   * await agent.navigateToGame('https://example.com/game');
   * ```
   */
  async navigateToGame(url: string): Promise<void> {
    return retry(
      async () => {
        if (!this.page) {
          throw new Error("No active browser session");
        }

        log.info({ url, testId: this.testId }, "Navigating to game");

        await this.page.goto(url, {
          timeout: 60000,
          waitUntil: "domcontentloaded",
        });

        await this.waitForLoad();

        // Analyze DOM structure FIRST (Layer 0.5)
        // This gives us comprehensive context about page elements before taking action
        log.info({ testId: this.testId }, "Analyzing DOM structure");
        const domAnalysis = await this.analyzeDOMElements();

        // Store DOM analysis for later use by action strategy
        this.latestDOMAnalysis = domAnalysis;

        // Save DOM analysis to evidence store for debugging and analysis
        await this.evidenceStore.saveDOMAnalysis(domAnalysis);

        // Build object registry from DOM analysis (Layer 0.5)
        log.info({ testId: this.testId }, "Building object registry from DOM");
        this.objectRegistry.buildDOMRegistry(domAnalysis);

        // Log useful DOM insights
        log.info(
          {
            testId: this.testId,
            canvases: domAnalysis.canvases.map((c) => ({
              id: c.id,
              size: `${c.width}x${c.height}`,
              isPrimaryGame: c.isPrimaryGame,
            })),
            buttons: domAnalysis.buttons
              .slice(0, 5)
              .map((b) => ({ text: b.text, id: b.id })),
            interactiveCount: domAnalysis.interactiveCount,
          },
          "DOM analysis results",
        );

        // Look for game start buttons using DOM analysis data (more efficient)
        // Many games have "New Game", "Start", "Play" buttons that need to be clicked
        log.info(
          { testId: this.testId },
          "Looking for game start buttons using DOM analysis",
        );

        // Common button text patterns for game start
        const buttonPatterns = [
          /new\s*game/i,
          /start/i,
          /play\s*now/i,
          /play\s*game/i,
          /^play$/i,
          /begin/i,
          /launch/i,
          /run\s*game/i,
        ];

        // Find start button from DOM analysis
        const startButton = domAnalysis.buttons.find((btn) => {
          return (
            btn.visible &&
            buttonPatterns.some((pattern) => pattern.test(btn.text))
          );
        });

        let startButtonClicked = false;
        if (startButton) {
          log.info(
            {
              testId: this.testId,
              buttonText: startButton.text,
              buttonId: startButton.id,
            },
            "Found start button in DOM analysis, attempting to click",
          );

          // Click the button using its selector (prefer ID, fallback to text)
          try {
            if (startButton.id) {
              await this.page.click(`#${startButton.id}`);
            } else {
              // Click by position if no ID available
              await this.page.mouse.click(
                startButton.position.x + startButton.position.width / 2,
                startButton.position.y + startButton.position.height / 2,
              );
            }
            startButtonClicked = true;
            log.info(
              { testId: this.testId, buttonText: startButton.text },
              "Clicked start button successfully",
            );
            // Wait briefly for game to react to button click
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (error) {
            log.warn(
              {
                testId: this.testId,
                buttonText: startButton.text,
                error: error instanceof Error ? error.message : String(error),
              },
              "Failed to click start button, will try other methods",
            );
          }
        } else {
          log.info(
            { testId: this.testId },
            "No start button found in DOM analysis",
          );
        }

        // Now check if scrolling is needed using canvas info from DOM analysis
        // Only scroll if we didn't click a start button (to avoid scrolling away from UI)
        log.info({ testId: this.testId }, "Checking if game needs scrolling");

        let needsScroll = false;

        // Use DOM analysis canvas data for smart scrolling
        if (domAnalysis.canvases.length > 0) {
          // Find primary game canvas or largest visible canvas
          const primaryCanvas =
            domAnalysis.canvases.find((c) => c.isPrimaryGame && c.visible) ||
            domAnalysis.canvases.find((c) => c.visible) ||
            domAnalysis.canvases[0];

          if (primaryCanvas) {
            const canvasBottom =
              primaryCanvas.position.y + primaryCanvas.position.height;
            const canvasRight =
              primaryCanvas.position.x + primaryCanvas.position.width;
            const viewportHeight = domAnalysis.viewport.height;
            const viewportWidth = domAnalysis.viewport.width;

            // Check if canvas is fully visible
            const isFullyVisible =
              primaryCanvas.position.y >= 0 &&
              primaryCanvas.position.x >= 0 &&
              canvasBottom <= viewportHeight &&
              canvasRight <= viewportWidth;

            // Check if canvas is well-centered (not just barely visible)
            const canvasCenterY = primaryCanvas.position.y + primaryCanvas.position.height / 2;
            const viewportCenterY = viewportHeight / 2;
            const isWellCentered = Math.abs(canvasCenterY - viewportCenterY) < 100; // Within 100px of center

            // Always scroll to center the canvas for optimal viewing, unless we just clicked a start button
            if (!startButtonClicked && (!isFullyVisible || !isWellCentered)) {
              log.info(
                {
                  testId: this.testId,
                  canvasId: primaryCanvas.id,
                  canvasPosition: primaryCanvas.position,
                  viewport: domAnalysis.viewport,
                  isFullyVisible,
                  isWellCentered,
                },
                "Scrolling canvas to center of viewport for optimal viewing",
              );

              // Scroll the canvas into view using its ID or position
              if (primaryCanvas.id) {
                await this.page.evaluate((canvasId) => {
                  const element = document.getElementById(canvasId);
                  element?.scrollIntoView({
                    behavior: "auto",
                    block: "center",
                    inline: "center",
                  });
                }, primaryCanvas.id);
              } else {
                // Fallback: scroll to canvas center position
                await this.page.evaluate((pos) => {
                  window.scrollTo({
                    top: pos.y - window.innerHeight / 2 + pos.height / 2,
                    left: pos.x - window.innerWidth / 2 + pos.width / 2,
                    behavior: "auto",
                  });
                }, primaryCanvas.position);
              }
              needsScroll = true;
            } else if (isWellCentered && isFullyVisible) {
              log.info(
                { testId: this.testId },
                "Canvas already well-centered and fully visible, no scroll needed",
              );
            } else if (startButtonClicked) {
              log.info(
                { testId: this.testId },
                "Skipping scroll because start button was clicked",
              );
            }
          }
        } else {
          log.info(
            { testId: this.testId },
            "No canvas elements found in DOM analysis, looking for game containers",
          );

          // Fallback: Try to find common game container elements
          const gameContainerFound = await this.page.evaluate(() => {
            // Common game container selectors (itch.io and other platforms)
            const selectors = [
              '.game_frame',
              '#game_frame',
              '.game-frame',
              '#game-frame',
              '.game_container',
              '#game_container',
              '.game-container',
              '#game-container',
              'iframe[src*="game"]',
              'iframe[allowfullscreen]',
              '.webgl-content',
              '#unity-container',
              '#unityContainer',
            ];

            for (const selector of selectors) {
              const element = document.querySelector(selector);
              if (element) {
                element.scrollIntoView({
                  behavior: 'auto',
                  block: 'center',
                  inline: 'center',
                });
                return { found: true, selector };
              }
            }

            return { found: false };
          });

          if (gameContainerFound.found) {
            needsScroll = true;
            log.info(
              { testId: this.testId, selector: gameContainerFound.selector },
              "Found game container and scrolled it into view",
            );
          } else {
            // Last resort: Generic scroll
            log.info(
              { testId: this.testId },
              "No game container found, applying generic scroll",
            );

            await this.page.evaluate(() => {
              // Scroll to center the vertical space
              const scrollAmount = window.innerHeight * 0.3; // Scroll down 30% of viewport
              window.scrollTo({
                top: scrollAmount,
                left: 0,
                behavior: "auto",
              });
            });

            needsScroll = true;
            log.info(
              { testId: this.testId },
              "Applied generic scroll (30% of viewport height) to center game area",
            );
          }
        }

        if (needsScroll) {
          log.info({ testId: this.testId }, "Scrolled game canvas into view");
        }

        // Build canvas registry if canvas elements detected (Layer 0.75)
        if (domAnalysis.canvases.length > 0) {
          const primaryCanvas = domAnalysis.canvases.find((c) => c.isPrimaryGame && c.visible)
            || domAnalysis.canvases.find((c) => c.visible)
            || domAnalysis.canvases[0];

          if (primaryCanvas) {
            log.info(
              { testId: this.testId, canvasId: primaryCanvas.id },
              "Building canvas registry for canvas-rendered game",
            );

            try {
              const visionAnalyzer = new VisionAnalyzer();
              await this.objectRegistry.buildCanvasRegistry(this.page!, visionAnalyzer);

              const stats = this.objectRegistry.getStats();
              log.info(
                {
                  testId: this.testId,
                  domElements: stats.domElements,
                  canvasElements: stats.canvasElements,
                },
                "Object registry built successfully",
              );
            } catch (error) {
              const err = error instanceof Error ? error : new Error(String(error));
              log.warn(
                { testId: this.testId, error: err.message },
                "Failed to build canvas registry, will fallback to vision-only mode",
              );
            }
          }
        }

        // Wait briefly for any content to settle
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Capture initial screenshot
        const screenshot = await this.page.screenshot();
        await this.evidenceStore.captureScreenshot(
          screenshot,
          "Initial page load",
        );

        log.info({ url, testId: this.testId }, "Navigation successful");
      },
      { maxRetries: 3, initialDelay: 1000 },
    );
  }

  /**
   * Performs loading warmup cycles to help games load properly.
   *
   * Many games require periodic interaction during loading or have interactive
   * loading screens. This method performs systematic clicking to ensure the game
   * loads all resources and becomes playable.
   *
   * **Default behavior:**
   * - 2 cycles of 45 seconds each (90 seconds total)
   * - Clicks center of game canvas every 2 seconds
   * - Waits 500ms between cycles
   *
   * @param options - Warmup configuration options
   * @param options.cycles - Number of warmup cycles (default: 2)
   * @param options.cycleDuration - Duration of each cycle in ms (default: 45000)
   * @param options.clickInterval - Interval between clicks in ms (default: 2000)
   *
   * @example
   * ```typescript
   * await agent.navigateToGame('https://example.com/game');
   * await agent.warmupGameLoading(); // Default 2x45s cycles
   *
   * // Custom configuration
   * await agent.warmupGameLoading({
   *   cycles: 3,
   *   cycleDuration: 30000, // 30s per cycle
   *   clickInterval: 1500,  // Click every 1.5s
   * });
   * ```
   */
  /**
   * Checks if the game has become responsive during warmup.
   *
   * Compares current page state against baseline to detect if the game
   * is loading or responding to interactions. Uses multiple signals:
   * - Screenshot changes (visual updates)
   * - DOM element count changes (UI elements loading)
   *
   * @param baselineScreenshotHash - SHA-256 hash of screenshot before warmup
   * @param baselineInteractiveCount - Count of interactive DOM elements before warmup
   * @returns true if game appears responsive, false if still loading/stuck
   * @private
   */
  private async checkGameResponsiveness(
    baselineScreenshotHash: string,
    baselineInteractiveCount: number,
  ): Promise<boolean> {
    if (!this.page) {
      return false;
    }

    try {
      // Take current screenshot and hash it
      const currentScreenshot = await this.page.screenshot();
      const { hashBuffer } = await import("@/utils/progressDetector");
      const currentHash = hashBuffer(currentScreenshot);

      // Check if screenshot changed from baseline
      const screenshotChanged = currentHash !== baselineScreenshotHash;

      // Get current DOM interactive element count
      const currentInteractiveCount = await this.page.evaluate(() => {
        const buttons = document.querySelectorAll("button, [role='button']").length;
        const links = document.querySelectorAll("a[href]").length;
        const inputs = document.querySelectorAll("input, select, textarea").length;
        const clickable = document.querySelectorAll("[onclick], .clickable, .btn").length;
        return buttons + links + inputs + clickable;
      });

      // Check if interactive elements increased significantly (10+ new elements)
      const domChanged = currentInteractiveCount > baselineInteractiveCount + 10;

      log.debug(
        {
          testId: this.testId,
          screenshotChanged,
          domChanged,
          baselineElements: baselineInteractiveCount,
          currentElements: currentInteractiveCount,
        },
        "Game responsiveness check",
      );

      // Game is responsive if either screenshot or DOM changed significantly
      return screenshotChanged || domChanged;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.warn(
        { testId: this.testId, error: err.message },
        "Failed to check game responsiveness, assuming not responsive",
      );
      return false;
    }
  }

  /**
   * Performs progressive warmup to help games load.
   *
   * Uses an intelligent progressive strategy with up to 3 rounds of 20s warmup,
   * stopping early if the game becomes responsive. This avoids wasting time
   * on fast-loading games while still helping slow-loading games initialize.
   *
   * **Progressive Strategy:**
   * - Round 1: 20s warmup → Check if responsive → Stop if yes
   * - Round 2: 20s warmup → Check if responsive → Stop if yes
   * - Round 3: 20s warmup → Proceed (gave it 60s total)
   *
   * **Responsiveness Detection:**
   * - Screenshot hash changed from baseline
   * - DOM interactive element count increased significantly
   *
   * @param options - Optional warmup configuration (legacy support)
   * @param options.cycles - Maximum rounds (default: 3 for progressive, 2 for legacy)
   * @param options.cycleDuration - Duration per round in ms (default: 20000 for progressive, 45000 for legacy)
   * @param options.clickInterval - Interval between clicks in ms (default: 2000)
   * @throws {Error} When no active browser session exists
   *
   * @example
   * ```typescript
   * // Progressive warmup (new default)
   * await agent.warmupGameLoading();
   * // Up to 3×20s = 60s max, stops early if responsive
   *
   * // Legacy warmup (explicit config)
   * await agent.warmupGameLoading({ cycles: 2, cycleDuration: 45000 });
   * // 2×45s = 90s, no early stopping
   * ```
   */
  async warmupGameLoading(options?: {
    cycles?: number;
    cycleDuration?: number;
    clickInterval?: number;
  }): Promise<void> {
    if (!this.page) {
      throw new Error("No active browser session");
    }

    // NEW: Progressive warmup defaults (3 rounds × 20s = 60s max)
    // If user provides explicit config, use legacy behavior (no early stopping)
    const useProgressiveWarmup = !options?.cycles && !options?.cycleDuration;
    const cycles = options?.cycles ?? (useProgressiveWarmup ? 3 : 2);
    const cycleDuration = options?.cycleDuration ?? (useProgressiveWarmup ? 20000 : 45000);
    const clickInterval = options?.clickInterval ?? 2000; // 2 seconds

    log.info(
      {
        testId: this.testId,
        cycles,
        cycleDuration,
        clickInterval,
        totalDuration: cycles * cycleDuration,
        progressive: useProgressiveWarmup,
      },
      useProgressiveWarmup
        ? "Starting progressive warmup (up to 3 rounds, stops early if responsive)"
        : "Starting warmup phase (legacy mode, no early stopping)",
    );

    // Capture baseline for responsiveness detection
    let baselineScreenshotHash: string | null = null;
    let baselineInteractiveCount = 0;

    if (useProgressiveWarmup) {
      try {
        // Take baseline screenshot
        const baselineScreenshot = await this.page.screenshot();
        const { hashBuffer } = await import("@/utils/progressDetector");
        baselineScreenshotHash = hashBuffer(baselineScreenshot);

        // Count baseline interactive elements
        baselineInteractiveCount = await this.page.evaluate(() => {
          const buttons = document.querySelectorAll("button, [role='button']").length;
          const links = document.querySelectorAll("a[href]").length;
          const inputs = document.querySelectorAll("input, select, textarea").length;
          const clickable = document.querySelectorAll("[onclick], .clickable, .btn").length;
          return buttons + links + inputs + clickable;
        });

        log.debug(
          {
            testId: this.testId,
            baselineHash: baselineScreenshotHash.substring(0, 12),
            baselineElements: baselineInteractiveCount,
          },
          "Baseline captured for progressive warmup",
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        log.warn(
          { testId: this.testId, error: err.message },
          "Failed to capture baseline, continuing without early stopping",
        );
        // Fall back to non-progressive mode if baseline capture fails
        baselineScreenshotHash = null;
      }
    }

    log.info(
      {
        testId: this.testId,
        cycles,
        cycleDuration,
        clickInterval,
        totalDuration: cycles * cycleDuration,
      },
      "Starting game loading warmup phase",
    );

    // Get game canvas center for clicking
    const canvasCenter = await this.page.evaluate(() => {
      // Try to find game canvas
      const selectors = [
        "canvas",
        'iframe[src*="html"]',
        ".game_frame canvas",
        "#game canvas",
        ".game-container",
        "#game_container",
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const rect = element.getBoundingClientRect();
          return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
        }
      }

      // Fallback to viewport center
      return {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };
    });

    log.debug(
      { canvasCenter },
      "Identified game canvas center for warmup clicks",
    );

    for (let cycle = 1; cycle <= cycles; cycle++) {
      log.info(
        { testId: this.testId, cycle, totalCycles: cycles },
        `Starting warmup cycle ${cycle}/${cycles}`,
      );

      const cycleStartTime = Date.now();
      let clickCount = 0;

      while (Date.now() - cycleStartTime < cycleDuration) {
        try {
          // Click center of game canvas
          await this.page.mouse.click(canvasCenter.x, canvasCenter.y);
          clickCount++;

          log.debug(
            {
              testId: this.testId,
              cycle,
              clickCount,
              elapsed: Date.now() - cycleStartTime,
            },
            "Warmup click executed",
          );

          // Wait for next click interval (unless we're at the end of cycle)
          const remaining = cycleDuration - (Date.now() - cycleStartTime);
          if (remaining > 0) {
            await new Promise((resolve) =>
              setTimeout(resolve, Math.min(clickInterval, remaining)),
            );
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          log.warn(
            { testId: this.testId, error: err.message, cycle, clickCount },
            "Warmup click failed, continuing",
          );
          // Continue to next click even if one fails
          await new Promise((resolve) => setTimeout(resolve, clickInterval));
        }
      }

      log.info(
        {
          testId: this.testId,
          cycle,
          clickCount,
          duration: Date.now() - cycleStartTime,
        },
        `Completed warmup cycle ${cycle}/${cycles}`,
      );

      // Progressive warmup: Check if game is responsive after each round (except last)
      if (
        useProgressiveWarmup &&
        baselineScreenshotHash &&
        cycle < cycles // Don't check after final round
      ) {
        log.info(
          { testId: this.testId, cycle, totalCycles: cycles },
          "Checking if game has become responsive...",
        );

        const isResponsive = await this.checkGameResponsiveness(
          baselineScreenshotHash,
          baselineInteractiveCount,
        );

        if (isResponsive) {
          log.info(
            {
              testId: this.testId,
              cycle,
              totalCycles: cycles,
              completedDuration: cycle * cycleDuration,
              savedTime: (cycles - cycle) * cycleDuration,
            },
            `Game is responsive! Stopping warmup early (saved ${(cycles - cycle) * cycleDuration}ms)`,
          );

          // Capture screenshot showing responsive state
          try {
            const screenshot = await this.page.screenshot();
            await this.evidenceStore.captureScreenshot(
              screenshot,
              `After warmup - responsive (round ${cycle})`,
            );
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            log.warn(
              { testId: this.testId, error: err.message },
              "Failed to capture early-stop screenshot",
            );
          }

          // Stop warmup early - game is ready!
          return;
        }

        log.info(
          { testId: this.testId, cycle },
          "Game not yet responsive, continuing to next round...",
        );
      }

      // Wait briefly between cycles (except after last cycle)
      if (cycle < cycles) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    log.info(
      {
        testId: this.testId,
        cycles,
        totalClicks: Math.floor((cycles * cycleDuration) / clickInterval),
        progressive: useProgressiveWarmup,
      },
      useProgressiveWarmup
        ? `Progressive warmup completed all ${cycles} rounds - game may be slow-loading`
        : "Game loading warmup phase completed",
    );

    // Capture screenshot after warmup to see current state
    try {
      const screenshot = await this.page.screenshot();
      await this.evidenceStore.captureScreenshot(
        screenshot,
        "After loading warmup",
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.warn(
        { testId: this.testId, error: err.message },
        "Failed to capture post-warmup screenshot",
      );
    }
  }

  /**
   * Refreshes DOM analysis and rebuilds object registry.
   *
   * Re-analyzes the current page DOM structure and rebuilds the object registry
   * with updated element coordinates. This should be called after major page state
   * changes (e.g., after warmup) to capture dynamically loaded UI elements.
   *
   * **When to use:**
   * - After warmup phase completes (game UI may have loaded)
   * - After major game state transitions
   * - When game shows new menus/screens
   *
   * @throws {Error} When no active browser session exists
   *
   * @example
   * ```typescript
   * await agent.warmupGameLoading();
   * // Game UI has now loaded - refresh DOM and registry
   * await agent.refreshDOMAndRegistry();
   * ```
   */
  async refreshDOMAndRegistry(): Promise<void> {
    if (!this.page) {
      throw new Error("No active browser session");
    }

    log.info(
      { testId: this.testId },
      "Refreshing DOM analysis and object registry",
    );

    // Re-analyze DOM structure
    const updatedDOMAnalysis = await this.analyzeDOMElements();
    this.latestDOMAnalysis = updatedDOMAnalysis;

    // Save updated DOM analysis to evidence store
    await this.evidenceStore.saveDOMAnalysis(updatedDOMAnalysis);

    // Rebuild DOM registry
    this.objectRegistry.buildDOMRegistry(updatedDOMAnalysis);

    // Rebuild canvas registry if canvas exists
    if (updatedDOMAnalysis.canvases.length > 0) {
      try {
        const visionAnalyzer = new VisionAnalyzer();
        await this.objectRegistry.buildCanvasRegistry(this.page, visionAnalyzer);
        log.info(
          {
            testId: this.testId,
            domElements: updatedDOMAnalysis.buttons.length + updatedDOMAnalysis.links.length,
            canvases: updatedDOMAnalysis.canvases.length,
          },
          "DOM and registry refresh complete",
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        log.warn(
          { testId: this.testId, error: err.message },
          "Failed to rebuild canvas registry during refresh",
        );
      }
    } else {
      log.info(
        {
          testId: this.testId,
          domElements: updatedDOMAnalysis.buttons.length + updatedDOMAnalysis.links.length,
        },
        "DOM registry refresh complete (no canvas)",
      );
    }
  }

  /**
   * Waits for the page to finish loading.
   *
   * Uses 'networkidle' state to ensure all network activity has settled
   * before continuing. Includes a 30s timeout.
   *
   * @throws {Error} When wait times out
   *
   * @example
   * ```typescript
   * await agent.navigateToGame('https://example.com');
   * // waitForLoad() called automatically
   * ```
   */
  async waitForLoad(): Promise<void> {
    if (!this.page) {
      throw new Error("No active browser session");
    }

    log.debug({ testId: this.testId }, "Waiting for page load");

    await this.page.waitForLoadState("networkidle", {
      timeout: 30000,
    });

    log.debug({ testId: this.testId }, "Page load complete");
  }

  /**
   * Sets up console log monitoring for the page.
   *
   * Attaches a listener to capture all console messages from the browser
   * and stores them in the evidence store. Handles errors gracefully to
   * avoid disrupting test execution.
   *
   * @private
   */
  private setupConsoleListener(): void {
    if (!this.page) {
      return;
    }

    this.page.on("console", async (msg) => {
      try {
        const text = msg.text();
        await this.evidenceStore.collectConsoleLog(text);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        log.warn(
          {
            error: err.message,
            testId: this.testId,
          },
          "Failed to collect console log",
        );
      }
    });

    log.debug({ testId: this.testId }, "Console log listener attached");
  }

  /**
   * Gets the Playwright page object for advanced interactions.
   *
   * @returns Page object if session active, null otherwise
   */
  getPage(): Page | null {
    return this.page;
  }

  /**
   * Captures a screenshot focused on the game content.
   *
   * If game is in an iframe (itch.io, etc), screenshots just the iframe.
   * Otherwise screenshots the full page. This ensures Vision API analyzes
   * only game content, not wrapper page elements.
   *
   * @returns Screenshot buffer and metadata about source
   * @throws Error if no active page session
   */
  async captureGameScreenshot(): Promise<{
    screenshot: Buffer;
    isIframe: boolean;
    bounds?: { x: number; y: number; width: number; height: number };
  }> {
    if (!this.page) {
      throw new Error("No active page session");
    }

    // Check if game is in iframe
    const frames = this.page.frames();
    const gameFrame = frames.find(frame => {
      const url = frame.url();
      return url.includes('itch.zone') ||
             url.includes('hwcdn.net') ||
             url.includes('html') ||
             frame.name() === 'game_drop';
    });

    if (gameFrame) {
      // Try to screenshot the iframe element directly (more reliable than clip parameters)
      try {
        const iframeElement = await this.page.$('iframe.game_frame') ||
                             await this.page.$('iframe[src*="hwcdn.net"]') ||
                             await this.page.$('iframe[src*="itch.zone"]') ||
                             await this.page.$('iframe[allowfullscreen]');

        if (iframeElement) {
          // Get iframe bounds for metadata
          const iframeBounds = await iframeElement.boundingBox();

          if (iframeBounds) {
            log.info({ bounds: iframeBounds }, "Capturing iframe element screenshot");

            // Screenshot just the iframe element
            const screenshot = await iframeElement.screenshot();

            return {
              screenshot,
              isIframe: true,
              bounds: iframeBounds,
            };
          }
        }
      } catch (error) {
        log.warn({ error: error instanceof Error ? error.message : String(error) },
          "Failed to screenshot iframe element, falling back to full page");
      }

      // Fallback: iframe detected but element screenshot failed
      const screenshot = await this.page.screenshot();
      return {
        screenshot,
        isIframe: false,
      };
    }

    // No iframe detected, screenshot full page
    const screenshot = await this.page.screenshot();
    return {
      screenshot,
      isIframe: false,
    };
  }

  /**
   * Gets the evidence store for capturing test artifacts.
   *
   * @returns Evidence store instance
   */
  getEvidenceStore(): EvidenceStore {
    return this.evidenceStore;
  }

  /**
   * Gets the object registry for coordinate lookups.
   *
   * @returns Object registry instance
   *
   * @example
   * ```typescript
   * const registry = agent.getObjectRegistry();
   * const coords = registry.lookupCoordinates("Start");
   * ```
   */
  getObjectRegistry(): ObjectRegistry {
    return this.objectRegistry;
  }

  /**
   * Refreshes the current page.
   *
   * Useful for games that fail to load on first try due to network issues,
   * asset loading problems, or initialization errors. Waits for page load
   * after refresh.
   *
   * @throws {Error} If no active session or page
   *
   * @example
   * ```typescript
   * await agent.refreshPage();
   * ```
   */
  async refreshPage(): Promise<void> {
    if (!this.page) {
      throw new Error("No active browser session");
    }

    log.info({ testId: this.testId }, "Refreshing page");

    await this.page.reload({
      timeout: 60000,
      waitUntil: "domcontentloaded",
    });

    await this.waitForLoad();

    log.info({ testId: this.testId }, "Page refreshed successfully");
  }

  /**
   * Checks if object registry needs refresh due to viewport change.
   * Rebuilds registry if viewport has changed.
   *
   * @private
   */
  private async checkAndRefreshRegistry(): Promise<void> {
    if (!this.page) {
      return;
    }

    const currentViewport = await this.page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));

    if (this.objectRegistry.needsRefresh(currentViewport)) {
      log.info(
        { testId: this.testId, viewport: currentViewport },
        "Viewport changed, refreshing object registry",
      );

      // Rebuild DOM registry
      if (this.latestDOMAnalysis) {
        const updatedDOMAnalysis = await this.analyzeDOMElements();
        this.latestDOMAnalysis = updatedDOMAnalysis;
        this.objectRegistry.buildDOMRegistry(updatedDOMAnalysis);
      }

      // Rebuild canvas registry if canvas exists
      if (this.latestDOMAnalysis && this.latestDOMAnalysis.canvases.length > 0) {
        try {
          const visionAnalyzer = new VisionAnalyzer();
          await this.objectRegistry.buildCanvasRegistry(this.page, visionAnalyzer);
          log.info({ testId: this.testId }, "Registry refreshed after viewport change");
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          log.warn(
            { testId: this.testId, error: err.message },
            "Failed to rebuild canvas registry after viewport change",
          );
        }
      }
    }
  }

  /**
   * Executes a single action and captures evidence.
   *
   * Executes the specified action (click, keyboard, wait, screenshot) on the page
   * and captures evidence before/after significant actions. Logs all actions to
   * the evidence store for audit trail.
   *
   * **Evidence Capture:**
   * - **Click/Keyboard:** Screenshot before + after action
   * - **Wait:** No screenshots (just waits)
   * - **Screenshot:** Single screenshot capture
   *
   * **Error Handling:**
   * - Returns success: false for any execution errors
   * - Logs all errors to evidence store
   * - Never throws (fail gracefully)
   *
   * @param action - Action to execute
   * @param actionDescription - Human-readable description for logging
   * @returns Execution result with success flag and evidence paths
   *
   * @example
   * ```typescript
   * // Execute a click action
   * const result = await agent.executeAction(
   *   { type: 'click', target: 'center' },
   *   'Click game start'
   * );
   *
   * if (result.success) {
   *   console.log('Action executed successfully');
   *   console.log('Screenshots:', result.beforeScreenshot, result.afterScreenshot);
   * }
   *
   * // Execute keyboard input
   * await agent.executeAction(
   *   { type: 'keyboard', value: 'Space' },
   *   'Press spacebar to jump'
   * );
   *
   * // Wait action
   * await agent.executeAction(
   *   { type: 'wait', delay: 1000 },
   *   'Wait for animation'
   * );
   * ```
   */
  async executeAction(
    action: Action,
    actionDescription = "Execute action",
  ): Promise<ActionExecutionResult> {
    if (!this.page) {
      const error = "No active browser session";
      log.error({ testId: this.testId }, error);

      await this.evidenceStore.collectActionLog(actionDescription, {
        type: action.type,
        target: action.target,
        value: action.value,
        success: false,
        error,
      });

      return {
        success: false,
        action,
        error,
      };
    }

    // Check if registry needs refresh due to viewport change
    await this.checkAndRefreshRegistry();

    const startTime = Date.now();
    let beforeScreenshot: string | undefined;
    let afterScreenshot: string | undefined;

    try {
      log.info(
        {
          testId: this.testId,
          actionType: action.type,
          target: action.target,
          value: action.value,
        },
        `Executing action: ${actionDescription}`,
      );

      // Capture "before" screenshot for significant actions
      if (action.type === "click" || action.type === "keyboard") {
        try {
          const screenshot = await this.page.screenshot();
          beforeScreenshot = await this.evidenceStore.captureScreenshot(
            screenshot,
            `Before: ${actionDescription}`,
          );
          log.debug({ beforeScreenshot }, "Captured before screenshot");
        } catch (screenshotError) {
          const err =
            screenshotError instanceof Error
              ? screenshotError
              : new Error(String(screenshotError));
          log.warn(
            { error: err.message },
            "Failed to capture before screenshot, continuing",
          );
        }
      }

      // Execute the action based on type
      switch (action.type) {
        case "click":
          await this.executeClickAction(action);
          break;

        case "keyboard":
          await this.executeKeyboardAction(action);
          break;

        case "wait":
          await this.executeWaitAction(action);
          break;

        case "screenshot": {
          const screenshot = await this.page.screenshot();
          afterScreenshot = await this.evidenceStore.captureScreenshot(
            screenshot,
            actionDescription,
          );
          break;
        }

        default: {
          // TypeScript exhaustiveness check - this should never be reached
          throw new Error(
            `Unsupported action type: ${(action as Action).type}`,
          );
        }
      }

      // Capture "after" screenshot for significant actions
      if (action.type === "click" || action.type === "keyboard") {
        try {
          const screenshot = await this.page.screenshot();
          afterScreenshot = await this.evidenceStore.captureScreenshot(
            screenshot,
            `After: ${actionDescription}`,
          );
          log.debug({ afterScreenshot }, "Captured after screenshot");
        } catch (screenshotError) {
          const err =
            screenshotError instanceof Error
              ? screenshotError
              : new Error(String(screenshotError));
          log.warn(
            { error: err.message },
            "Failed to capture after screenshot, continuing",
          );
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Log successful action
      await this.evidenceStore.collectActionLog(actionDescription, {
        type: action.type,
        target: action.target,
        value: action.value,
        success: true,
        duration,
        beforeScreenshot,
        afterScreenshot,
      });

      log.info(
        {
          testId: this.testId,
          actionType: action.type,
          duration,
        },
        "Action executed successfully",
      );

      return {
        success: true,
        action,
        beforeScreenshot,
        afterScreenshot,
        durationMs: duration,
        startTime,
        endTime,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const duration = Date.now() - startTime;

      log.error(
        {
          testId: this.testId,
          actionType: action.type,
          error: err.message,
          duration,
        },
        "Action execution failed",
      );

      // Log failed action
      await this.evidenceStore.collectActionLog(actionDescription, {
        type: action.type,
        target: action.target,
        value: action.value,
        success: false,
        error: err.message,
        duration,
        beforeScreenshot,
      });

      return {
        success: false,
        action,
        error: err.message,
        beforeScreenshot,
      };
    }
  }

  /**
   * Executes a click action on the page.
   *
   * Supports various target formats:
   * - 'center': Click center of viewport
   * - 'offset:x,y': Click offset from center (e.g., 'offset:100,-50')
   * - CSS selector: Click element matching selector
   *
   * @param action - Click action to execute
   * @private
   */
  private async executeClickAction(action: Action): Promise<void> {
    if (!this.page) {
      throw new Error("No active browser session");
    }

    const viewport = this.page.viewportSize();
    const centerX = viewport ? viewport.width / 2 : 512;
    const centerY = viewport ? viewport.height / 2 : 384;

    // Priority 1: Use explicit coordinates if provided (from vision analysis)
    if (action.coordinates) {
      // Vision provides coordinates relative to the screenshot.
      // For iframe-embedded games (itch.io, etc.), we need to find the iframe and add its offset.
      const gameElementInfo = await this.page.evaluate(() => {
        // Try to find the game element with priority order
        // 1. iframes (most common for itch.io)
        // 2. canvas elements
        // 3. game containers

        // Itch.io specific: Look for game iframe
        const itchIframe = document.querySelector('iframe.game_frame') ||
                          document.querySelector('iframe[src*="hwcdn.net"]') ||
                          document.querySelector('iframe[src*="itch.zone"]') ||
                          document.querySelector('iframe[allowfullscreen]');

        if (itchIframe) {
          const rect = itchIframe.getBoundingClientRect();
          return {
            type: 'iframe',
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height,
            selector: 'itch.io game iframe',
          };
        }

        // Look for Unity WebGL canvas
        const unityCanvas = document.querySelector('canvas#unity-canvas') ||
                           document.querySelector('canvas[data-unity]') ||
                           document.querySelector('#unity-container canvas');

        if (unityCanvas) {
          const rect = unityCanvas.getBoundingClientRect();
          return {
            type: 'canvas',
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height,
            selector: 'Unity canvas',
          };
        }

        // Generic canvas search
        const canvases = Array.from(document.querySelectorAll('canvas'));
        const largeCanvas = canvases.find(c => {
          const rect = c.getBoundingClientRect();
          return rect.width > 400 && rect.height > 300; // Likely game canvas
        });

        if (largeCanvas) {
          const rect = largeCanvas.getBoundingClientRect();
          return {
            type: 'canvas',
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height,
            selector: 'large canvas element',
          };
        }

        // No game element found - assume coordinates are page-relative
        return {
          type: 'none',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          selector: 'none (using direct coordinates)',
        };
      });

      // CRITICAL: Coordinate system depends on how the screenshot was captured
      // - If screenshot is of the full page/viewport: Vision coords are viewport-relative
      // - If screenshot is of iframe element (via element.screenshot()): Vision coords are iframe-relative
      // Since we use element.screenshot() for iframes, Vision coords are ALREADY iframe-relative!

      const scrollOffset = await this.page.evaluate(() => ({
        x: window.scrollX || window.pageXOffset || 0,
        y: window.scrollY || window.pageYOffset || 0,
      }));

      // For iframe elements, Vision coordinates are already iframe-relative (no translation needed)
      // For page elements, Vision coordinates are viewport-relative (need scroll offset)
      const pageX = gameElementInfo.type === 'iframe'
        ? action.coordinates.x + gameElementInfo.x - scrollOffset.x
        : action.coordinates.x + scrollOffset.x;
      const pageY = gameElementInfo.type === 'iframe'
        ? action.coordinates.y + gameElementInfo.y - scrollOffset.y
        : action.coordinates.y + scrollOffset.y;

      log.info(
        {
          gameElement: gameElementInfo.selector,
          gameElementType: gameElementInfo.type,
          gameElementBounds: {
            x: gameElementInfo.x,
            y: gameElementInfo.y,
            width: gameElementInfo.width,
            height: gameElementInfo.height,
          },
          visionCoords: {
            x: action.coordinates.x,
            y: action.coordinates.y,
            note: 'relative to viewport/screenshot',
          },
          scrollOffset,
          finalPageCoords: {
            x: pageX,
            y: pageY,
            note: 'vision coords + scroll offset',
          },
        },
        "🎯 Clicking at vision coordinates (viewport-relative → page-relative conversion)",
      );

      // CRITICAL FIX: For cross-origin iframe games (itch.io), use Playwright's frame API
      // Cross-origin restrictions prevent accessing iframe.contentDocument
      // But Playwright can still interact with frames using the Frame API
      if (gameElementInfo.type === 'iframe') {
        log.info(
          {
            visionCoords: action.coordinates,
            pageCoords: { x: pageX, y: pageY },
            gameElementBounds: { x: gameElementInfo.x, y: gameElementInfo.y, width: gameElementInfo.width, height: gameElementInfo.height },
          },
          "🎮 Game is in cross-origin iframe - using Playwright frame click",
        );

        try {
          // Get all frames (iframes) on the page
          const frames = this.page.frames();

          log.debug({ frameCount: frames.length }, "Found frames on page");

          // Find the game frame (usually the one with game content)
          // Itch.io game frames typically have URLs like *.itch.zone or *.hwcdn.net
          const gameFrame = frames.find(frame => {
            const url = frame.url();
            return url.includes('itch.zone') ||
                   url.includes('hwcdn.net') ||
                   url.includes('html') ||
                   frame.name() === 'game_drop';
          });

          if (!gameFrame) {
            log.warn({ availableFrameUrls: frames.map(f => f.url()) }, "Could not find game iframe, using main page");
            await this.page.mouse.click(pageX, pageY);
            return;
          }

          log.info({ gameFrameUrl: gameFrame.url() }, "Found game frame");

          // Vision coordinates are ALREADY iframe-relative (since we screenshot just the iframe)
          // No conversion needed - use Vision's coordinates directly!
          const iframeX = action.coordinates.x;
          const iframeY = action.coordinates.y;

          log.info(
            {
              iframeCoords: { x: iframeX, y: iframeY },
              note: 'Vision provided iframe-relative coordinates, using directly',
            },
            "Using Vision iframe coordinates",
          );

          // Click inside the frame context at iframe-relative coordinates
          // This works even for cross-origin iframes!
          await gameFrame.click('body', {
            position: { x: iframeX, y: iframeY },
            force: true, // Bypass actionability checks
            timeout: 5000,
          });

          log.info("✓ Successfully clicked inside iframe using frame.click()");
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          log.error(
            { error: err.message },
            "❌ Frame click failed, trying fallback mouse.click"
          );
          await this.page.mouse.click(pageX, pageY);
        }
      } else {
        // Regular page elements can use mouse.click
        await this.page.mouse.click(pageX, pageY);
      }
      return;
    }

    // Priority 2: Handle special target formats
    if (action.target === "center" || !action.target) {
      // Click center of viewport
      await this.page.mouse.click(centerX, centerY);
      log.debug({ x: centerX, y: centerY }, "Clicked center");
    } else if (action.target.startsWith("offset:")) {
      // Click offset from center (e.g., "offset:100,-50")
      const offsetStr = action.target.substring(7);
      const [xStr, yStr] = offsetStr.split(",");
      const x = centerX + Number.parseInt(xStr || "0", 10);
      const y = centerY + Number.parseInt(yStr || "0", 10);
      await this.page.mouse.click(x, y);
      log.debug({ x, y, offset: offsetStr }, "Clicked offset");
    } else if (action.target.startsWith("#") || action.target.startsWith(".") || action.target.match(/^[a-z]+$/i)) {
      // Looks like a CSS selector (starts with # or . or is a simple tag name)
      try {
        await this.page.click(action.target);
        log.debug({ selector: action.target }, "Clicked element by CSS selector");
      } catch (_selectorError) {
        // If selector fails, click center as fallback
        log.warn(
          { selector: action.target },
          "CSS selector not found, clicking center as fallback",
        );
        await this.page.mouse.click(centerX, centerY);
      }
    } else {
      // Natural language description - try object registry first, then Stagehand

      // Priority 1: Check object registry for coordinates
      const registryResult = this.objectRegistry.lookupCoordinates(action.target);
      if (registryResult) {
        log.info(
          {
            target: action.target,
            x: registryResult.x,
            y: registryResult.y,
            source: registryResult.source,
            confidence: registryResult.confidence,
          },
          "Using object registry for click coordinates",
        );
        await this.page.mouse.click(registryResult.x, registryResult.y);
        return;
      }

      // Priority 1.5: Try Stagehand observe() to find DOM element selector
      // This is faster and more reliable than act() for DOM elements
      try {
        if (!this.page) {
          throw new Error("Browser page not initialized");
        }

        log.debug(
          { target: action.target },
          "Object registry miss, trying Stagehand observe() to find element selector",
        );

        // Use observe() to find matching DOM elements
        // iframes: true allows searching inside the game iframe
        const observeResults = await this.page.observe({
          instruction: action.target,
          iframes: true,
        });

        if (observeResults && observeResults.length > 0) {
          const bestMatch = observeResults[0];
          if (bestMatch && bestMatch.selector) {
            log.info(
              {
                target: action.target,
                selector: bestMatch.selector,
                description: bestMatch.description,
              },
              "Found element via Stagehand observe(), clicking selector",
            );

            // Click using the selector (more reliable than coordinates)
            await this.page.click(bestMatch.selector);
            return;
          }
        }

        log.debug(
          { target: action.target },
          "Stagehand observe() found no matching elements, trying act() next",
        );
      } catch (observeError) {
        const err = observeError instanceof Error ? observeError : new Error(String(observeError));
        log.debug(
          { target: action.target, error: err.message },
          "Stagehand observe() failed, trying act() next",
        );
        // Continue to next layer (act)
      }

      // Priority 2: Use Stagehand's AI-powered act() via page
      // This is slower but can handle more complex scenarios
      try {
        if (!this.page) {
          throw new Error("Browser page not initialized");
        }

        log.debug(
          { target: action.target },
          "Using Stagehand act() to execute action with AI",
        );

        // Stagehand act() is a method on the Page object, not the Stagehand instance
        const result = await this.page.act({ action: action.target });

        if (!result.success) {
          throw new Error(`Stagehand act() failed: ${result.message}`);
        }

        log.debug(
          { target: action.target, message: result.message },
          "Stagehand AI act() succeeded"
        );
      } catch (stagehandError) {
        // Stagehand failed, fall back to center click
        const err = stagehandError instanceof Error ? stagehandError : new Error(String(stagehandError));
        log.warn(
          { target: action.target, error: err.message },
          "Stagehand act() failed, clicking center as fallback",
        );
        await this.page.mouse.click(centerX, centerY);
      }
    }
  }

  /**
   * Executes a keyboard action on the page.
   *
   * @param action - Keyboard action to execute
   * @private
   */
  private async executeKeyboardAction(action: Action): Promise<void> {
    if (!this.page) {
      throw new Error("No active browser session");
    }

    if (!action.value) {
      throw new Error("Keyboard action requires a value (key to press)");
    }

    await this.page.keyboard.press(action.value);
    log.debug({ key: action.value }, "Pressed key");
  }

  /**
   * Executes a wait action (pause execution).
   *
   * @param action - Wait action with delay in milliseconds
   * @private
   */
  private async executeWaitAction(action: Action): Promise<void> {
    const delay = action.delay || 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));
    log.debug({ delay }, "Waited");
  }

  /**
   * Detects the game type from page analysis.
   *
   * Uses a two-layer detection strategy:
   * 1. **DOM Analysis (Fast)**: Analyzes page structure for game indicators
   * 2. **Vision Analysis (Fallback)**: Uses AI to analyze screenshot if DOM is uncertain
   *
   * **Detection Indicators:**
   * - **Platformer**: Canvas + physics keywords, arrow key controls
   * - **Clicker**: Increment/click keywords, minimal controls
   * - **Puzzle**: Grid/tile elements, match keywords
   * - **Generic**: Fallback when no specific type detected
   *
   * @returns Detection result with game type and confidence
   *
   * @example
   * ```typescript
   * await agent.createSession();
   * await agent.navigateToGame('https://example.com/game');
   *
   * const result = await agent.detectGameType();
   * console.log(`Detected: ${result.gameType} (${result.confidence}%)`);
   * // => "Detected: platformer (85%)"
   * ```
   */
  async detectGameType(): Promise<GameTypeDetectionResult> {
    if (!this.page) {
      throw new Error("No active browser session");
    }

    log.info({ testId: this.testId }, "Starting game type detection");

    // Layer 1: DOM Analysis
    const domResult = await this.detectGameTypeFromDOM();

    if (domResult.confidence >= 70) {
      log.info(
        {
          testId: this.testId,
          gameType: domResult.gameType,
          confidence: domResult.confidence,
          method: "dom",
        },
        "Game type detected via DOM analysis",
      );
      return domResult;
    }

    log.info(
      { testId: this.testId, domConfidence: domResult.confidence },
      "DOM analysis uncertain, using vision fallback",
    );

    // Layer 2: Vision Analysis (fallback)
    const screenshot = await this.page.screenshot();
    const visionAnalyzer = new VisionAnalyzer();

    // Try vision-based detection with retry logic for invalid types
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        log.info(
          { testId: this.testId, attempt, maxAttempts },
          "Attempting vision-based game type detection",
        );

        // Use dedicated game type detection method with explicit type list
        const visionResult = await visionAnalyzer.detectGameType(screenshot);

        // Extract and validate game type from vision reasoning
        const gameType = this.extractGameTypeFromVisionAnalysis(
          visionResult.reasoning,
        );

        // Validation: Check if extraction succeeded
        if (gameType === null) {
          log.warn(
            {
              testId: this.testId,
              attempt,
              reasoning: visionResult.reasoning.substring(0, 200),
            },
            "Vision returned invalid/unrecognized game type, retrying...",
          );

          // If this was the last attempt, fall back to DOM result
          if (attempt === maxAttempts) {
            log.warn(
              { testId: this.testId, attempts: maxAttempts },
              "All vision attempts failed validation, using DOM result",
            );
            return domResult;
          }

          // Otherwise, retry
          continue;
        }

        // Valid game type extracted!
        const result: GameTypeDetectionResult = {
          gameType,
          confidence: visionResult.confidence,
          method: "vision",
          reasoning: `Vision analysis: ${visionResult.reasoning}`,
        };

        log.info(
          {
            testId: this.testId,
            gameType: result.gameType,
            confidence: result.confidence,
            method: "vision",
            attempt,
          },
          "Game type successfully detected via vision analysis",
        );

        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        log.warn(
          {
            testId: this.testId,
            error: err.message,
            attempt,
            maxAttempts,
          },
          "Vision analysis attempt failed",
        );

        // If this was the last attempt, fall back to DOM result
        if (attempt === maxAttempts) {
          log.warn(
            { testId: this.testId, attempts: maxAttempts },
            "All vision attempts failed, using DOM result",
          );
          return domResult;
        }

        // Otherwise, retry
        continue;
      }
    }

    // This should never be reached, but fallback to DOM result just in case
    log.warn(
      { testId: this.testId },
      "Vision retry loop completed without result, using DOM result",
    );
    return domResult;
  }

  /**
   * Detects game type from DOM structure analysis.
   *
   * Analyzes page content for game-specific indicators like
   * canvas elements, control hints, and keyword patterns.
   *
   * @returns Detection result from DOM analysis
   * @private
   */
  private async detectGameTypeFromDOM(): Promise<GameTypeDetectionResult> {
    if (!this.page) {
      throw new Error("No active browser session");
    }

    // Analyze page content
    const pageContent = await this.page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase();
      const hasCanvas = document.querySelector("canvas") !== null;
      const canvasCount = document.querySelectorAll("canvas").length;

      // Check for control hints in text
      const hasArrowKeys =
        bodyText.includes("arrow") || bodyText.includes("wasd");
      const hasSpacebar =
        bodyText.includes("space") || bodyText.includes("jump");
      const hasClick = bodyText.includes("click") || bodyText.includes("tap");
      const hasIncrement =
        bodyText.includes("upgrade") ||
        bodyText.includes("increment") ||
        bodyText.includes("idle");
      const hasMatch =
        bodyText.includes("match") ||
        bodyText.includes("tile") ||
        bodyText.includes("puzzle");
      const hasGrid = bodyText.includes("grid");

      // Check for specific game type keywords
      const keywords = {
        platformer: ["platform", "jump", "run", "level", "physics", "gravity"],
        clicker: [
          "click",
          "idle",
          "increment",
          "upgrade",
          "prestige",
          "cookie",
        ],
        puzzle: ["puzzle", "match", "tile", "grid", "solve", "swap"],
      };

      const platformerScore = keywords.platformer.filter((k) =>
        bodyText.includes(k),
      ).length;
      const clickerScore = keywords.clicker.filter((k) =>
        bodyText.includes(k),
      ).length;
      const puzzleScore = keywords.puzzle.filter((k) =>
        bodyText.includes(k),
      ).length;

      return {
        hasCanvas,
        canvasCount,
        hasArrowKeys,
        hasSpacebar,
        hasClick,
        hasIncrement,
        hasMatch,
        hasGrid,
        platformerScore,
        clickerScore,
        puzzleScore,
        bodyLength: bodyText.length,
      };
    });

    log.debug({ pageContent }, "DOM analysis results");

    // Scoring logic
    let gameType: GameType = "generic";
    let confidence = 40; // Default low confidence
    let reasoning = "No strong indicators found";

    // Platformer detection
    if (
      pageContent.hasCanvas &&
      (pageContent.hasArrowKeys || pageContent.hasSpacebar) &&
      pageContent.platformerScore >= 2
    ) {
      gameType = "platformer";
      confidence = 75 + Math.min(pageContent.platformerScore * 5, 20);
      reasoning =
        "Canvas element with keyboard controls and platformer keywords detected";
    }
    // Clicker/Idle detection
    else if (
      pageContent.hasClick &&
      pageContent.hasIncrement &&
      pageContent.clickerScore >= 2
    ) {
      gameType = "clicker";
      confidence = 70 + Math.min(pageContent.clickerScore * 5, 25);
      reasoning = "Click interactions with increment/upgrade keywords detected";
    }
    // Puzzle detection
    else if (
      (pageContent.hasMatch || pageContent.hasGrid) &&
      pageContent.puzzleScore >= 2
    ) {
      gameType = "puzzle";
      confidence = 70 + Math.min(pageContent.puzzleScore * 5, 25);
      reasoning = "Grid/match elements with puzzle keywords detected";
    }
    // Canvas-based game (likely platformer or arcade)
    else if (pageContent.hasCanvas && pageContent.canvasCount === 1) {
      gameType = "platformer";
      confidence = 60;
      reasoning = "Single canvas element suggests platformer or arcade game";
    }
    // Heavy click focus
    else if (pageContent.hasClick && pageContent.hasIncrement) {
      gameType = "clicker";
      confidence = 55;
      reasoning = "Click and increment indicators suggest clicker game";
    }
    // Generic fallback
    else {
      gameType = "generic";
      confidence = 40;
      reasoning = "No specific game type indicators - using generic pattern";
    }

    return {
      gameType,
      confidence,
      method: "dom",
      reasoning: `DOM analysis: ${reasoning}`,
    };
  }

  /**
   * Extracts game type from vision analysis reasoning.
   *
   * Parses the AI reasoning to identify mentioned game type keywords.
   *
   * @param reasoning - Reasoning from vision analysis
   * @returns Detected game type
   * @private
   */
  /**
   * Extracts and validates game type from vision analysis reasoning.
   *
   * Searches for game type keywords in vision's reasoning text and validates
   * the result is one of our 13 supported types. Returns null if no valid
   * type can be extracted.
   *
   * **Validation ensures:**
   * - Type is one of our supported 13 types
   * - Vision didn't hallucinate an invalid type
   * - Enables retry logic if extraction fails
   *
   * @param reasoning - Vision analysis reasoning text
   * @returns Extracted game type, or null if invalid/not found
   * @private
   */
  private extractGameTypeFromVisionAnalysis(reasoning: string): GameType | null {
    const lower = reasoning.toLowerCase();

    // List of valid game types for validation
    const validTypes: GameType[] = [
      "platformer",
      "clicker",
      "puzzle",
      "visual-novel",
      "shooter",
      "racing",
      "rpg",
      "strategy",
      "arcade",
      "card",
      "sports",
      "simulation",
      "generic",
    ];

    // Check for game type keywords in order of specificity
    // Platformer
    if (
      lower.includes("platformer") ||
      (lower.includes("platform") && lower.includes("jump")) ||
      lower.includes("side-scroll") ||
      (lower.includes("physics") && lower.includes("jump"))
    ) {
      return "platformer";
    }

    // Clicker/Idle
    if (
      lower.includes("clicker") ||
      lower.includes("idle") ||
      lower.includes("incremental") ||
      (lower.includes("click") && lower.includes("upgrade"))
    ) {
      return "clicker";
    }

    // Puzzle
    if (
      lower.includes("puzzle") ||
      (lower.includes("match") && lower.includes("3")) ||
      lower.includes("match-3") ||
      (lower.includes("tile") && lower.includes("match")) ||
      (lower.includes("grid") && lower.includes("solve"))
    ) {
      return "puzzle";
    }

    // Visual Novel
    if (
      lower.includes("visual novel") ||
      lower.includes("visual-novel") ||
      (lower.includes("narrative") && lower.includes("choice")) ||
      (lower.includes("story") && lower.includes("choice"))
    ) {
      return "visual-novel";
    }

    // Shooter
    if (
      lower.includes("shooter") ||
      lower.includes("shoot") ||
      (lower.includes("gun") && lower.includes("aim")) ||
      lower.includes("fps") ||
      lower.includes("bullet hell")
    ) {
      return "shooter";
    }

    // Racing
    if (
      lower.includes("racing") ||
      lower.includes("race") ||
      (lower.includes("car") && lower.includes("track")) ||
      (lower.includes("vehicle") && lower.includes("speed"))
    ) {
      return "racing";
    }

    // RPG
    if (
      lower.includes("rpg") ||
      lower.includes("role-playing") ||
      (lower.includes("character") && lower.includes("level")) ||
      (lower.includes("quest") && lower.includes("inventory"))
    ) {
      return "rpg";
    }

    // Strategy
    if (
      lower.includes("strategy") ||
      lower.includes("tower defense") ||
      lower.includes("real-time strategy") ||
      lower.includes("rts") ||
      (lower.includes("build") && lower.includes("defend"))
    ) {
      return "strategy";
    }

    // Arcade
    if (
      lower.includes("arcade") ||
      (lower.includes("classic") && lower.includes("game")) ||
      lower.includes("retro")
    ) {
      return "arcade";
    }

    // Card
    if (
      lower.includes("card game") ||
      lower.includes("card") ||
      lower.includes("deck") ||
      (lower.includes("hand") && lower.includes("play"))
    ) {
      return "card";
    }

    // Sports
    if (
      lower.includes("sports") ||
      lower.includes("soccer") ||
      lower.includes("football") ||
      lower.includes("basketball") ||
      lower.includes("tennis") ||
      lower.includes("golf")
    ) {
      return "sports";
    }

    // Simulation
    if (
      lower.includes("simulation") ||
      lower.includes("simulator") ||
      (lower.includes("manage") && lower.includes("resource"))
    ) {
      return "simulation";
    }

    // Generic (last resort, but still valid)
    if (lower.includes("generic") || lower.includes("general")) {
      return "generic";
    }

    // No valid type found in reasoning - return null for retry
    log.warn(
      { testId: this.testId, reasoning: reasoning.substring(0, 200) },
      "Could not extract valid game type from vision reasoning",
    );
    return null;
  }
}
