/**
 * AI Evaluation Prompts for Game Playability Assessment.
 *
 * This module contains structured prompts used by the AI Evaluator to analyze
 * game playability across multiple dimensions. Prompts are designed to elicit
 * consistent, accurate evaluations with structured JSON responses.
 *
 * @module prompts
 *
 * @example
 * ```typescript
 * import { PLAYABILITY_EVALUATION_PROMPT, buildEvaluationPrompt } from './prompts';
 *
 * const prompt = buildEvaluationPrompt({
 *   screenshotCount: 5,
 *   hasConsoleLogs: true,
 *   hasActionLogs: true,
 *   hasErrors: true
 * });
 * ```
 */

/**
 * Context information for building evaluation prompts.
 */
export interface EvaluationContext {
  /** Number of screenshots captured during test */
  screenshotCount: number;
  /** Whether console logs are available */
  hasConsoleLogs: boolean;
  /** Whether action logs are available */
  hasActionLogs: boolean;
  /** Whether error logs are available */
  hasErrors: boolean;
  /** Optional summary of console errors */
  consoleSummary?: string;
  /** Optional summary of actions taken */
  actionSummary?: string;
}

/**
 * Main playability evaluation prompt template.
 *
 * This prompt guides GPT-4o to analyze game evidence and provide structured
 * playability scores across four dimensions:
 * - Load Success: Game initialization and asset loading
 * - Responsiveness: Control response and visual feedback
 * - Stability: Crashes, errors, and freezes
 * - Overall Playability: Weighted assessment of game quality
 *
 * The prompt requests structured JSON output with scores (0-100), reasoning,
 * and confidence level to ensure consistent, parseable results.
 *
 * **Scoring Rubric (from PRD):**
 *
 * **Load Success (0-100):**
 * - 90-100: Game fully loaded, all assets visible
 * - 70-89: Game loaded with minor visual issues
 * - 40-69: Game partially loaded, major assets missing
 * - 0-39: Game failed to load or blank screen
 *
 * **Responsiveness (0-100):**
 * - 90-100: All inputs trigger immediate visual feedback
 * - 70-89: Most inputs work, slight delay acceptable
 * - 40-69: Some inputs work, others unresponsive
 * - 0-39: No inputs work or major input failures
 *
 * **Stability (0-100):**
 * - 90-100: No errors, smooth gameplay throughout
 * - 70-89: Minor errors that don't affect gameplay
 * - 40-69: Significant errors but game still playable
 * - 0-39: Crashes, freezes, or game-breaking errors
 *
 * **Overall Playability (0-100):**
 * - 90-100: Production-ready, excellent user experience
 * - 70-89: Playable with minor issues
 * - 40-69: Playable but significant UX problems
 * - 0-39: Not playable, critical issues
 */
export const PLAYABILITY_EVALUATION_PROMPT = `You are a QA engineer evaluating a browser-based game. You have access to evidence collected during an automated test run.

Your task is to analyze the evidence and provide a comprehensive playability assessment across four dimensions:

1. **Load Success (0-100)**: Did the game load properly?
   - 90-100: Game fully loaded, all assets visible
   - 70-89: Game loaded with minor visual issues
   - 40-69: Game partially loaded, major assets missing
   - 0-39: Game failed to load or blank screen

2. **Responsiveness (0-100)**: Do controls respond to input?
   - 90-100: All inputs trigger immediate visual feedback
   - 70-89: Most inputs work, slight delay acceptable
   - 40-69: Some inputs work, others unresponsive
   - 0-39: No inputs work or major input failures

3. **Stability (0-100)**: Did the game run without crashes or errors?
   - 90-100: No errors, smooth gameplay throughout
   - 70-89: Minor errors that don't affect gameplay
   - 40-69: Significant errors but game still playable
   - 0-39: Crashes, freezes, or game-breaking errors

4. **Overall Playability (0-100)**: Can users actually play this game?
   - 90-100: Production-ready, excellent user experience
   - 70-89: Playable with minor issues
   - 40-69: Playable but significant UX problems
   - 0-39: Not playable, critical issues

**Evidence Available:**
- Screenshots: {screenshotCount} images showing game state progression
- Console Logs: {consoleLogs}
- Action Logs: {actionLogs}
- Error Logs: {errorLogs}

**Analysis Guidelines:**
- Examine screenshots for visual feedback, state changes, and UI elements
- Review console logs for JavaScript errors, warnings, or crashes
- Analyze action logs to verify inputs were attempted
- Consider error logs for critical failures
- Be objective and evidence-based in your assessment
- Provide specific examples from the evidence to support your scores

**Response Format:**
Return a JSON object with the following structure:
{
  "scores": {
    "loadSuccess": <number 0-100>,
    "responsiveness": <number 0-100>,
    "stability": <number 0-100>,
    "overallPlayability": <number 0-100>
  },
  "reasoning": "<detailed explanation of your assessment, citing specific evidence>",
  "confidence": <number 0-100, how confident are you in this evaluation>
}

**Important:**
- Scores must be integers between 0 and 100
- Confidence should reflect the quality and quantity of evidence
- Reasoning should cite specific observations from screenshots and logs
- Be conservative with high scores (90+) - only for truly excellent games
- Overall playability should be a weighted assessment, not just an average`;

