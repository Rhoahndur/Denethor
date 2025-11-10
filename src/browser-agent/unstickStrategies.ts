/**
 * Unstick Strategies - Modular approaches to get games past loading/start screens.
 *
 * Provides multiple strategies that can be tried in sequence to unstick
 * games that are frozen on loading screens or require specific user interaction.
 *
 * @module unstickStrategies
 */

import type { Page } from "@browserbasehq/stagehand";
import type { DOMAnalysis } from "@/types/qaReport";
import type { EvidenceStore } from "@/evidence-store/evidenceStore";
import { VisionAnalyzer } from "./visionAnalyzer";
import { logger } from "@/utils/logger";
import { createHash } from "node:crypto";

const log = logger.child({ component: "UnstickStrategies" });

/**
 * Context information for unstick strategies.
 */
export interface UnstickContext {
  /** Test ID for logging */
  testId: string;

  /** Attempt number (1, 2, 3, etc.) */
  attemptNumber: number;

  /** DOM analysis from last scan */
  domAnalysis: DOMAnalysis;

  /** Optional hint about expected inputs */
  inputHint?: string;

  /** Evidence store for capturing screenshots */
  evidenceStore: EvidenceStore;

  /**
   * Game type for context-aware strategy selection (NEW).
   * Used to choose appropriate unstick strategies based on game genre.
   *
   * @example "platformer" → Try arrow keys, spacebar
   * @example "clicker" → Try clicking different regions
   */
  gameType?: string;
}

/**
 * Result from executing an unstick strategy.
 */
export interface UnstickResult {
  /** Whether the strategy execution succeeded */
  success: boolean;

  /** Description of action taken */
  action: string;

  /** Whether screen changed after action */
  changed: boolean;

  /** Error message if strategy failed */
  error?: string;

  /** Screenshot hash before action */
  beforeHash?: string;

  /** Screenshot hash after action */
  afterHash?: string;
}

/**
 * Interface for unstick strategies.
 */
export interface UnstickStrategy {
  /** Strategy name for logging */
  name: string;

  /** Execute the unstick strategy */
  execute(page: Page, context: UnstickContext): Promise<UnstickResult>;
}

/**
 * Hashes a buffer using SHA-256.
 *
 * @param buffer - Buffer to hash
 * @returns Hex string hash
 */
function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Strategy 1: Vision-Guided Click
 *
 * Uses GPT-4o vision analysis to identify and click visible buttons.
 */
export class VisionGuidedClickStrategy implements UnstickStrategy {
  name = "Vision-Guided Click";

  async execute(page: Page, context: UnstickContext): Promise<UnstickResult> {
    log.info(
      { testId: context.testId, attempt: context.attemptNumber },
      "Executing Vision-Guided Click strategy",
    );

    try {
      // Capture current screenshot
      const beforeScreenshot = await page.screenshot();
      const beforeHash = hashBuffer(beforeScreenshot);

      await context.evidenceStore.captureScreenshot(
        beforeScreenshot,
        `unstick-vision-${context.attemptNumber}-before`,
      );

      // Use vision analyzer to find clickable element
      const visionAnalyzer = new VisionAnalyzer();
      const visionResult = await visionAnalyzer.analyzeScreenshot(
        beforeScreenshot,
        {
          previousAction: "Game stuck on start screen",
          gameState: "attempting to start game",
          attempt: context.attemptNumber,
          inputHint: context.inputHint,
          domAnalysis: context.domAnalysis,
        },
      );

      log.info(
        {
          testId: context.testId,
          actionType: visionResult.actionType,
          confidence: visionResult.confidence,
          target: visionResult.targetDescription,
        },
        "Vision analysis complete",
      );

      // If vision recommends a click with target description
      if (
        visionResult.actionType === "click" &&
        visionResult.targetDescription &&
        visionResult.confidence > 50
      ) {
        // Try to find and click the element described by vision
        const clicked = await this.clickDescribedElement(
          page,
          visionResult.targetDescription,
        );

        if (!clicked) {
          log.warn(
            { target: visionResult.targetDescription },
            "Could not find element described by vision - trying center click",
          );

          // Fallback to center click
          const viewport = await page.evaluate(() => ({
            width: window.innerWidth,
            height: window.innerHeight,
          }));
          if (viewport) {
            await page.mouse.click(viewport.width / 2, viewport.height / 2);
          }
        }

        // Wait for potential animation
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check if screen changed
        const afterScreenshot = await page.screenshot();
        const afterHash = hashBuffer(afterScreenshot);
        const changed = beforeHash !== afterHash;

        await context.evidenceStore.captureScreenshot(
          afterScreenshot,
          `unstick-vision-${context.attemptNumber}-after`,
        );

        return {
          success: true,
          action: `Vision-guided click on "${visionResult.targetDescription}"`,
          changed,
          beforeHash,
          afterHash,
        };
      }

      // Vision didn't recommend click or low confidence
      return {
        success: false,
        action: `Vision analysis uncertain (${visionResult.actionType}, ${visionResult.confidence}% confidence)`,
        changed: false,
        error: "Vision did not recommend clickable element",
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        { testId: context.testId, error: err.message },
        "Vision-guided click failed",
      );

      return {
        success: false,
        action: "Vision-guided click",
        changed: false,
        error: err.message,
      };
    }
  }

