/**
 * Progress Detector - Tracks game state changes during QA testing.
 *
 * Monitors screenshot changes to determine if the game is responsive
 * and progressing, or stuck on the same screen.
 *
 * @module progressDetector
 */

import { createHash } from "node:crypto";
import { logger } from "./logger";

const log = logger.child({ component: "ProgressDetector" });

/**
 * Metrics tracking game progress during testing.
 *
 * Uses hybrid detection with both screenshot and DOM hashing to catch:
 * - Visual changes (screenshot hash)
 * - Data/text updates (DOM hash)
 * - Subtle progress indicators (scores, timers, HP bars)
 */
export interface ProgressMetrics {
  /** Number of screenshots that showed visual changes */
  screenshotsWithChanges: number;

  /** Number of screenshots identical to previous */
  screenshotsIdentical: number;

  /** Current streak of consecutive identical screenshots */
  consecutiveIdentical: number;

  /** Number of unique visual game states seen */
  uniqueGameStates: number;

  /** Total inputs/actions attempted */
  inputsAttempted: number;

  /** Number of inputs that caused visible changes */
  inputsSuccessful: number;

  /** Progress score 0-100 (percentage of successful inputs) */
  progressScore: number;

  /** List of all unique screenshot hashes seen */
  seenStates: Set<string>;

  /** Number of DOM states that showed changes (NEW) */
  domWithChanges: number;

  /** Number of DOM states identical to previous (NEW) */
  domIdentical: number;

  /** Current streak of consecutive identical DOM states (NEW) */
  consecutiveDOMIdentical: number;

  /** Number of unique DOM states seen (NEW) */
  uniqueDOMStates: number;

  /** List of all unique DOM hashes seen (NEW) */
  seenDOMStates: Set<string>;
}

/**
 * Progress Detector for monitoring game state changes.
 *
 * Uses hybrid detection tracking both screenshot and DOM changes:
 * - **Screenshot hash**: Detects visual changes
 * - **DOM hash**: Detects data/text updates (scores, timers, HP bars)
 *
 * Game is considered "progressing" if EITHER signal changes, preventing
 * false positives when visual appearance stays same but data updates.
 *
 * @example
 * ```typescript
 * const detector = new ProgressDetector();
 *
 * const screenshot = await page.screenshot();
 * const domSnapshot = await page.evaluate(() => document.body.innerText);
 * const changed = detector.recordScreenshot(screenshot, domSnapshot, "click");
 *
 * if (detector.isStuck()) {
 *   console.log("Game appears stuck - try different input");
 * }
 * ```
 */
export class ProgressDetector {
  private metrics: ProgressMetrics;
  private lastScreenshotHash: string | null = null;
  private lastDOMHash: string | null = null;

  constructor() {
    this.metrics = {
      screenshotsWithChanges: 0,
      screenshotsIdentical: 0,
      consecutiveIdentical: 0,
      uniqueGameStates: 0,
      inputsAttempted: 0,
      inputsSuccessful: 0,
      progressScore: 0,
      seenStates: new Set<string>(),
      domWithChanges: 0,
      domIdentical: 0,
      consecutiveDOMIdentical: 0,
      uniqueDOMStates: 0,
      seenDOMStates: new Set<string>(),
    };
  }

  /**
   * Records a screenshot and DOM snapshot, checks if either differs from previous.
   *
   * Uses hybrid detection:
   * - Screenshot hash detects visual changes
   * - DOM hash detects data/text changes (scores, timers, etc.)
   * - Progress if EITHER changes
   *
   * @param screenshot - Screenshot buffer to analyze
   * @param domSnapshot - DOM text content snapshot (from page.evaluate)
   * @param actionType - Type of action that preceded this screenshot
   * @returns true if screenshot OR DOM changed, false if both identical
   */
  recordScreenshot(screenshot: Buffer, domSnapshot: string, actionType: string): boolean {
    this.metrics.inputsAttempted++;

    const currentScreenshotHash = hashBuffer(screenshot);
    const currentDOMHash = hashString(domSnapshot);

    // First screenshot - nothing to compare to
    if (this.lastScreenshotHash === null || this.lastDOMHash === null) {
      this.lastScreenshotHash = currentScreenshotHash;
      this.lastDOMHash = currentDOMHash;
      this.metrics.seenStates.add(currentScreenshotHash);
      this.metrics.seenDOMStates.add(currentDOMHash);
      this.metrics.uniqueGameStates = this.metrics.seenStates.size;
      this.metrics.uniqueDOMStates = this.metrics.seenDOMStates.size;

      log.debug(
        {
          screenshotHash: currentScreenshotHash.substring(0, 12),
          domHash: currentDOMHash.substring(0, 12),
        },
        "First screenshot and DOM recorded",
      );
      return true; // Consider first screenshot as "changed"
    }

    // Compare screenshot to previous
    const screenshotChanged = currentScreenshotHash !== this.lastScreenshotHash;

    // Compare DOM to previous
    const domChanged = currentDOMHash !== this.lastDOMHash;

    // Hybrid: progress if EITHER changed
    const anyChange = screenshotChanged || domChanged;

    if (screenshotChanged) {
      this.metrics.screenshotsWithChanges++;
      this.metrics.consecutiveIdentical = 0; // Reset streak

      // Track unique screenshot states
      const isNewState = !this.metrics.seenStates.has(currentScreenshotHash);
      this.metrics.seenStates.add(currentScreenshotHash);
      this.metrics.uniqueGameStates = this.metrics.seenStates.size;

      log.info(
        {
          actionType,
          hash: currentScreenshotHash.substring(0, 12),
          isNewState,
          uniqueStates: this.metrics.uniqueGameStates,
        },
        "Screenshot changed - visual update detected",
      );
    } else {
      this.metrics.screenshotsIdentical++;
      this.metrics.consecutiveIdentical++;
    }

    if (domChanged) {
      this.metrics.domWithChanges++;
      this.metrics.consecutiveDOMIdentical = 0; // Reset DOM streak

      // Track unique DOM states
      const isNewDOMState = !this.metrics.seenDOMStates.has(currentDOMHash);
      this.metrics.seenDOMStates.add(currentDOMHash);
      this.metrics.uniqueDOMStates = this.metrics.seenDOMStates.size;

      log.info(
        {
          actionType,
          domHash: currentDOMHash.substring(0, 12),
          isNewDOMState,
          uniqueDOMStates: this.metrics.uniqueDOMStates,
        },
        "DOM changed - data/text update detected",
      );
    } else {
      this.metrics.domIdentical++;
      this.metrics.consecutiveDOMIdentical++;
    }

    // Update success counter if ANY change detected
    if (anyChange) {
      this.metrics.inputsSuccessful++;
      log.info(
        {
          actionType,
          screenshotChanged,
          domChanged,
        },
        "Game is responsive - progress detected",
      );
    } else {
      log.warn(
        {
          actionType,
          consecutiveIdenticalScreenshots: this.metrics.consecutiveIdentical,
          consecutiveIdenticalDOM: this.metrics.consecutiveDOMIdentical,
        },
        "No changes detected - game may be stuck",
      );
    }

    this.lastScreenshotHash = currentScreenshotHash;
    this.lastDOMHash = currentDOMHash;
    this.metrics.progressScore = calculateProgressScore(this.metrics);

    return anyChange;
  }

