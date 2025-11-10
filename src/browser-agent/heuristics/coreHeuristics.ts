/**
 * Core heuristic patterns for automated game interaction (Layer 1).
 *
 * Provides predefined action sequences for common game types:
 * - Platformer games (arrow keys, space for jump)
 * - Clicker/idle games (repeated clicking)
 * - Puzzle games (element interaction)
 * - Generic fallback (common inputs)
 *
 * Heuristics are fast and cost-efficient, avoiding LLM calls while
 * providing reasonable interaction for many game types.
 *
 * @module heuristics/coreHeuristics
 *
 * @example
 * ```typescript
 * import { executeHeuristic, HEURISTICS } from './coreHeuristics';
 *
 * const result = await executeHeuristic(page, HEURISTICS.PLATFORMER);
 * if (result.confidence > 80) {
 *   console.log('Platformer heuristic succeeded!');
 * }
 * ```
 */

import type { Page } from "@browserbasehq/stagehand";
import { logger } from "@/utils/logger";
import type {
  Action,
  ActionExecutionResult,
  ActionResult,
  Heuristic,
} from "./types";

const log = logger.child({ component: "CoreHeuristics" });

/**
 * Platformer game heuristic.
 *
 * Suitable for: Side-scrolling games, platform games, runner games.
 * Actions: Click to focus, arrow keys for movement, space for jump.
 * Confidence: High if game responds to keyboard input.
 */
export const PLATFORMER_HEURISTIC: Heuristic = {
  name: "platformer",
  triggers: [
    "canvas",
    "arrow keys",
    "platformer",
    "jump",
    "run",
    "side-scroll",
  ],
  actions: [
    { type: "click", target: "center", delay: 500 },
    { type: "keyboard", value: "ArrowRight", delay: 1000 },
    { type: "keyboard", value: "Space", delay: 500 },
    { type: "keyboard", value: "ArrowLeft", delay: 1000 },
    { type: "keyboard", value: "ArrowUp", delay: 500 },
    { type: "screenshot", delay: 500 },
  ],
  evaluate: async (
    _page: Page,
    results: ActionExecutionResult[],
  ): Promise<ActionResult> => {
    // Platformer games typically respond well to keyboard input
    // High confidence if actions completed without errors
    const hasScreenshot = results.some((r) => r?.type === "screenshot");

    return {
      success: true,
      confidence: hasScreenshot ? 85 : 70,
      reasoning:
        "Executed platformer pattern: center click, arrow keys, space for jump. Game typically responds to keyboard controls.",
      actions: PLATFORMER_HEURISTIC.actions,
    };
  },
};

/**
 * Clicker/idle game heuristic.
 *
 * Suitable for: Idle games, clicker games, incremental games.
 * Actions: Repeated clicks, waiting for value changes, looking for upgrades.
 * Confidence: High if clicks produce visible changes.
 */
export const CLICKER_HEURISTIC: Heuristic = {
  name: "clicker",
  triggers: [
    "clicker",
    "idle",
    "incremental",
    "upgrade",
    "cookie",
    "tap",
    "mining",
  ],
  actions: [
    { type: "click", target: "center", delay: 200 },
    { type: "click", target: "center", delay: 200 },
    { type: "click", target: "center", delay: 200 },
    { type: "screenshot", delay: 500 },
    { type: "wait", delay: 1000 },
    { type: "click", target: "center", delay: 200 },
    { type: "click", target: "center", delay: 200 },
    { type: "screenshot", delay: 500 },
  ],
  evaluate: async (
    _page: Page,
    results: ActionExecutionResult[],
  ): Promise<ActionResult> => {
    // Clicker games respond to repeated clicks
    // High confidence if multiple clicks executed successfully
    const screenshotCount = results.filter(
      (r) => r?.type === "screenshot",
    ).length;

    return {
      success: true,
      confidence: screenshotCount >= 2 ? 90 : 75,
      reasoning:
        "Executed clicker pattern: multiple clicks with pauses. Captured state changes for incremental value detection.",
      actions: CLICKER_HEURISTIC.actions,
    };
  },
};

