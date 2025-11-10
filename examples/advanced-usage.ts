/**
 * Advanced Usage Example
 *
 * This example demonstrates advanced usage of Denethor using
 * the QAOrchestrator class for more control over test execution.
 *
 * Prerequisites:
 * - .env file configured with API keys
 * - Game URL to test
 *
 * Run with: bun run examples/advanced-usage.ts
 */

import type { QATestResult } from "../src/api/index";
import {
  GameCrashError,
  QAOrchestrator,
  RetryableError,
  ValidationError,
} from "../src/api/index";

async function main() {
  // Example 1: Using QAOrchestrator class
  console.log("Example 1: QAOrchestrator with custom configuration");
  console.log("=".repeat(60));

  try {
    const orchestrator = new QAOrchestrator({
      gameUrl: "https://example.com/game",
      maxActions: 15,
      sessionTimeout: 90000, // 90 seconds
      outputDir: "./advanced-results",
    });

    console.log("Running test with orchestrator...");
    const results = await orchestrator.runTest();

    // Access detailed results
    console.log(`\nTest Metadata:`);
    console.log(`  Test ID: ${results.report.meta.testId}`);
    console.log(`  Duration: ${results.report.meta.duration} seconds`);
    console.log(`  Actions: ${results.report.actions.length}`);

    // Detailed score analysis
    console.log(`\nDetailed Scores:`);
    const { scores } = results.report;
    console.log(`  Load Success:     ${scores.loadSuccess}/100`);
    console.log(`  Responsiveness:   ${scores.responsiveness}/100`);
    console.log(`  Stability:        ${scores.stability}/100`);
    console.log(`  Overall:          ${scores.overallPlayability}/100`);

    // AI evaluation details
    console.log(`\nAI Evaluation:`);
    console.log(`  Confidence: ${results.report.evaluation.confidence}%`);
    console.log(`  Reasoning: ${results.report.evaluation.reasoning}`);

    // Evidence summary
    console.log(`\nEvidence Collected:`);
    console.log(`  Screenshots: ${results.report.evidence.screenshots.length}`);
    console.log(
      `  Console Log: ${results.report.evidence.logs.console ? "Yes" : "No"}`,
    );
    console.log(
      `  Actions Log: ${results.report.evidence.logs.actions ? "Yes" : "No"}`,
    );
  } catch (error) {
    console.error("Test failed:", error);
  }

  console.log(`\n${"=".repeat(60)}\n`);

  // Example 2: Advanced error handling
  console.log("Example 2: Advanced error handling");
  console.log("=".repeat(60));

  async function runTestWithRetry(
    url: string,
    maxRetries = 3,
  ): Promise<QATestResult | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`\nAttempt ${attempt} of ${maxRetries}...`);

        const orchestrator = new QAOrchestrator({
          gameUrl: url,
          maxActions: 10,
          sessionTimeout: 60000,
        });

        const results = await orchestrator.runTest();
        console.log(`Success on attempt ${attempt}!`);
        return results;
      } catch (error) {
        if (error instanceof ValidationError) {
          // Don't retry validation errors
          console.error("Validation error - cannot retry:", error.message);
          return null;
        }

        if (error instanceof GameCrashError) {
          // Game crashed - this is a valid result, not a test failure
          console.warn("Game crashed during test:", error.message);
          console.log("This indicates a bug in the game, not the test system.");
          return null;
        }

        if (error instanceof RetryableError) {
          if (attempt < maxRetries) {
            const delay = 2000 * attempt; // Exponential backoff
            console.log(`Retryable error occurred: ${error.message}`);
            console.log(`Waiting ${delay}ms before retry...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          console.error(
            "Max retries reached for retryable error:",
            error.message,
          );
          return null;
        }

        // Unknown error
        console.error(`Unknown error on attempt ${attempt}:`, error);
        if (attempt === maxRetries) {
          return null;
        }
      }
    }
    return null;
  }

  const result = await runTestWithRetry("https://example.com/game");
  if (result) {
    console.log(
      `\nFinal score: ${result.report.scores.overallPlayability}/100`,
    );
  }

  console.log(`\n${"=".repeat(60)}\n`);

  // Example 3: Custom result processing and reporting
  console.log("Example 3: Custom result processing");
  console.log("=".repeat(60));

  try {
    const orchestrator = new QAOrchestrator({
      gameUrl: "https://example.com/game",
      maxActions: 20,
    });

    const results = await orchestrator.runTest();
    const { report } = results;

    // Categorize game quality
    let category: string;
    let recommendation: string;

    const score = report.scores.overallPlayability;
    if (score >= 90) {
      category = "Excellent";
      recommendation = "Ready for production deployment";
    } else if (score >= 70) {
      category = "Good";
      recommendation = "Minor improvements recommended before release";
    } else if (score >= 50) {
      category = "Fair";
      recommendation = "Significant improvements needed";
    } else {
      category = "Poor";
      recommendation = "Major rework required - not ready for release";
    }

    console.log(`\nQuality Assessment:`);
    console.log(`  Category: ${category}`);
    console.log(`  Score: ${score}/100`);
    console.log(`  Recommendation: ${recommendation}`);

    // Analyze issue distribution
    const issuesBySeverity = {
      critical: report.issues.filter((i) => i.severity === "critical").length,
      major: report.issues.filter((i) => i.severity === "major").length,
      minor: report.issues.filter((i) => i.severity === "minor").length,
    };

    console.log(`\nIssue Distribution:`);
    console.log(`  Critical: ${issuesBySeverity.critical}`);
    console.log(`  Major: ${issuesBySeverity.major}`);
    console.log(`  Minor: ${issuesBySeverity.minor}`);
    console.log(`  Total: ${report.issues.length}`);

    // List top priority issues
    if (issuesBySeverity.critical > 0) {
      console.log(`\nTop Priority Issues (Critical):`);
      const critical = report.issues.filter((i) => i.severity === "critical");
      for (let i = 0; i < Math.min(3, critical.length); i++) {
        console.log(`  ${i + 1}. ${critical[i].description}`);
      }
    }

    // Action summary
    const successfulActions = report.actions.filter((a) => a.success).length;
    console.log(`\nAction Summary:`);
    console.log(`  Total Actions: ${report.actions.length}`);
    console.log(`  Successful: ${successfulActions}`);
    console.log(`  Failed: ${report.actions.length - successfulActions}`);

    // Performance metrics
    console.log(`\nPerformance:`);
    console.log(`  Duration: ${report.meta.duration} seconds`);
    console.log(
      `  Actions per second: ${(report.actions.length / report.meta.duration).toFixed(2)}`,
    );
  } catch (error) {
    console.error("Test failed:", error);
  }

  console.log(`\n${"=".repeat(60)}`);
}

// Run examples
main().catch(console.error);
