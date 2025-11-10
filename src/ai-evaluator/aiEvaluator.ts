/**
 * AI Evaluator for analyzing game playability using GPT-4o vision capabilities.
 *
 * This module uses the Vercel AI SDK with OpenAI provider to evaluate game quality
 * by analyzing screenshots, logs, and other evidence collected during testing.
 *
 * @module aiEvaluator
 *
 * @example
 * ```typescript
 * import { AIEvaluator } from '@/ai-evaluator/aiEvaluator';
 * import type { EvidenceCollection } from '@/evidence-store/evidenceStore';
 *
 * const evaluator = new AIEvaluator();
 * const evidence: EvidenceCollection = await store.getAllEvidence();
 * const result = await evaluator.evaluatePlayability(evidence);
 *
 * console.log(result.scores.overallPlayability); // 85
 * console.log(result.issues); // Array of detected issues
 * ```
 */

import { readFile } from "node:fs/promises";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { RetryableError } from "@/errors/retryableError";
import type { EvidenceCollection } from "@/evidence-store/evidenceStore";
import type { Issue, PlayabilityScores } from "@/types";
import { config } from "@/utils/config";
import { logger } from "@/utils/logger";
import { retry } from "@/utils/retry";
import {
  buildEvaluationPrompt,
  buildIssueDetectionPrompt,
  type EvaluationContext,
} from "./prompts";

const log = logger.child({ component: "AIEvaluator" });

/**
 * Result of AI playability evaluation.
 */
export interface EvaluationResult {
  /** Playability scores across dimensions (0-100) */
  scores: PlayabilityScores;
  /** Explanation of the evaluation */
  reasoning: string;
  /** Confidence in the evaluation (0-100) */
  confidence: number;
  /** Detected issues with severity and categorization */
  issues: Issue[];
}

/**
 * AI Evaluator for game playability assessment.
 *
 * Uses GPT-4o vision capabilities to analyze screenshots and logs, generating
 * structured playability scores and issue reports. Designed to meet the 80%+
 * accuracy target from PRD requirements.
 *
 * **Features:**
 * - Vision-based screenshot analysis using GPT-4o
 * - Structured evaluation with confidence scores
 * - Issue detection and categorization
 * - Retry logic for API failures
 * - Comprehensive logging for debugging
 *
 * @example
 * ```typescript
 * const evaluator = new AIEvaluator();
 *
 * // Evaluate game playability from evidence
 * const result = await evaluator.evaluatePlayability(evidence);
 *
 * if (result.confidence > 80) {
 *   console.log(`Overall score: ${result.scores.overallPlayability}/100`);
 * }
 * ```
 */
export class AIEvaluator {
  /** OpenAI provider instance configured for GPT-5 mini */
  private readonly openai;

  /** Model identifier for evaluation (GPT-5 mini for speed and cost efficiency) */
  private readonly model = "gpt-5-mini";

  /**
   * Creates a new AI Evaluator instance.
   *
   * Initializes the OpenAI provider using the API key from centralized config.
   * Uses GPT-5 mini model for fast, cost-efficient evaluation.
   *
   * @throws {ValidationError} If OPENAI_API_KEY is not configured
   *
   * @example
   * ```typescript
   * const evaluator = new AIEvaluator();
   * ```
   */
  constructor() {
    // Initialize OpenAI provider with API key from config
    this.openai = createOpenAI({
      apiKey: config.openai.apiKey,
    });

    log.info(
      {
        model: this.model,
      },
      "AIEvaluator initialized",
    );
  }