  /**
   * Attempts to click an element based on text description.
   * Uses Stagehand's act() method or fallback DOM searching.
   */
  private async clickDescribedElement(
    page: Page,
    description: string,
  ): Promise<boolean> {
    try {
      // Try to find element matching description
      // Look for text content, button labels, etc.
      const clickedResult = await page.evaluate((desc) => {
        // Search for elements with matching text
        const allButtons = Array.from(
          document.querySelectorAll("button, [role='button'], a"),
        );

        const matchingButton = allButtons.find((btn) => {
          const text = btn.textContent?.toLowerCase() || "";
          const descLower = desc.toLowerCase();

          return (
            text.includes(descLower) ||
            text.includes("start") ||
            text.includes("play") ||
            text.includes("begin") ||
            text.includes("continue")
          );
        });

        if (matchingButton) {
          (matchingButton as HTMLElement).click();
          return true;
        }

        return false;
      }, description);

      if (clickedResult) {
        log.info(
          { description },
          "Found and clicked element matching description",
        );
        return true;
      }

      return false;
    } catch (error) {
      log.warn(
        {
          description,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to click described element",
      );
      return false;
    }
  }
}

/**
 * Strategy 2: DOM Button Finder
 *
 * Uses DOM analysis to find obvious start/play buttons.
 */
export class DOMButtonFinderStrategy implements UnstickStrategy {
  name = "DOM Button Finder";

  async execute(page: Page, context: UnstickContext): Promise<UnstickResult> {
    log.info(
      { testId: context.testId, attempt: context.attemptNumber },
      "Executing DOM Button Finder strategy",
    );

    try {
      const beforeScreenshot = await page.screenshot();
      const beforeHash = hashBuffer(beforeScreenshot);

      // Look for obvious start buttons in DOM analysis
      const startButtons = context.domAnalysis.buttons.filter(
        (btn) =>
          btn.visible &&
          (btn.text.toLowerCase().includes("start") ||
            btn.text.toLowerCase().includes("play") ||
            btn.text.toLowerCase().includes("begin") ||
            btn.text.toLowerCase().includes("continue") ||
            btn.text.toLowerCase().includes("click") ||
            btn.id?.toLowerCase().includes("start") ||
            btn.id?.toLowerCase().includes("play")),
      );

      if (startButtons.length > 0) {
        const button = startButtons[0];

        // Explicit undefined check for type safety
        if (button) {
          log.info(
            {
              testId: context.testId,
              buttonText: button.text,
              buttonId: button.id,
              position: button.position,
            },
            "Found start button in DOM",
          );

          // Click the button center
          const clickX = button.position.x + button.position.width / 2;
          const clickY = button.position.y + button.position.height / 2;

          await page.mouse.click(clickX, clickY);
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const afterScreenshot = await page.screenshot();
          const afterHash = hashBuffer(afterScreenshot);
          const changed = beforeHash !== afterHash;

          return {
            success: true,
            action: `Clicked DOM button "${button.text}" at (${Math.round(clickX)}, ${Math.round(clickY)})`,
            changed,
            beforeHash,
            afterHash,
          };
        }
      }

      // No obvious start buttons found
      log.info(
        { testId: context.testId, buttonsFound: context.domAnalysis.buttons.length },
        "No obvious start buttons found in DOM",
      );

      return {
        success: false,
        action: "DOM button finder",
        changed: false,
        error: "No start/play buttons found in DOM",
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        { testId: context.testId, error: err.message },
        "DOM button finder failed",
      );

      return {
        success: false,
        action: "DOM button finder",
        changed: false,
        error: err.message,
      };
    }
  }
}

/**
 * Strategy 3: Keyboard Mash
 *
 * Tries common keyboard inputs (Space, Enter, WASD, arrows).
 */
export class KeyboardMashStrategy implements UnstickStrategy {
  name = "Keyboard Mash";