  /**
   * Checks if game appears stuck based on consecutive identical states.
   *
   * Uses hybrid detection - game is stuck if BOTH signals are identical:
   * - Screenshot unchanged for N consecutive actions
   * - DOM unchanged for N consecutive actions
   *
   * This prevents false positives when:
   * - Visual stays same but score/timer updates (DOM changes)
   * - DOM stays same but animations continue (screenshot changes)
   *
   * @param threshold - Number of consecutive identical states to consider stuck (default: 3)
   * @returns true if game is stuck (both screenshot AND DOM unchanged)
   */
  isStuck(threshold = 3): boolean {
    // Game is stuck only if BOTH signals are identical for threshold consecutive actions
    const screenshotStuck = this.metrics.consecutiveIdentical >= threshold;
    const domStuck = this.metrics.consecutiveDOMIdentical >= threshold;

    return screenshotStuck && domStuck;
  }

  /**
   * Gets current progress metrics.
   *
   * @returns Progress metrics object
   */
  getMetrics(): ProgressMetrics {
    return {
      ...this.metrics,
      seenStates: new Set(this.metrics.seenStates), // Return copy
    };
  }

  /**
   * Gets hash of last recorded screenshot.
   *
   * @returns Screenshot hash or null if no screenshots recorded
   */
  getLastScreenshotHash(): string | null {
    return this.lastScreenshotHash;
  }

  /**
   * Resets all metrics (useful for testing).
   */
  reset(): void {
    this.metrics = {
      screenshotsWithChanges: 0,
      screenshotsIdentical: 0,
      consecutiveIdentical: 0,
      uniqueGameStates: 0,
      inputsAttempted: 0,
      inputsSuccessful: 0,
      progressScore: 0,
      seenStates: new Set<string>(),
      domWithChanges: 0,
      domIdentical: 0,
      consecutiveDOMIdentical: 0,
      uniqueDOMStates: 0,
      seenDOMStates: new Set<string>(),
    };
    this.lastScreenshotHash = null;
    this.lastDOMHash = null;
  }
}

/**
 * Hashes a buffer using SHA-256.
 *
 * @param buffer - Buffer to hash
 * @returns Hex string hash
 */
export function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Hashes a string using SHA-256.
 *
 * Used for hashing DOM text content to detect data/text changes
 * without full visual comparison.
 *
 * @param str - String to hash (typically DOM innerText)
 * @returns Hex string hash
 */
export function hashString(str: string): string {
  return createHash("sha256").update(str, "utf8").digest("hex");
}

/**
 * Compares two buffers for equality.
 *
 * @param buf1 - First buffer
 * @param buf2 - Second buffer
 * @returns true if buffers are identical
 */
export function buffersEqual(buf1: Buffer, buf2: Buffer): boolean {
  return Buffer.compare(buf1, buf2) === 0;
}

/**
 * Calculates progress score 0-100 based on metrics.
 *
 * @param metrics - Progress metrics
 * @returns Score 0-100
 */
export function calculateProgressScore(metrics: ProgressMetrics): number {
  if (metrics.inputsAttempted === 0) return 0;

  const successRate = (metrics.inputsSuccessful / metrics.inputsAttempted) * 100;

  // Bonus for seeing multiple unique states
  const uniqueStateBonus = Math.min(metrics.uniqueGameStates * 5, 20);

  const score = Math.min(successRate + uniqueStateBonus, 100);

  return Math.round(score);
}