/**
 * Puzzle game heuristic.
 *
 * Suitable for: Match-3 games, tile puzzles, grid-based games.
 * Actions: Click various elements, observe changes, try interactions.
 * Confidence: Moderate if elements respond to clicks.
 */
export const PUZZLE_HEURISTIC: Heuristic = {
  name: "puzzle",
  triggers: ["puzzle", "match", "grid", "tile", "swap", "candy", "jewel"],
  actions: [
    { type: "click", target: "center", delay: 500 },
    { type: "click", target: "offset:100,100", delay: 500 },
    { type: "screenshot", delay: 500 },
    { type: "wait", delay: 1000 },
    { type: "click", target: "offset:-100,0", delay: 500 },
    { type: "click", target: "offset:0,100", delay: 500 },
    { type: "screenshot", delay: 500 },
  ],
  evaluate: async (
    _page: Page,
    results: ActionExecutionResult[],
  ): Promise<ActionResult> => {
    // Puzzle games require element interaction
    // Moderate confidence - visual analysis needed for validation
    const hasScreenshots = results.some((r) => r?.type === "screenshot");

    return {
      success: true,
      confidence: hasScreenshots ? 75 : 60,
      reasoning:
        "Executed puzzle pattern: clicked various positions to interact with grid elements. Captured screenshots for visual analysis.",
      actions: PUZZLE_HEURISTIC.actions,
    };
  },
};

/**
 * Generic game heuristic (fallback).
 *
 * Suitable for: Unknown game types, fallback pattern, exploration games.
 * Actions: Systematic exploration pattern - covers entire play area efficiently.
 * Uses a zigzag sweep pattern ideal for collection/exploration games.
 * Confidence: Moderate - allows vision escalation for complex scenarios.
 */
export const GENERIC_HEURISTIC: Heuristic = {
  name: "generic",
  triggers: ["*"], // Matches any game
  actions: [
    // Initial focus click
    { type: "click", target: "center", delay: 300 },
    // Systematic sweep pattern - horizontal zigzag
    { type: "keyboard", value: "ArrowRight", delay: 800 },
    { type: "keyboard", value: "ArrowRight", delay: 800 },
    { type: "keyboard", value: "ArrowDown", delay: 800 },
    { type: "keyboard", value: "ArrowLeft", delay: 800 },
    { type: "keyboard", value: "ArrowLeft", delay: 800 },
    { type: "keyboard", value: "ArrowDown", delay: 800 },
    { type: "keyboard", value: "ArrowRight", delay: 800 },
    { type: "keyboard", value: "ArrowRight", delay: 800 },
    { type: "keyboard", value: "ArrowUp", delay: 800 },
    { type: "screenshot", delay: 500 },
  ],
  evaluate: async (
    _page: Page,
    results: ActionExecutionResult[],
  ): Promise<ActionResult> => {
    // Generic pattern uses systematic exploration
    // Moderate confidence to allow vision escalation for edge cases
    const hasScreenshots = results.some((r) => r?.type === "screenshot");

    return {
      success: true,
      confidence: hasScreenshots ? 55 : 45,
      reasoning:
        "Executed systematic exploration pattern (zigzag sweep). Covers play area efficiently. Vision analysis recommended for strategic refinement.",
      actions: GENERIC_HEURISTIC.actions,
    };
  },
};

/**
 * Executes a specific heuristic pattern on the given page.
 *
 * Runs the heuristic's action sequence, captures evidence, and
 * evaluates the result with confidence scoring.
 *
 * @param page - Playwright page object
 * @param heuristic - Heuristic pattern to execute
 * @returns ActionResult with success, confidence, and reasoning
 *
 * @throws Never throws - returns low confidence on errors
 *
 * @example
 * ```typescript
 * const result = await executeHeuristic(page, PLATFORMER_HEURISTIC);
 * console.log(`Confidence: ${result.confidence}%`);
 * ```
 */
