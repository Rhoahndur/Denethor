#!/usr/bin/env node

/**
 * Throttled Test Script - Respects Browserbase Free Tier Limits
 *
 * Free tier limits:
 * - 1 concurrent session max
 * - 5 sessions per minute (12 second minimum between sessions)
 *
 * This script adds appropriate delays to stay within bounds
 */

import * as dotenv from "dotenv";
import { QAOrchestrator } from "./src/orchestrator/qaOrchestrator";

dotenv.config();

const DELAY_BETWEEN_SESSIONS = 15000; // 15 seconds to be safe (5 sessions/min = 12s minimum)

async function _delay(ms: number) {
  console.log(`⏱️  Waiting ${ms / 1000} seconds to respect rate limits...`);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runThrottledTest() {
  console.log("🎮 Throttled QA Test - Browserbase Free Tier\n");
  console.log("Rate limits:");
  console.log("  - 1 concurrent session max");
  console.log("  - 5 sessions per minute");
  console.log("  - Adding 15 second delay between attempts\n");

  const gameUrl = "https://js13kgames.com/games/xx142-b2exe/index.html";
  const outputDir = "./throttled-output";

  console.log(`Game URL: ${gameUrl}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Max actions: 3 (reduced for demo)`);
  console.log(`Timeout: 60000ms (1 minute)\n`);

  try {
    console.log("Starting test (with throttling)...\n");

    const orchestrator = new QAOrchestrator({
      gameUrl,
      sessionTimeout: 60000, // Reduced to 1 minute for faster demo
      maxActions: 3, // Reduced actions for faster demo
      outputDir,
    });

    const result = await orchestrator.runTest();
    const report = result.report;

    console.log("\n✅ Test completed successfully!\n");
    console.log("============================================================");
    console.log("  TEST RESULTS");
    console.log(
      "============================================================\n",
    );
    console.log(`Status: ${report.status.toUpperCase()}`);
    console.log(`Overall Playability: ${report.scores.overallPlayability}/100`);
    console.log(`\nScores:`);
    console.log(`  - Load Success: ${report.scores.loadSuccess}/100`);
    console.log(`  - Responsiveness: ${report.scores.responsiveness}/100`);
    console.log(`  - Stability: ${report.scores.stability}/100`);
    console.log(`\nEvaluation: ${report.evaluation.reasoning}`);
    console.log(`Confidence: ${report.evaluation.confidence}%`);

    if (report.issues.length > 0) {
      console.log(`\nIssues found: ${report.issues.length}`);
      report.issues.forEach((issue, i) => {
        console.log(
          `  ${i + 1}. [${issue.severity.toUpperCase()}] ${issue.category}: ${issue.description}`,
        );
      });
    }

    console.log(`\nActions taken: ${report.actions.length}`);
    console.log(`\nEvidence saved to: ${outputDir}`);
    console.log(`Screenshots: ${report.evidence.screenshots.length}`);

    console.log("\n✅ Test complete!");
    console.log(
      `\nTo run another test, wait at least ${DELAY_BETWEEN_SESSIONS / 1000} seconds`,
    );
    console.log("or you may hit rate limits.\n");
  } catch (error) {
    console.error(
      "\n============================================================",
    );
    console.error("  TEST FAILED");
    console.error(
      "============================================================\n",
    );

    if (error instanceof Error) {
      console.error("Error:", error.message);

      if (error.message.includes("429")) {
        console.error("\n⚠️  Rate limit hit! Browserbase free tier limits:");
        console.error("   - 1 concurrent session maximum");
        console.error("   - 5 sessions per minute");
        console.error("\n💡 Suggestions:");
        console.error("   1. Wait 60 seconds for rate limit to reset");
        console.error("   2. Run cleanup script: bun cleanup-sessions.ts");
        console.error(
          "   3. Check if sessions are stuck: https://www.browserbase.com/sessions",
        );
        console.error(
          "   4. Consider upgrading for more concurrent sessions\n",
        );
      }
    } else {
      console.error("Unknown error:", error);
    }

    process.exit(1);
  }
}

// Add delay before starting if this is run multiple times
console.log("🚀 Starting throttled test...");
console.log("⏱️  Adding initial 5 second delay...\n");

setTimeout(() => {
  runThrottledTest();
}, 5000);
