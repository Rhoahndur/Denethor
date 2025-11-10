/**
 * Keyboard Controller for game input (Layer 1).
 *
 * Provides keyboard action execution including press, hold, sequence,
 * and combo. Essential for gameplay dynamics with continuous input.
 *
 * @module keyboardController
 *
 * @example
 * ```typescript
 * import { KeyboardController } from './keyboardController';
 *
 * const controller = new KeyboardController(page);
 * await controller.press("Space");
 * await controller.hold("ArrowRight", 1000); // Hold for 1 second
 * ```
 */

import type { Page } from "@browserbasehq/stagehand";
import { logger } from "@/utils/logger";

const log = logger.child({ component: "KeyboardController" });

/**
 * Keyboard action definition.
 */
export interface KeyboardAction {
  /** Type of keyboard action */
  type: "press" | "hold" | "sequence" | "combo";
  /** Single key (for press/hold) */
  key?: string;
  /** Multiple keys (for combo) */
  keys?: string[];
  /** Duration in milliseconds (for hold/combo) */
  duration?: number;
  /** Sequence of timed key presses */
  sequence?: Array<{ key: string; delay: number }>;
}

/**
 * Result of keyboard action execution.
 */
export interface KeyboardResult {
  /** Whether action succeeded */
  success: boolean;
  /** Description of action performed */
  action: string;
  /** Time taken in milliseconds */
  duration: number;
}

/**
 * Keyboard Controller for game input execution.
 *
 * Provides various keyboard input methods for game testing including
 * single presses, continuous holds, timed sequences, and key combos.
 *
 * **Features:**
 * - Single key press
 * - Key hold (via repeated presses)
 * - Timed key sequences
 * - Key combinations
 * - Abort support for long holds
 *
 * @example
 * ```typescript
 * const controller = new KeyboardController(page);
 *
 * // Single press
 * await controller.press("Space");
 *
 * // Hold for movement
 * await controller.hold("ArrowRight", 1000);
 *
 * // Sequence (e.g., combo move)
 * await controller.sequence([
 *   { key: "ArrowDown", delay: 50 },
 *   { key: "ArrowRight", delay: 50 },
 *   { key: "Space", delay: 100 }
 * ]);
 *
 * // Combo (simultaneous keys)
 * await controller.combo(["Control", "c"]);
 * ```
 */
export class KeyboardController {
  private abortController: AbortController | null = null;

  constructor(private page: Page) {}