  async execute(page: Page, context: UnstickContext): Promise<UnstickResult> {
    log.info(
      { testId: context.testId, attempt: context.attemptNumber },
      "Executing Keyboard Mash strategy",
    );

    try {
      const beforeScreenshot = await page.screenshot();
      const beforeHash = hashBuffer(beforeScreenshot);

      const keysToTry = [
        "Space",
        "Enter",
        "Escape",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "w",
        "a",
        "s",
        "d",
      ];

      let keyThatWorked: string | null = null;

      for (const key of keysToTry) {
        await page.keyboard.press(key);
        await new Promise((resolve) => setTimeout(resolve, 500));

        const currentScreenshot = await page.screenshot();
        const currentHash = hashBuffer(currentScreenshot);

        if (currentHash !== beforeHash) {
          keyThatWorked = key;
          log.info(
            { testId: context.testId, key },
            "Key press caused screen change!",
          );
          break;
        }
      }

      const afterScreenshot = await page.screenshot();
      const afterHash = hashBuffer(afterScreenshot);
      const changed = beforeHash !== afterHash;

      if (keyThatWorked) {
        return {
          success: true,
          action: `Pressed "${keyThatWorked}" key`,
          changed: true,
          beforeHash,
          afterHash,
        };
      }

      return {
        success: false,
        action: `Tried ${keysToTry.length} keys`,
        changed,
        error: "No keyboard input caused screen change",
        beforeHash,
        afterHash,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        { testId: context.testId, error: err.message },
        "Keyboard mash strategy failed",
      );

      return {
        success: false,
        action: "Keyboard mash",
        changed: false,
        error: err.message,
      };
    }
  }
}

/**
 * Strategy 4: Iframe Detection
 *
 * Detects if game is in iframe and switches context.
 */
export class IframeDetectionStrategy implements UnstickStrategy {
  name = "Iframe Detection";

  async execute(page: Page, context: UnstickContext): Promise<UnstickResult> {
    log.info(
      { testId: context.testId, attempt: context.attemptNumber },
      "Executing Iframe Detection strategy",
    );

    try {
      // Check for common iframe selectors (itch.io, GameJolt, etc.)
      const iframeSelectors = [
        "#game_drop", // itch.io
        "iframe[src*='game']",
        "iframe[id*='game']",
        "iframe[class*='game']",
        ".game-frame",
        "#gameFrame",
      ];

      for (const selector of iframeSelectors) {
        const iframeHandle = await page.$(selector);

        if (iframeHandle) {
          log.info(
            { testId: context.testId, selector },
            "Found game iframe - switching context",
          );

          // Get iframe content
          const frame = await iframeHandle.contentFrame();

          if (frame) {
            // Try clicking center of iframe by finding and clicking canvas or body
            const clicked = await frame.evaluate(() => {
              // Try to find canvas first
              const canvas = document.querySelector("canvas");
              if (canvas) {
                canvas.click();
                return true;
              }

              // Otherwise click the body center
              const clickEvent = new MouseEvent("click", {
                view: window,
                bubbles: true,
                cancelable: true,
              });
              document.body.dispatchEvent(clickEvent);
              return true;
            });

            if (clicked) {
              await new Promise((resolve) => setTimeout(resolve, 1000));

              return {
                success: true,
                action: `Found iframe (${selector}) and clicked center`,
                changed: true, // Assume changed since we found new context
              };
            }
          }
        }
      }

      return {
        success: false,
        action: "Iframe detection",
        changed: false,
        error: "No game iframe found",
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        { testId: context.testId, error: err.message },
        "Iframe detection failed",
      );

      return {
        success: false,
        action: "Iframe detection",
        changed: false,
        error: err.message,
      };
    }
  }
}

/**
 * Strategy 5: Page Refresh
 *
 * Refreshes the page (last resort).
 */
export class PageRefreshStrategy implements UnstickStrategy {
  name = "Page Refresh";