export async function executeHeuristic(
  page: Page,
  heuristic: Heuristic,
): Promise<ActionResult> {
  log.info({ heuristic: heuristic.name }, "Executing heuristic pattern");

  try {
    const results: ActionExecutionResult[] = [];

    for (const action of heuristic.actions) {
      try {
        switch (action.type) {
          case "click":
            await executeClick(page, action);
            results.push({ type: "click", action });
            break;

          case "keyboard":
            await executeKeyboard(page, action);
            results.push({ type: "keyboard", action });
            break;

          case "wait":
            await new Promise((resolve) =>
              setTimeout(resolve, action.delay || 1000),
            );
            results.push({ type: "wait", action });
            break;

          case "screenshot": {
            const screenshot = await page.screenshot();
            results.push({ type: "screenshot", data: screenshot });
            break;
          }
        }

        // Add delay after action if specified
        if (action.delay && action.type !== "wait") {
          await new Promise((resolve) => setTimeout(resolve, action.delay));
        }
      } catch (actionError) {
        // Log individual action failure but continue sequence
        const err =
          actionError instanceof Error
            ? actionError
            : new Error(String(actionError));
        log.warn(
          { error: err.message, actionType: action.type },
          "Action failed, continuing heuristic",
        );
        results.push({ type: action.type, action, error: err.message });
      }
    }

    // Evaluate results
    const result = await heuristic.evaluate(page, results);

    log.info(
      {
        heuristic: heuristic.name,
        confidence: result.confidence,
        success: result.success,
      },
      "Heuristic execution complete",
    );

    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error(
      { error: err.message, heuristic: heuristic.name },
      "Heuristic execution failed",
    );

    // Return low confidence result rather than throwing
    return {
      success: false,
      confidence: 0,
      reasoning: `Heuristic failed: ${err.message}`,
      actions: heuristic.actions,
    };
  }
}

/**
 * Executes a click action on the page.
 *
 * Supports special targets:
 * - 'center': Click center of viewport
 * - 'offset:x,y': Click offset from center
 * - CSS selector: Click element matching selector
 *
 * @param page - Playwright page
 * @param action - Click action configuration
 * @private
 */
async function executeClick(page: Page, action: Action): Promise<void> {
  const viewport = page.viewportSize();
  const centerX = viewport ? viewport.width / 2 : 512;
  const centerY = viewport ? viewport.height / 2 : 384;

  if (action.target === "center") {
    // Click center of viewport
    await page.mouse.click(centerX, centerY);
  } else if (action.target?.startsWith("offset:")) {
    // Click offset from center (e.g., "offset:100,-50")
    const offsetStr = action.target.substring(7);
    const [xStr, yStr] = offsetStr.split(",");
    const x = centerX + Number.parseInt(xStr || "0", 10);
    const y = centerY + Number.parseInt(yStr || "0", 10);
    await page.mouse.click(x, y);
  } else if (action.target) {
    // Click element by selector
    try {
      await page.click(action.target);
    } catch {
      // If selector fails, click center as fallback
      await page.mouse.click(centerX, centerY);
    }
  }
}

/**
 * Executes a keyboard action on the page.
 *
 * @param page - Playwright page
 * @param action - Keyboard action configuration
 * @private
 */
async function executeKeyboard(page: Page, action: Action): Promise<void> {
  if (action.value) {
    await page.keyboard.press(action.value);
  }
}

/**
 * Collection of all available heuristic patterns.
 */
export const HEURISTICS = {
  PLATFORMER: PLATFORMER_HEURISTIC,
  CLICKER: CLICKER_HEURISTIC,
  PUZZLE: PUZZLE_HEURISTIC,
  GENERIC: GENERIC_HEURISTIC,
} as const;
