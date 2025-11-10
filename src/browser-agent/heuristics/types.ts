/**
 * Type definitions for heuristic-based game interaction patterns.
 *
 * Heuristics are predefined action patterns for common game types that
 * provide fast, cost-efficient interactions without LLM calls (Layer 1
 * of the hybrid action strategy).
 *
 * @module heuristics/types
 */

import type { Page } from "@browserbasehq/stagehand";

/**
 * Action types that can be executed by heuristics.
 */
export type ActionType =
  | "click"
  | "keyboard"
  | "wait"
  | "screenshot"
  | "scroll";

/**
 * Individual action to be executed during heuristic pattern.
 */
export interface Action {
  /** Type of action to execute */
  type: ActionType;

  /** Target selector or coordinate descriptor (e.g., 'center', '#button') */
  target?: string;

  /** Value for keyboard actions (key name) */
  value?: string;

  /** Explicit click coordinates (for canvas-rendered elements) */
  coordinates?: {
    x: number;
    y: number;
  };

  /** Delay in milliseconds after action */
  delay?: number;
}

/**
 * Result of executing a heuristic action sequence.
 */
export interface ActionResult {
  /** Whether the heuristic execution succeeded */
  success: boolean;

  /** Confidence score 0-100 (higher = more confident) */
  confidence: number;

  /** Human-readable explanation of the result */
  reasoning: string;

  /** Actions that were executed */
  actions: Action[];
}

/**
 * Result of a single action execution during heuristic pattern.
 */
export interface ActionExecutionResult {
  /** Type of action that was executed */
  type: ActionType;
  /** The action that was executed */
  action?: Action;
  /** Screenshot data if type is "screenshot" */
  data?: Buffer;
  /** Error message if action failed */
  error?: string;
}

/**
 * Heuristic pattern for a specific game type.
 */
export interface Heuristic {
  /** Name of the heuristic pattern */
  name: string;

  /** Keywords/patterns that suggest this heuristic applies */
  triggers: string[];

  /** Sequence of actions to execute */
  actions: Action[];

  /** Evaluation function to assess heuristic success */
  evaluate: (
    page: Page,
    results: ActionExecutionResult[],
  ) => Promise<ActionResult>;
}