  async execute(page: Page, context: UnstickContext): Promise<UnstickResult> {
    log.info(
      { testId: context.testId, attempt: context.attemptNumber },
      "Executing Page Refresh strategy",
    );

    try {
      await page.reload({ waitUntil: "load" });
      await new Promise((resolve) => setTimeout(resolve, 3000));

      return {
        success: true,
        action: "Refreshed page",
        changed: true, // Page refresh always changes screen
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        { testId: context.testId, error: err.message },
        "Page refresh failed",
      );

      return {
        success: false,
        action: "Page refresh",
        changed: false,
        error: err.message,
      };
    }
  }
}

/**
 * Strategy 6: Game-Type-Specific Keyboard (NEW)
 *
 * Tries keyboard inputs specific to the game type.
 * More targeted than random keyboard mashing.
 */
export class GameTypeKeyboardStrategy implements UnstickStrategy {
  name = "Game-Type Keyboard";

  async execute(page: Page, context: UnstickContext): Promise<UnstickResult> {
    const gameType = context.gameType || "generic";

    log.info(
      { testId: context.testId, gameType },
      "Executing Game-Type Keyboard strategy",
    );

    try {
      const beforeScreenshot = await page.screenshot();
      const beforeHash = hashBuffer(beforeScreenshot);

      // Get keys specific to game type
      const keys = this.getKeysForGameType(gameType);

      // Try each key
      for (const key of keys) {
        await page.keyboard.press(key);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const afterScreenshot = await page.screenshot();
      const afterHash = hashBuffer(afterScreenshot);
      const changed = beforeHash !== afterHash;

      return {
        success: true,
        action: `Pressed ${gameType}-specific keys: ${keys.join(", ")}`,
        changed,
        beforeHash,
        afterHash,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        action: "Game-type keyboard",
        changed: false,
        error: err.message,
      };
    }
  }

  private getKeysForGameType(gameType: string): string[] {
    switch (gameType) {
      case "platformer":
      case "shooter":
      case "arcade":
        // Movement + jump/action
        return ["ArrowRight", "Space", "Enter"];

      case "clicker":
      case "idle":
      case "incremental":
        // Click equivalents
        return ["Enter", "Space"];

      case "puzzle":
      case "match":
        // Selection keys
        return ["Enter", "Space", "ArrowDown"];

      case "visual-novel":
      case "rpg":
        // Advance dialogue/menus
        return ["Enter", "Space", "ArrowDown"];

      case "racing":
        // Acceleration
        return ["ArrowUp", "Space"];

      case "strategy":
      case "card":
        // Selection/confirm
        return ["Enter", "Space"];

      case "sports":
        // Action button
        return ["Space", "Enter"];

      case "simulation":
        // Pause/menu
        return ["Escape", "Space"];

      default:
        // Generic keys
        return ["Space", "Enter"];
    }
  }
}

/**
 * Executes multiple unstick strategies in sequence until one works.
 */
export class UnstickStrategyExecutor {
  private strategies: UnstickStrategy[];

  constructor(strategies: UnstickStrategy[]) {
    this.strategies = strategies;
  }