  /**
   * Presses a single key.
   *
   * @param key - Key to press (e.g., "Space", "ArrowRight")
   * @returns Result with success status and duration
   *
   * @example
   * ```typescript
   * const result = await controller.press("Space");
   * console.log(result.action); // "Pressed Space"
   * ```
   */
  async press(key: string): Promise<KeyboardResult> {
    const startTime = Date.now();

    try {
      await this.page.keyboard.press(key);
      const duration = Date.now() - startTime;

      log.info({ key, duration }, "Keyboard press executed");

      return {
        success: true,
        action: `Pressed ${key}`,
        duration,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ key, error: err.message }, "Keyboard press failed");

      return {
        success: false,
        action: `Failed to press ${key}: ${err.message}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Holds a key for specified duration.
   *
   * Simulates holding by repeatedly pressing at intervals.
   * Can be aborted mid-hold via abort().
   *
   * @param key - Key to hold
   * @param duration - Hold duration in milliseconds
   * @param interval - Press interval in milliseconds (default: 100)
   * @returns Result with success status and actual duration
   *
   * @example
   * ```typescript
   * // Hold right arrow for 1 second (for continuous movement)
   * const result = await controller.hold("ArrowRight", 1000);
   * console.log(result.action); // "Held ArrowRight for 1002ms (10 presses)"
   * ```
   */
  async hold(
    key: string,
    duration: number,
    interval = 100,
  ): Promise<KeyboardResult> {
    const startTime = Date.now();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      log.info({ key, duration, interval }, "Starting keyboard hold");

      // Initial press
      await this.page.keyboard.press(key);

      const endTime = Date.now() + duration;
      let pressCount = 1;

      // Repeatedly press at intervals to simulate hold
      while (Date.now() < endTime && !signal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, interval));

        if (!signal.aborted) {
          await this.page.keyboard.press(key);
          pressCount++;
        }
      }

      const actualDuration = Date.now() - startTime;

      log.info(
        { key, duration: actualDuration, pressCount },
        "Keyboard hold completed",
      );

      return {
        success: true,
        action: `Held ${key} for ${actualDuration}ms (${pressCount} presses)`,
        duration: actualDuration,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ key, error: err.message }, "Keyboard hold failed");

      return {
        success: false,
        action: `Failed to hold ${key}: ${err.message}`,
        duration: Date.now() - startTime,
      };
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Executes a timed sequence of key presses.
   *
   * @param sequence - Array of key presses with delays
   * @returns Result with success status and total duration
   *
   * @example
   * ```typescript
   * // Execute a combo move
   * const result = await controller.sequence([
   *   { key: "ArrowDown", delay: 50 },
   *   { key: "ArrowRight", delay: 50 },
   *   { key: "Space", delay: 100 }
   * ]);
   * console.log(result.action); // "Sequence: ArrowDown → ArrowRight → Space"
   * ```
   */
  async sequence(
    sequence: Array<{ key: string; delay: number }>,
  ): Promise<KeyboardResult> {
    const startTime = Date.now();
    const actions: string[] = [];

    try {
      log.info({ sequenceLength: sequence.length }, "Starting keyboard sequence");

      for (const step of sequence) {
        await this.page.keyboard.press(step.key);
        actions.push(step.key);

        if (step.delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, step.delay));
        }
      }

      const duration = Date.now() - startTime;

      log.info({ actions, duration }, "Keyboard sequence completed");

      return {
        success: true,
        action: `Sequence: ${actions.join(" → ")}`,
        duration,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ error: err.message }, "Keyboard sequence failed");

      return {
        success: false,
        action: `Failed sequence after ${actions.length} keys: ${err.message}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Executes a key combination (simultaneous keys).
   *
   * @param keys - Array of keys to press together
   * @param duration - How long to hold combo (default: 500ms)
   * @returns Result with success status and duration
   *
   * @example
   * ```typescript
   * // Press Ctrl+C
   * const result = await controller.combo(["Control", "c"]);
   * console.log(result.action); // "Combo: Control+c for 502ms"
   * ```
   */
  async combo(keys: string[], duration = 500): Promise<KeyboardResult> {
    const startTime = Date.now();

    try {
      log.info({ keys, duration }, "Starting keyboard combo");

      // Press all keys down
      for (const key of keys) {
        await this.page.keyboard.down(key);
      }

      // Hold for duration
      await new Promise((resolve) => setTimeout(resolve, duration));

      // Release all keys in reverse order
      for (let i = keys.length - 1; i >= 0; i--) {
        const key = keys[i];
        if (key) {
          await this.page.keyboard.up(key);
        }
      }

      const actualDuration = Date.now() - startTime;

      log.info({ keys, duration: actualDuration }, "Keyboard combo completed");

      return {
        success: true,
        action: `Combo: ${keys.join("+")} for ${actualDuration}ms`,
        duration: actualDuration,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ keys, error: err.message }, "Keyboard combo failed");

      return {
        success: false,
        action: `Failed combo ${keys.join("+")}: ${err.message}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Aborts current keyboard action (if any).
   *
   * Only affects hold() operations currently in progress.
   *
   * @example
   * ```typescript
   * const holdPromise = controller.hold("ArrowRight", 5000);
   * setTimeout(() => controller.abort(), 1000); // Stop after 1 second
   * await holdPromise;
   * ```
   */
  abort(): void {
    if (this.abortController) {
      log.info("Aborting keyboard action");
      this.abortController.abort();
    }
  }

  /**
   * Executes a keyboard action based on type.
   *
   * @param action - Keyboard action definition
   * @returns Result with success status
   * @throws {Error} If action type is invalid or required parameters missing
   *
   * @example
   * ```typescript
   * const result = await controller.execute({
   *   type: 'press',
   *   key: 'Space'
   * });
   * ```
   */
  async execute(action: KeyboardAction): Promise<KeyboardResult> {
    switch (action.type) {
      case "press":
        if (!action.key) {
          throw new Error("Press action requires 'key' parameter");
        }
        return this.press(action.key);

      case "hold":
        if (!action.key || !action.duration) {
          throw new Error("Hold action requires 'key' and 'duration' parameters");
        }
        return this.hold(action.key, action.duration);

      case "sequence":
        if (!action.sequence) {
          throw new Error("Sequence action requires 'sequence' parameter");
        }
        return this.sequence(action.sequence);

      case "combo":
        if (!action.keys) {
          throw new Error("Combo action requires 'keys' parameter");
        }
        return this.combo(action.keys, action.duration);

      default:
        throw new Error(
          `Unknown keyboard action type: ${(action as any).type}`,
        );
    }
  }
}