  /**
   * Evaluates game playability from collected evidence.
   *
   * Analyzes screenshots, console logs, action logs, and error logs to generate
   * comprehensive playability scores and issue reports. Uses GPT-4o for vision
   * analysis with retry logic for API failures.
   *
   * **Evaluation Dimensions:**
   * - Load Success (0-100): Game initialization and asset loading
   * - Responsiveness (0-100): Control response and visual feedback
   * - Stability (0-100): Crashes, errors, and freezes
   * - Overall Playability (0-100): Weighted average of above
   *
   * @param evidence - Complete evidence collection from test execution
   * @returns Evaluation result with scores, reasoning, confidence, and issues
   * @throws {RetryableError} If API call fails after retries
   *
   * @example
   * ```typescript
   * const evidence = await store.getAllEvidence();
   * const result = await evaluator.evaluatePlayability(evidence);
   *
   * console.log(`Load: ${result.scores.loadSuccess}`);
   * console.log(`Responsiveness: ${result.scores.responsiveness}`);
   * console.log(`Stability: ${result.scores.stability}`);
   * console.log(`Overall: ${result.scores.overallPlayability}`);
   * console.log(`Confidence: ${result.confidence}%`);
   * ```
   */
  async evaluatePlayability(
    evidence: EvidenceCollection,
  ): Promise<EvaluationResult> {
    log.info(
      {
        screenshotCount: evidence.screenshots.length,
        hasConsoleLogs: evidence.logs.console !== null,
        hasActionLogs: evidence.logs.actions !== null,
        hasErrorLogs: evidence.logs.errors !== null,
      },
      "Starting playability evaluation",
    );

    try {
      // Use retry logic for API calls (handles transient failures)
      const result = await retry(async () => this.performEvaluation(evidence), {
        maxRetries: 3,
        initialDelay: 1000,
        shouldRetry: (error) =>
          error instanceof RetryableError ||
          error.message.includes("rate_limit") ||
          error.message.includes("timeout"),
      });

      log.info(
        {
          overallScore: result.scores.overallPlayability,
          confidence: result.confidence,
          issueCount: result.issues.length,
        },
        "Playability evaluation completed",
      );

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        {
          error: err.message,
          stack: err.stack,
        },
        "Failed to evaluate playability",
      );
      throw new RetryableError(
        `Playability evaluation failed: ${err.message}`,
        err,
      );
    }
  }

  /**
   * Performs the actual AI evaluation using GPT-4o.
   *
   * @private
   * @param evidence - Evidence collection to evaluate
   * @returns Evaluation result
   */
  private async performEvaluation(
    evidence: EvidenceCollection,
  ): Promise<EvaluationResult> {
    log.debug("Starting AI evaluation with GPT-4o");

    // Step 1: Read and summarize log files
    const logSummaries = await this.readLogFiles(evidence);

    // Step 2: Build evaluation context
    const context: EvaluationContext = {
      screenshotCount: evidence.screenshots.length,
      hasConsoleLogs: evidence.logs.console !== null,
      hasActionLogs: evidence.logs.actions !== null,
      hasErrors: evidence.logs.errors !== null,
      consoleSummary: logSummaries.consoleSummary,
      actionSummary: logSummaries.actionSummary,
    };

    // Step 3: Build prompt with context
    const promptText = buildEvaluationPrompt(context);

    // Step 4: Prepare screenshot images for vision analysis
    const screenshotData = await this.prepareScreenshots(evidence.screenshots);

    // Step 5: Define response schema using Zod
    const evaluationSchema = z.object({
      scores: z.object({
        loadSuccess: z.number().min(0).max(100),
        responsiveness: z.number().min(0).max(100),
        stability: z.number().min(0).max(100),
        overallPlayability: z.number().min(0).max(100),
      }),
      reasoning: z.string(),
      confidence: z.number().min(0).max(100),
    });

    try {
      log.debug(
        {
          model: this.model,
          screenshotCount: screenshotData.length,
          promptLength: promptText.length,
        },
        "Calling GPT-4o for evaluation",
      );

      // Step 6: Call GPT-4o with vision using generateObject
      const result = await generateObject({
        model: this.openai(this.model),
        schema: evaluationSchema,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: promptText,
              },
              ...screenshotData,
            ],
          },
        ],
      });

      log.debug(
        {
          overallScore: result.object.scores.overallPlayability,
          confidence: result.object.confidence,
        },
        "GPT-4o evaluation completed",
      );

      // Step 7: Detect issues based on scores and evidence
      const issues = await this.detectIssues(evidence, result.object.scores);

      // Step 8: Return complete evaluation result
      return {
        scores: result.object.scores,
        reasoning: result.object.reasoning,
        confidence: result.object.confidence,
        issues,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        {
          error: err.message,
          stack: err.stack,
        },
        "GPT-4o evaluation failed",
      );
      throw new RetryableError(`AI evaluation failed: ${err.message}`, err);
    }
  }

  /**
   * Reads and summarizes log files for evaluation context.
   *
   * @private
   * @param evidence - Evidence collection
   * @returns Log summaries
   */
  private async readLogFiles(evidence: EvidenceCollection): Promise<{
    consoleSummary?: string;
    actionSummary?: string;
  }> {
    const summaries: {
      consoleSummary?: string;
      actionSummary?: string;
    } = {};

    try {
      // Read console logs if available
      if (evidence.logs.console) {
        const consoleContent = await readFile(evidence.logs.console, "utf-8");
        const lines = consoleContent.split("\n").filter((line) => line.trim());
        const errorCount = lines.filter((line) =>
          line.includes("[ERROR]"),
        ).length;
        const warningCount = lines.filter((line) =>
          line.includes("[WARN]"),
        ).length;

        summaries.consoleSummary = `${errorCount} errors, ${warningCount} warnings, ${lines.length} total entries`;
        log.debug(
          { consoleSummary: summaries.consoleSummary },
          "Console logs summarized",
        );
      }

      // Read action logs if available
      if (evidence.logs.actions) {
        const actionContent = await readFile(evidence.logs.actions, "utf-8");
        const lines = actionContent.split("\n").filter((line) => line.trim());
        // Extract action types for summary
        const actions = lines
          .map((line) => {
            const match = line.match(/\[ACTION\] (.+?):/);
            return match ? match[1] : null;
          })
          .filter(Boolean);

        summaries.actionSummary = `${actions.length} actions: ${actions.slice(0, 5).join(", ")}${actions.length > 5 ? "..." : ""}`;
        log.debug(
          { actionSummary: summaries.actionSummary },
          "Action logs summarized",
        );
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.warn(
        {
          error: err.message,
        },
        "Failed to read log files, continuing without summaries",
      );
      // Continue without summaries - not critical for evaluation
    }

    return summaries;
  }

  /**
   * Prepares screenshot images for GPT-4o vision analysis.
   *
   * Reads screenshot files and converts them to base64 data URLs
   * for inclusion in the API request.
   *
   * @private
   * @param screenshotPaths - Array of screenshot file paths
   * @returns Array of image content objects for the API
   */
  private async prepareScreenshots(
    screenshotPaths: string[],
  ): Promise<Array<{ type: "image"; image: string }>> {
    const screenshotData: Array<{ type: "image"; image: string }> = [];

    // Limit to first 10 screenshots to avoid token limits
    const pathsToUse = screenshotPaths.slice(0, 10);

    for (const path of pathsToUse) {
      try {
        const imageBuffer = await readFile(path);
        const base64Image = imageBuffer.toString("base64");
        const dataUrl = `data:image/png;base64,${base64Image}`;

        screenshotData.push({
          type: "image",
          image: dataUrl,
        });

        log.debug(
          { path, size: imageBuffer.length },
          "Screenshot prepared for vision analysis",
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        log.warn(
          {
            path,
            error: err.message,
          },
          "Failed to read screenshot, skipping",
        );
        // Continue with other screenshots
      }
    }

    log.debug(
      {
        total: screenshotPaths.length,
        prepared: screenshotData.length,
      },
      "Screenshots prepared",
    );

    return screenshotData;
  }

  /**
   * Detects and categorizes issues from evidence and scores.
   *
   * Analyzes evaluation results to identify specific problems, categorize them
   * by severity (critical/major/minor) and type (performance/stability/usability/compatibility),
   * and link them to supporting screenshot evidence.
   *
   * @param evidence - Evidence collection from test execution
   * @param scores - Playability scores from evaluation
   * @returns Array of detected issues with categorization
   *
   * @example
   * ```typescript
   * const issues = await evaluator.detectIssues(evidence, scores);
   *
   * for (const issue of issues) {
   *   console.log(`[${issue.severity}] ${issue.description}`);
   *   if (issue.screenshot) {
   *     console.log(`Evidence: ${issue.screenshot}`);
   *   }
   * }
   * ```
   */
  async detectIssues(
    evidence: EvidenceCollection,
    scores: PlayabilityScores,
  ): Promise<Issue[]> {
    log.info(
      {
        screenshotCount: evidence.screenshots.length,
        loadSuccess: scores.loadSuccess,
        responsiveness: scores.responsiveness,
        stability: scores.stability,
      },
      "Starting issue detection",
    );

    try {
      // Use retry logic for API calls
      const issues = await retry(
        async () => this.performIssueDetection(evidence, scores),
        {
          maxRetries: 3,
          initialDelay: 1000,
          shouldRetry: (error) =>
            error instanceof RetryableError ||
            error.message.includes("rate_limit") ||
            error.message.includes("timeout"),
        },
      );

      log.info(
        {
          issueCount: issues.length,
          criticalCount: issues.filter((i) => i.severity === "critical").length,
          majorCount: issues.filter((i) => i.severity === "major").length,
          minorCount: issues.filter((i) => i.severity === "minor").length,
        },
        "Issue detection completed",
      );

      return issues;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        {
          error: err.message,
          stack: err.stack,
        },
        "Failed to detect issues",
      );
      // Return empty array on error - not critical for overall evaluation
      return [];
    }
  }

  /**
   * Performs the actual issue detection using GPT-4o.
   *
   * @private
   * @param evidence - Evidence collection
   * @param scores - Playability scores
   * @returns Array of detected issues
   */
  private async performIssueDetection(
    evidence: EvidenceCollection,
    scores: PlayabilityScores,
  ): Promise<Issue[]> {
    log.debug("Starting AI issue detection with GPT-4o");

    // Step 1: Build issue detection prompt with score context
    const promptText = buildIssueDetectionPrompt(scores);

    // Step 2: Prepare screenshot images for vision analysis
    const screenshotData = await this.prepareScreenshots(evidence.screenshots);

    // Step 3: Read error logs for additional context
    const errorContext = await this.readErrorLogs(evidence);

    // Step 4: Build full context message
    const contextText = `
**Error Log Summary:**
${errorContext || "No errors logged"}

**Screenshot Evidence:**
${evidence.screenshots.length} screenshots available for analysis.
		`;

    // Step 5: Define response schema for issues
    const issueSchema = z.object({
      issues: z.array(
        z.object({
          severity: z.enum(["critical", "major", "minor"]),
          category: z.string(),
          description: z.string(),
          screenshot: z.string().nullable(),
        }),
      ),
    });

    try {
      log.debug(
        {
          model: this.model,
          screenshotCount: screenshotData.length,
          promptLength: promptText.length,
        },
        "Calling GPT-4o for issue detection",
      );

      // Step 6: Call GPT-4o with vision using generateObject
      const result = await generateObject({
        model: this.openai(this.model),
        schema: issueSchema,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${promptText}\n\n${contextText}`,
              },
              ...screenshotData,
            ],
          },
        ],
      });

      log.debug(
        {
          issueCount: result.object.issues.length,
        },
        "GPT-4o issue detection completed",
      );

      // Step 7: Map screenshot paths to actual evidence
      const mappedIssues: Issue[] = result.object.issues.map((issue) => ({
        severity: issue.severity,
        category: issue.category,
        description: issue.description,
        screenshot: issue.screenshot
          ? this.findScreenshotPath(issue.screenshot, evidence.screenshots)
          : undefined,
      }));

      return mappedIssues;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        {
          error: err.message,
          stack: err.stack,
        },
        "GPT-4o issue detection failed",
      );
      throw new RetryableError(
        `AI issue detection failed: ${err.message}`,
        err,
      );
    }
  }

  /**
   * Reads and summarizes error logs for issue detection context.
   *
   * @private
   * @param evidence - Evidence collection
   * @returns Error summary string or null
   */
  private async readErrorLogs(
    evidence: EvidenceCollection,
  ): Promise<string | null> {
    try {
      if (evidence.logs.errors) {
        const errorContent = await readFile(evidence.logs.errors, "utf-8");
        const lines = errorContent.split("\n").filter((line) => line.trim());

        if (lines.length === 0) {
          return "No errors detected";
        }

        // Return first 10 error lines for context
        const errorSummary = lines.slice(0, 10).join("\n");
        log.debug(
          { errorLineCount: lines.length },
          "Error logs read for issue detection",
        );
        return errorSummary;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.warn(
        {
          error: err.message,
        },
        "Failed to read error logs for issue detection",
      );
    }

    return null;
  }

  /**
   * Finds the actual screenshot path from a partial reference.
   *
   * GPT-4o may reference screenshots by name or partial path.
   * This method maps those references to actual file paths.
   *
   * @private
   * @param reference - Screenshot reference from AI (e.g., "00-initial-load.png")
   * @param screenshots - Array of actual screenshot paths
   * @returns Matching screenshot path or undefined
   */
  private findScreenshotPath(
    reference: string,
    screenshots: string[],
  ): string | undefined {
    // Try exact match first
    const exactMatch = screenshots.find((path) => path.includes(reference));
    if (exactMatch) {
      return exactMatch;
    }

    // Try to extract filename from reference and match
    const filename = reference.split("/").pop();
    if (filename) {
      const filenameMatch = screenshots.find((path) => path.endsWith(filename));
      if (filenameMatch) {
        return filenameMatch;
      }
    }

    // No match found
    log.debug(
      { reference },
      "Could not map screenshot reference to actual path",
    );
    return undefined;
  }

  /**
   * Gets the model identifier being used for evaluation.
   *
   * @returns Model name (e.g., "gpt-5-mini")
   */
  getModel(): string {
    return this.model;
  }
}