  /**
   * Executes all strategies in order until one reports success.
   *
   * @param page - Playwright page
   * @param context - Unstick context
   * @returns Result from first successful strategy, or last strategy if all fail
   */
  async executeAll(
    page: Page,
    context: UnstickContext,
  ): Promise<UnstickResult> {
    log.info(
      {
        testId: context.testId,
        strategyCount: this.strategies.length,
        attempt: context.attemptNumber,
      },
      "Executing unstick strategy sequence",
    );

    let lastResult: UnstickResult = {
      success: false,
      action: "No strategies executed",
      changed: false,
    };

    for (const strategy of this.strategies) {
      log.info(
        { testId: context.testId, strategy: strategy.name },
        "Trying unstick strategy",
      );

      const result = await strategy.execute(page, context);
      lastResult = result;

      if (result.success && result.changed) {
        log.info(
          {
            testId: context.testId,
            strategy: strategy.name,
            action: result.action,
          },
          "Unstick strategy succeeded - screen changed!",
        );
        return result;
      }

      log.info(
        {
          testId: context.testId,
          strategy: strategy.name,
          success: result.success,
          changed: result.changed,
        },
        "Unstick strategy completed - trying next",
      );
    }

    log.warn(
      { testId: context.testId },
      "All unstick strategies failed - game may be truly stuck",
    );

    return lastResult;
  }

  /**
   * Creates default unstick strategy sequence.
   *
   * @returns Executor with recommended strategy order
   */
  static createDefault(): UnstickStrategyExecutor {
    return new UnstickStrategyExecutor([
      new IframeDetectionStrategy(), // Try iframe first (common for itch.io)
      new DOMButtonFinderStrategy(), // Then try DOM buttons
      new VisionGuidedClickStrategy(), // Then use AI vision
      new KeyboardMashStrategy(), // Then try keyboard
      new PageRefreshStrategy(), // Last resort: refresh
    ]);
  }

  /**
   * Creates progressive hybrid unstick strategy sequence (NEW - RECOMMENDED).
   *
   * Uses 3-level progressive escalation with game-type awareness:
   *
   * **Level 1 (Gentle)**: Non-intrusive, game-type-specific
   * - Iframe detection
   * - DOM button finding
   * - Game-type-specific keyboard inputs
   *
   * **Level 2 (Moderate)**: Intelligent but costs API calls
   * - Vision-guided clicking
   *
   * **Level 3 (Aggressive)**: Universal fallbacks
   * - Random keyboard mashing
   * - Page refresh (last resort)
   *
   * This approach minimizes interference with fast-loading games while
   * providing powerful unstick capabilities for truly stuck scenarios.
   *
   * @param gameType - Optional game type for context-aware strategies
   * @returns Executor with progressive hybrid strategy order
   *
   * @example
   * ```typescript
   * const executor = UnstickStrategyExecutor.createProgressiveHybrid("platformer");
   * const result = await executor.executeAll(page, context);
   * ```
   */
  static createProgressiveHybrid(gameType?: string): UnstickStrategyExecutor {
    log.info(
      { gameType: gameType || "unknown" },
      "Creating progressive hybrid unstick executor",
    );

    // Level 1: Gentle - Non-intrusive, game-specific
    const level1Strategies: UnstickStrategy[] = [
      new IframeDetectionStrategy(), // Common for itch.io, WebGL games
      new DOMButtonFinderStrategy(), // Find "Play", "Start", "Continue" buttons
    ];

    // Add game-type-specific keyboard if game type is known
    if (gameType) {
      level1Strategies.push(new GameTypeKeyboardStrategy());
    }

    // Level 2: Moderate - Intelligent but costs API calls
    const level2Strategies: UnstickStrategy[] = [
      new VisionGuidedClickStrategy(), // AI identifies clickable elements
    ];

    // Level 3: Aggressive - Universal fallbacks
    const level3Strategies: UnstickStrategy[] = [
      new KeyboardMashStrategy(), // Random keyboard inputs
      new PageRefreshStrategy(), // Last resort: refresh page
    ];

    // Combine all levels
    const allStrategies = [
      ...level1Strategies,
      ...level2Strategies,
      ...level3Strategies,
    ];

    log.info(
      {
        totalStrategies: allStrategies.length,
        level1Count: level1Strategies.length,
        level2Count: level2Strategies.length,
        level3Count: level3Strategies.length,
      },
      "Progressive hybrid executor created",
    );

    return new UnstickStrategyExecutor(allStrategies);
  }
}