/**
 * Issue detection prompt template.
 *
 * This prompt guides GPT-4o to identify specific issues from game evidence,
 * categorize them by severity and type, and link them to supporting evidence.
 *
 * **Severity Levels:**
 * - critical: Game-breaking issues that prevent play
 * - major: Significant problems that degrade experience
 * - minor: Small issues that don't significantly impact play
 *
 * **Issue Types:**
 * - performance: Slow loading, lag, frame drops
 * - stability: Crashes, freezes, errors
 * - usability: Confusing UI, poor controls, accessibility
 * - compatibility: Browser-specific issues, missing features
 */
export const ISSUE_DETECTION_PROMPT = `You are a QA engineer analyzing test results to identify specific issues in a browser game.

Based on the playability scores and evidence, identify all observable issues with the game.

**Categorization:**

**Severity Levels:**
- critical: Game-breaking issues that prevent play (crashes, failed loads, no input response)
- major: Significant problems that degrade experience (frequent errors, poor responsiveness, visual glitches)
- minor: Small issues that don't significantly impact play (console warnings, minor visual inconsistencies)

**Issue Types:**
- performance: Slow loading, lag, frame drops, optimization problems
- stability: Crashes, freezes, errors, unexpected behavior
- usability: Confusing UI, poor controls, accessibility issues, unclear objectives
- compatibility: Browser-specific issues, missing features, API problems

**Guidelines:**
- Only report issues you can directly observe in the evidence
- Link each issue to a specific screenshot if possible
- Be specific and actionable in descriptions
- Prioritize critical and major issues
- Don't speculate about issues not visible in evidence

**Response Format:**
Return a JSON array of issue objects:
[
  {
    "severity": "critical" | "major" | "minor",
    "category": "performance" | "stability" | "usability" | "compatibility",
    "description": "<specific, actionable description>",
    "screenshot": "<path to supporting screenshot, or null if not applicable>"
  }
]

**Examples:**
- Critical/Stability: "Game crashed on load - blank white screen visible in screenshot 00-initial-load.png"
- Major/Responsiveness: "Arrow key inputs not triggering player movement - no visual change between screenshots 02 and 03"
- Minor/Usability: "No visible start button or instructions - users may not know how to begin"

Be thorough but evidence-based. Do not invent issues that aren't clearly visible in the provided evidence.`;

/**
 * Builds a complete evaluation prompt with context-specific details.
 *
 * Takes evaluation context and generates a customized prompt with specific
 * evidence availability information filled in.
 *
 * @param context - Evaluation context with evidence availability
 * @returns Complete prompt string ready for GPT-4o
 *
 * @example
 * ```typescript
 * const prompt = buildEvaluationPrompt({
 *   screenshotCount: 5,
 *   hasConsoleLogs: true,
 *   hasActionLogs: true,
 *   hasErrors: true,
 *   consoleSummary: "3 errors, 5 warnings",
 *   actionSummary: "Clicked start, pressed arrow keys"
 * });
 * ```
 */
export function buildEvaluationPrompt(context: EvaluationContext): string {
  const consoleLogs = context.hasConsoleLogs
    ? `Available${context.consoleSummary ? ` - ${context.consoleSummary}` : ""}`
    : "Not available";

  const actionLogs = context.hasActionLogs
    ? `Available${context.actionSummary ? ` - ${context.actionSummary}` : ""}`
    : "Not available";

  const errorLogs = context.hasErrors ? "Available - errors detected" : "None";

  return PLAYABILITY_EVALUATION_PROMPT.replace(
    "{screenshotCount}",
    String(context.screenshotCount),
  )
    .replace("{consoleLogs}", consoleLogs)
    .replace("{actionLogs}", actionLogs)
    .replace("{errorLogs}", errorLogs);
}

/**
 * Builds an issue detection prompt with score context.
 *
 * @param scores - Playability scores to provide context
 * @returns Complete issue detection prompt
 *
 * @example
 * ```typescript
 * const prompt = buildIssueDetectionPrompt({
 *   loadSuccess: 50,
 *   responsiveness: 40,
 *   stability: 30,
 *   overallPlayability: 40
 * });
 * ```
 */
export function buildIssueDetectionPrompt(scores: {
  loadSuccess: number;
  responsiveness: number;
  stability: number;
  overallPlayability: number;
}): string {
  const scoreContext = `
**Playability Scores:**
- Load Success: ${scores.loadSuccess}/100
- Responsiveness: ${scores.responsiveness}/100
- Stability: ${scores.stability}/100
- Overall Playability: ${scores.overallPlayability}/100

${scores.loadSuccess < 50 ? "⚠️ Low load success suggests initialization problems\n" : ""}${scores.responsiveness < 50 ? "⚠️ Low responsiveness suggests input/control issues\n" : ""}${scores.stability < 50 ? "⚠️ Low stability suggests crashes or errors\n" : ""}${scores.overallPlayability < 50 ? "⚠️ Low overall playability indicates critical problems\n" : ""}`;

  return `${scoreContext}\n\n${ISSUE_DETECTION_PROMPT}`;
}
