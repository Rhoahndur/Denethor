/**
 * AWS Lambda Handler for Denethor.
 *
 * This module provides an AWS Lambda handler function for running QA tests
 * in a serverless environment. It accepts game URLs via Lambda events and
 * returns structured test results.
 *
 * @module lambda/handler
 *
 * @example
 * Lambda invocation event format:
 * ```json
 * {
 *   "body": "{\"gameUrl\":\"https://example.com/game\",\"maxActions\":15}"
 * }
 * ```
 *
 * Lambda response format:
 * ```json
 * {
 *   "statusCode": 200,
 *   "headers": { "Content-Type": "application/json" },
 *   "body": "{\"testId\":\"...\",\"scores\":{...},\"reportPaths\":{...}}"
 * }
 * ```
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { runQATest } from "@/api/index";
import { GameCrashError } from "@/errors/gameCrashError";
import { ValidationError } from "@/errors/validationError";
import { logger } from "@/utils/logger";
import { S3Uploader } from "@/utils/s3-uploader";

const log = logger.child({ component: "LambdaHandler" });

/**
 * Lambda event body structure.
 */
interface LambdaEventBody {
  /** URL of the game to test */
  gameUrl: string;
  /** Optional output directory (default: /tmp for Lambda) */
  outputDir?: string;
  /** Optional maximum actions (default: 20) */
  maxActions?: number;
  /** Optional session timeout in ms (default: 280000 = 4m 40s, leaving 20s buffer) */
  sessionTimeout?: number;
  /**
   * Optional hint about game input controls to guide testing strategy.
   * @example "Arrow keys for movement, spacebar to jump"
   */
  inputHint?: string;
}

/**
 * Lambda response body structure.
 */
interface LambdaResponseBody {
  /** Test ID */
  testId: string;
  /** Game URL that was tested */
  gameUrl: string;
  /** Test status */
  status: string;
  /** Playability scores */
  scores: {
    loadSuccess: number;
    responsiveness: number;
    stability: number;
    overallPlayability: number;
  };
  /** Evaluation reasoning */
  reasoning: string;
  /** Confidence in evaluation */
  confidence: number;
  /** Issues detected */
  issues: Array<{
    severity: string;
    category: string;
    description: string;
  }>;
  /** Report file paths (local paths in /tmp) */
  reportPaths: {
    json: string;
    markdown: string;
    html: string;
  };
  /** S3 report URLs (publicly accessible) */
  s3Reports: {
    json: string;
    markdown: string;
    html: string;
  };
  /** Test duration in seconds */
  duration: number;
}

/**
 * Error response body structure.
 */
interface ErrorResponseBody {
  /** Error message */
  error: string;
  /** Error type/name */
  type: string;
  /** Additional error details */
  details?: string;
}

/**
 * AWS Lambda handler function.
 *
 * This function processes Lambda events to run QA tests on browser games.
 * It uses the /tmp directory for Lambda's ephemeral storage and includes
 * a timeout buffer to ensure graceful completion within Lambda limits.
 *
 * **Lambda Configuration Requirements:**
 * - Runtime: Node.js 20
 * - Memory: 2048 MB (for browser automation)
 * - Timeout: 5 minutes (300 seconds max)
 * - Environment Variables:
 *   - BROWSERBASE_API_KEY: Browserbase API key
 *   - BROWSERBASE_PROJECT_ID: Browserbase project ID
 *   - OPENAI_API_KEY: OpenAI API key
 *   - LOG_LEVEL: (optional) debug, info, warn, error
 *
 * @param event - Lambda event from API Gateway
 * @param context - Lambda context object
 * @returns Promise resolving to API Gateway proxy result
 *
 * @example
 * ```typescript
 * // Lambda invocation
 * const event = {
 *   body: JSON.stringify({
 *     gameUrl: 'https://example.com/game',
 *     maxActions: 15
 *   })
 * };
 *
 * const result = await handler(event, context);
 * console.log(result.statusCode); // 200
 * ```
 */
