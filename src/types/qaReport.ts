/**
 * Core data types for QA test reports and results.
 *
 * These interfaces define the structure of test reports, evidence, and evaluation data
 * used throughout the Denethor system. All types are JSON-serializable for report generation.
 *
 * @module qaReport
 */

/**
 * Browser configuration used for testing.
 */
export interface BrowserSettings {
  /** Browser type (e.g., "chrome") */
  browser: string;
  /** Viewport dimensions */
  viewport: {
    width: number;
    height: number;
  };
  /** Browser launch arguments */
  arguments: string[];
  /** Device type (e.g., "desktop") */
  device: string;
  /** Locale setting (e.g., "en-US") */
  locale: string;
}

/**
 * Test metadata containing identification and timing information.
 */
export interface TestMetadata {
  /** Unique identifier for this test run (UUID format) */
  testId: string;
  /** URL of the game being tested */
  gameUrl: string;
  /** ISO 8601 timestamp when test started */
  timestamp: string;
  /** Test duration in seconds */
  duration: number;
  /** Version of the QA agent that ran the test */
  agentVersion: string;
  /** Browser configuration used for testing */
  browserSettings: BrowserSettings;
}

/**
 * Playability scores across different quality dimensions.
 * All scores are on a 0-100 scale where 100 is best.
 */
export interface PlayabilityScores {
  /** Game load success score (0-100) */
  loadSuccess: number;
  /** Game responsiveness score (0-100) */
  responsiveness: number;
  /** Game stability score (0-100) */
  stability: number;
  /** Overall playability score (0-100) - weighted average */
  overallPlayability: number;
}

/**
 * Individual issue detected during testing.
 */
export interface Issue {
  /** Severity level of the issue */
  severity: "critical" | "major" | "minor";
  /** Category type of the issue */
  category: string;
  /** Human-readable description of the issue */
  description: string;
  /** Optional path to screenshot evidence */
  screenshot?: string;
}

/**
 * Evidence collected during test execution.
 */
export interface Evidence {
  /** Array of screenshot file paths */
  screenshots: string[];
  /** Log file paths organized by type */
  logs: {
    /** Path to console log file */
    console: string;
    /** Path to actions log file */
    actions: string;
    /** Path to errors log file */
    errors: string;
  };
}

/**
 * Individual action taken during test execution (logged in report).
 */
export interface Action {
  /** Type of action performed */
  type: string;
  /** ISO 8601 timestamp when action was executed */
  timestamp: string;
  /** Whether the action completed successfully */
  success: boolean;
  /** Optional additional details about the action */
  details?: string;
  /** Action execution duration in milliseconds (NEW) */
  durationMs?: number;
  /** Action start time in milliseconds since epoch (NEW) */
  startTime?: number;
  /** Action end time in milliseconds since epoch (NEW) */
  endTime?: number;
}

/**
 * DOM element information extracted from page.
 */
export interface DOMElement {
  /** Element tag name */
  tag: string;
  /** Element text content (trimmed) */
  text: string;
  /** Element ID attribute if present */
  id?: string;
  /** Element class names */
  classes: string[];
  /** Element position and dimensions */
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Whether element is currently visible in viewport */
  visible: boolean;
  /** Whether element is clickable (has click handler or is link/button) */
  clickable: boolean;
}

/**
 * Canvas element information.
 */
export interface CanvasInfo {
  /** Canvas ID attribute if present */
  id?: string;
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
  /** Canvas position and dimensions */
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Whether canvas is visible in viewport */
  visible: boolean;
  /** Whether canvas appears to be the main game canvas (heuristic) */
  isPrimaryGame: boolean;
}

/**
 * Comprehensive DOM analysis of the page.
 */
export interface DOMAnalysis {
  /** All button elements found */
  buttons: DOMElement[];
  /** All link elements found */
  links: DOMElement[];
  /** All input elements found */
  inputs: DOMElement[];
  /** All canvas elements found */
  canvases: CanvasInfo[];
  /** All heading elements (h1-h6) */
  headings: DOMElement[];
  /** All clickable text elements (not buttons/links) */
  clickableText: DOMElement[];
  /** Current viewport dimensions */
  viewport: {
    width: number;
    height: number;
  };
  /** Total number of interactive elements */
  interactiveCount: number;
}

