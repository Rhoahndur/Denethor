/**
 * Basic Usage Example
 *
 * This example demonstrates the simplest way to use Denethor.
 * It uses the runQATest() wrapper function for easy testing.
 *
 * Prerequisites:
 * - .env file configured with API keys
 * - Game URL to test
 *
 * Run with: bun run examples/basic-usage.ts
 */

import { runQATest } from "../src/api/index";

async function main() {
  // Example 1: Simple test with default options
  console.log("Example 1: Basic test");
  console.log("=".repeat(60));

  try {
    const results = await runQATest("https://example.com/game");

    // Access playability scores
    const { scores } = results.report;
    console.log(`\nPlayability Scores:`);
    console.log(`  Load Success:     ${scores.loadSuccess}/100`);
    console.log(`  Responsiveness:   ${scores.responsiveness}/100`);
    console.log(`  Stability:        ${scores.stability}/100`);
    console.log(`  Overall:          ${scores.overallPlayability}/100`);

    // Check status
    console.log(`\nTest Status: ${results.report.status.toUpperCase()}`);
    console.log(`Issues Found: ${results.report.issues.length}`);

    // View generated reports
    console.log(`\nReports Generated:`);
    console.log(`  HTML:     ${results.reportPaths.html}`);
    console.log(`  JSON:     ${results.reportPaths.json}`);
    console.log(`  Markdown: ${results.reportPaths.markdown}`);
  } catch (error) {
    console.error("Test failed:", error);
  }

  console.log(`\n${"=".repeat(60)}\n`);

  // Example 2: Test with custom options
  console.log("Example 2: Test with custom options");
  console.log("=".repeat(60));

  try {
    const results = await runQATest("https://example.com/game", {
      outputDir: "./custom-results", // Custom output directory
      maxActions: 10, // Fewer actions for faster test
      sessionTimeout: 120000, // 2 minute timeout
    });

    // Simple pass/fail logic
    const passed = results.report.scores.overallPlayability >= 70;
    console.log(`\nTest Result: ${passed ? "PASSED" : "FAILED"}`);
    console.log(`Score: ${results.report.scores.overallPlayability}/100`);

    if (!passed) {
      console.log("\nCritical Issues:");
      const criticalIssues = results.report.issues.filter(
        (i) => i.severity === "critical",
      );
      for (const issue of criticalIssues) {
        console.log(`  - ${issue.description}`);
      }
    }
  } catch (error) {
    console.error("Test failed:", error);
  }

  console.log(`\n${"=".repeat(60)}\n`);

  // Example 3: Processing multiple games
  console.log("Example 3: Testing multiple games");
  console.log("=".repeat(60));

  const games = [
    "https://example.com/game1",
    "https://example.com/game2",
    "https://example.com/game3",
  ];

  const results: Array<{ url: string; score: number; status: string }> = [];

  for (const gameUrl of games) {
    try {
      console.log(`\nTesting ${gameUrl}...`);
      const testResults = await runQATest(gameUrl, {
        maxActions: 10, // Quick tests for batch processing
        sessionTimeout: 60000,
      });

      results.push({
        url: gameUrl,
        score: testResults.report.scores.overallPlayability,
        status: testResults.report.status,
      });

      console.log(
        `  Score: ${testResults.report.scores.overallPlayability}/100`,
      );
      console.log(`  Status: ${testResults.report.status}`);
    } catch (error) {
      console.error(
        `  Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      results.push({
        url: gameUrl,
        score: 0,
        status: "error",
      });
    }
  }

  // Summary
  console.log(`\n${"-".repeat(60)}`);
  console.log("Batch Test Summary:");
  console.log("-".repeat(60));

  for (const result of results) {
    console.log(
      `${result.url}: ${result.score}/100 (${result.status.toUpperCase()})`,
    );
  }

  const avgScore =
    results.reduce((sum, r) => sum + r.score, 0) / results.length;
  console.log(`\nAverage Score: ${avgScore.toFixed(1)}/100`);

  console.log(`\n${"=".repeat(60)}`);
}

// Run examples
main().catch(console.error);