export async function handler(
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> {
  log.info(
    {
      requestId: context.awsRequestId,
      functionName: context.functionName,
    },
    "Lambda handler invoked",
  );

  try {
    // Parse event body
    if (!event.body) {
      log.error({ requestId: context.awsRequestId }, "No event body provided");
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Request body is required",
          type: "ValidationError",
        } satisfies ErrorResponseBody),
      };
    }

    let eventBody: LambdaEventBody;
    try {
      eventBody = JSON.parse(event.body) as LambdaEventBody;
    } catch (error) {
      log.error(
        {
          requestId: context.awsRequestId,
          error,
        },
        "Failed to parse event body",
      );
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Invalid JSON in request body",
          type: "ParseError",
          details: error instanceof Error ? error.message : "Unknown error",
        } satisfies ErrorResponseBody),
      };
    }

    // Validate required fields
    if (!eventBody.gameUrl) {
      log.error({ requestId: context.awsRequestId }, "gameUrl is required");
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "gameUrl is required in request body",
          type: "ValidationError",
        } satisfies ErrorResponseBody),
      };
    }

    log.info(
      {
        requestId: context.awsRequestId,
        gameUrl: eventBody.gameUrl,
        maxActions: eventBody.maxActions,
      },
      "Starting QA test",
    );

    // Run QA test with Lambda-optimized settings
    const result = await runQATest(eventBody.gameUrl, {
      outputDir: eventBody.outputDir || "/tmp/qa-results", // Use Lambda's /tmp directory
      maxActions: eventBody.maxActions || 20,
      sessionTimeout: eventBody.sessionTimeout || 280000, // 4m 40s (leave 20s buffer for Lambda 5min limit)
      inputHint: eventBody.inputHint,
    });

    log.info(
      {
        requestId: context.awsRequestId,
        testId: result.report.meta.testId,
        status: result.report.status,
        overallPlayability: result.report.scores.overallPlayability,
      },
      "QA test completed successfully",
    );

    // Upload reports to S3
    log.info(
      {
        requestId: context.awsRequestId,
        testId: result.report.meta.testId,
      },
      "Uploading reports to S3",
    );

    const s3Uploader = new S3Uploader();
    const s3Results = await s3Uploader.uploadReports(
      result.report.meta.testId,
      result.reportPaths,
    );

    log.info(
      {
        requestId: context.awsRequestId,
        testId: result.report.meta.testId,
        s3Urls: {
          json: s3Results.json.url,
          markdown: s3Results.markdown.url,
          html: s3Results.html.url,
        },
      },
      "Reports uploaded to S3 successfully",
    );

    // Build response body
    const responseBody: LambdaResponseBody = {
      testId: result.report.meta.testId,
      gameUrl: result.report.meta.gameUrl,
      status: result.report.status,
      scores: result.report.scores,
      reasoning: result.report.evaluation.reasoning,
      confidence: result.report.evaluation.confidence,
      issues: result.report.issues,
      reportPaths: result.reportPaths,
      s3Reports: {
        json: s3Results.json.url,
        markdown: s3Results.markdown.url,
        html: s3Results.html.url,
      },
      duration: result.report.meta.duration,
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(responseBody),
    };
  } catch (error) {
    // Handle errors with appropriate status codes
    log.error(
      {
        requestId: context.awsRequestId,
        error,
      },
      "Lambda handler error",
    );

    if (error instanceof ValidationError) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: error.message,
          type: "ValidationError",
        } satisfies ErrorResponseBody),
      };
    }

    if (error instanceof GameCrashError) {
      return {
        statusCode: 200, // Not a server error - game crashed but test completed
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: error.message,
          type: "GameCrashError",
          details: "Game crashed during testing but results were captured",
        } satisfies ErrorResponseBody),
      };
    }

    // Generic error
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        type: error instanceof Error ? error.name : "Error",
      } satisfies ErrorResponseBody),
    };
  }
}

/**
 * Default export for Lambda deployment.
 */
export default handler;