/**
 * Browser action command for interaction with game elements.
 * Used by Browser Agent to define specific actions to execute.
 */
export interface BrowserAction {
  /** Type of browser action to perform */
  type: "click" | "keyboard" | "wait" | "screenshot" | "scroll";
  /** Optional target element selector */
  target?: string;
  /** Optional keyboard keys to press */
  keys?: string[];
  /** Optional duration in milliseconds */
  duration?: number;
  /** ISO 8601 timestamp when action was created */
  timestamp: string;
}

/**
 * Result of executing a browser action.
 * Includes success status, confidence level, and optional evidence or error.
 */
export interface ActionResult {
  /** Whether the action completed successfully */
  success: boolean;
  /** Confidence level in the action result (0-100) */
  confidence: number;
  /** Optional array of evidence file paths (screenshots, logs) */
  evidence?: string[];
  /** Optional error if action failed */
  error?: Error;
}

/**
 * Complete QA test report structure.
 *
 * This is the primary data structure returned by the QA agent and used for report generation.
 * All fields are JSON-serializable for easy storage and transmission.
 *
 * @example
 * ```typescript
 * const report: QAReport = {
 *   meta: {
 *     testId: 'uuid-here',
 *     gameUrl: 'https://game.com/play',
 *     timestamp: '2025-11-03T12:00:00Z',
 *     duration: 45,
 *     agentVersion: '1.0.0'
 *   },
 *   status: 'success',
 *   scores: {
 *     loadSuccess: 100,
 *     responsiveness: 85,
 *     stability: 90,
 *     overallPlayability: 88
 *   },
 *   evaluation: {
 *     reasoning: 'Game loaded successfully and played well...',
 *     confidence: 95
 *   },
 *   issues: [],
 *   evidence: {
 *     screenshots: ['00-initial-load.png', '01-gameplay.png'],
 *     logs: {
 *       console: 'logs/console.log',
 *       actions: 'logs/actions.log',
 *       errors: 'logs/errors.log'
 *     }
 *   },
 *   actions: [
 *     { type: 'navigate', timestamp: '2025-11-03T12:00:05Z', success: true }
 *   ]
 * }
 * ```
 */
export interface QAReport {
  /** Test metadata and identification */
  meta: TestMetadata;
  /** Test execution status */
  status: "success" | "failure" | "error";
  /** Playability scores across dimensions */
  scores: PlayabilityScores;
  /** AI evaluation reasoning and confidence */
  evaluation: {
    /** Explanation of the evaluation and scores */
    reasoning: string;
    /** Confidence in the evaluation (0-100) */
    confidence: number;
  };
  /** Issues detected during testing */
  issues: Issue[];
  /** Evidence collected during test execution */
  evidence: Evidence;
  /** Actions performed during test */
  actions: Action[];
  /**
   * Progress metrics showing how well the test progressed through the game.
   * @since v1.4.0
   */
  progressMetrics?: {
    /** Number of unique visual game states seen */
    uniqueStates: number;

    /** Percentage of inputs that caused visible changes (0-100) */
    inputSuccessRate: number;

    /** Total actions attempted */
    totalActions: number;

    /** Actions that resulted in screen changes */
    successfulActions: number;
  };

  /**
   * Action timing metrics showing performance characteristics of test execution.
   * Includes only actions with timing data (actions executed via executeAction).
   * @since v1.5.0
   */
  timingMetrics?: {
    /** Total number of timed actions */
    totalTimedActions: number;

    /** Average action execution duration in milliseconds */
    averageDurationMs: number;

    /** Minimum action duration in milliseconds */
    minDurationMs: number;

    /** Maximum action duration in milliseconds */
    maxDurationMs: number;

    /** Total time spent executing actions in milliseconds */
    totalDurationMs: number;

    /** Number of slow actions (duration > 5000ms) */
    slowActionsCount: number;
  };
}
