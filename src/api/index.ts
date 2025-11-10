/**
 * Programmatic API for Denethor.
 *
 * This module provides the main programmatic interface for running QA tests
 * on browser games. It exports the QAOrchestrator class, utility types, and
 * a simple wrapper function for ease of use.
 *
 * @module api
 *
 * @example
 * ```typescript
 * // Simple usage with wrapper function
 * import { runQATest } from 'browsergame-qa';
 *
 * const results = await runQATest('https://example.com/game');
 * console.log(results.report.scores.overallPlayability);
 * ```
 *
 * @example
 * ```typescript
 * // Advanced usage with QAOrchestrator class
 * import { QAOrchestrator } from 'browsergame-qa';
 *
 * const orchestrator = new QAOrchestrator({
 *   gameUrl: 'https://example.com/game',
 *   maxActions: 20,
 *   sessionTimeout: 60000,
 *   outputDir: './my-results'
 * });
 *
 * const results = await orchestrator.runTest();
 * ```
 */

export { AIEvaluator, type EvaluationResult } from "@/ai-evaluator/aiEvaluator";
export {
  BrowserAgent,
  type GameType,
  type GameTypeDetectionResult,
} from "@/browser-agent/browserAgent";
export { GameCrashError } from "@/errors/gameCrashError";
// Export error classes
export { QAError } from "@/errors/qaError";
export { RetryableError } from "@/errors/retryableError";
export { ValidationError } from "@/errors/validationError";
// Export component classes for advanced usage
export {
  type EvidenceCollection,
  EvidenceStore,
  type LogType,
} from "@/evidence-store/evidenceStore";
// Export main orchestrator
export {
  QAOrchestrator,
  type QAOrchestratorConfig,
  type QATestResult,
} from "@/orchestrator/qaOrchestrator";
export {
  ReportGenerator,
  type ReportPaths,
} from "@/report-generator/reportGenerator";
// Export all shared types
export type {
  Action,
  ActionResult,
  BrowserAction,
  Config,
  Evidence,
  Issue,
  PlayabilityScores,
  QAReport,
  TestMetadata,
} from "@/types";

// Import for wrapper function
import {
  QAOrchestrator,
  type QATestResult,
} from "@/orchestrator/qaOrchestrator";

/**
 * Options for the runQATest wrapper function.
 */
export interface QATestOptions {
  /** Output directory for test results (default: './output') */
  outputDir?: string;
  /** Maximum session timeout in milliseconds (default: 300000 = 5 minutes) */
  sessionTimeout?: number;
  /** Maximum number of actions to execute (default: 20) */
  maxActions?: number;
  /**
   * Optional hint about game input controls to guide testing strategy.
   * @example "Arrow keys for movement, spacebar to jump"
   */
  inputHint?: string;
}

/**
 * Simple wrapper function to run a QA test on a game URL.
 *
 * This is the simplest way to use Denethor. It creates a QAOrchestrator
 * internally, runs the test, and returns the results.
 *
 * @param gameUrl - URL of the game to test
 * @param options - Optional configuration
 * @returns Promise resolving to test results
 * @throws {ValidationError} If gameUrl is invalid
 * @throws {GameCrashError} If game crashes during testing
 * @throws {Error} For other failures
 *
 * @example
 * ```typescript
 * // Simplest usage
 * const results = await runQATest('https://example.com/game');
 * console.log(results.report.scores.overallPlayability);
 * ```
 *
 * @example
 * ```typescript
 * // With options
 * const results = await runQATest('https://example.com/game', {
 *   outputDir: './my-results',
 *   maxActions: 15,
 *   sessionTimeout: 60000,
 *   inputHint: 'Arrow keys for movement, spacebar to jump'
 * });
 *
 * if (results.report.status === 'success') {
 *   console.log('Game passed QA!');
 *   console.log(`Reports available at: ${results.reportPaths.html}`);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Error handling
 * try {
 *   const results = await runQATest('https://example.com/game');
 *   console.log(`Score: ${results.report.scores.overallPlayability}/100`);
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     console.error('Invalid URL:', error.message);
 *   } else if (error instanceof GameCrashError) {
 *     console.error('Game crashed:', error.message);
 *   } else {
 *     console.error('Test failed:', error);
 *   }
 * }
 * ```
 */
export async function runQATest(
  gameUrl: string,
  options?: QATestOptions,
): Promise<QATestResult> {
  const orchestrator = new QAOrchestrator({
    gameUrl,
    outputDir: options?.outputDir,
    sessionTimeout: options?.sessionTimeout,
    maxActions: options?.maxActions,
    inputHint: options?.inputHint,
  });

  return orchestrator.runTest();
}

/**
 * Default export for convenience.
 *
 * @example
 * ```typescript
 * import runQATest from 'browsergame-qa';
 *
 * const results = await runQATest('https://example.com/game');
 * ```
 */
export default runQATest;
