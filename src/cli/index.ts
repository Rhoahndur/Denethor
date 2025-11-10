#!/usr/bin/env bun
/**
 * CLI Entry Point for Denethor.
 *
 * Provides a command-line interface for running QA tests on browser games.
 * Uses Commander.js for argument parsing and command handling.
 *
 * @module cli
 *
 * @example
 * ```bash
 * # Basic usage
 * bun run src/cli/index.ts test https://example.com/game
 *
 * # With options
 * bun run src/cli/index.ts test https://example.com/game --output ./results --timeout 60000
 *
 * # Show version
 * bun run src/cli/index.ts version
 * ```
 */

import { Command } from "commander";
import type { GameType } from "@/browser-agent/browserAgent";
import { GameCrashError } from "@/errors/gameCrashError";
import { ValidationError } from "@/errors/validationError";
import { QAOrchestrator } from "@/orchestrator/qaOrchestrator";
import type { QAReport } from "@/types/qaReport";
import { logger } from "@/utils/logger";

// Package version - in production this would come from package.json
const VERSION = "1.0.0";

const log = logger.child({ component: "CLI" });

/**
 * Command line options for the test command.
 */
interface TestCommandOptions {
  /** Output directory for test results */
  output: string;
  /** Session timeout in milliseconds */
  timeout: string;
  /** Maximum number of actions to execute */
  maxActions: string;
  /** Maximum total test execution time in milliseconds */
  maxDuration: string;
  /** Optional hint about game input controls */
  inputHint?: string;
  /** Manual game type override */
  gameType?: string;
  /** Disable loading warmup phase */
  noWarmup?: boolean;
  /** Number of warmup cycles */
  warmupCycles?: string;
  /** Duration of each warmup cycle in ms */
  warmupDuration?: string;
  /** Interval between warmup clicks in ms */
  warmupInterval?: string;
}

/**
 * Formats duration in seconds to human-readable format.
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 *
 * @example
 * ```typescript
 * formatDuration(65) // => "1m 5s"
 * formatDuration(30) // => "30s"
 * ```
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Prints a formatted results summary to console.
 *
 * @param report - QA Report to summarize
 * @param reportPaths - Paths to generated reports
 */
function printResultsSummary(
  report: QAReport,
  reportPaths: { json: string; markdown: string; html: string },
): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log("  QA TEST RESULTS");
  console.log("=".repeat(60));

  console.log(`\nTest ID: ${report.meta.testId}`);
  console.log(`Game URL: ${report.meta.gameUrl}`);
  console.log(`Duration: ${formatDuration(report.meta.duration)}`);
  console.log(`Status: ${report.status.toUpperCase()}`);

  console.log(`\n${"-".repeat(60)}`);
  console.log("  PLAYABILITY SCORES");
  console.log("-".repeat(60));

  console.log(`Load Success:     ${report.scores.loadSuccess}/100`);
  console.log(`Responsiveness:   ${report.scores.responsiveness}/100`);
  console.log(`Stability:        ${report.scores.stability}/100`);
  console.log(`Overall:          ${report.scores.overallPlayability}/100`);

  console.log(`\nConfidence: ${report.evaluation.confidence}%`);

  if (report.issues.length > 0) {
    console.log(`\n${"-".repeat(60)}`);
    console.log("  ISSUES DETECTED");
    console.log("-".repeat(60));

    const critical = report.issues.filter((i) => i.severity === "critical");
    const major = report.issues.filter((i) => i.severity === "major");
    const minor = report.issues.filter((i) => i.severity === "minor");

    if (critical.length > 0) {
      console.log(`\nCritical (${critical.length}):`);
      for (const issue of critical) {
        console.log(`  - ${issue.description}`);
      }
    }

    if (major.length > 0) {
      console.log(`\nMajor (${major.length}):`);
      for (const issue of major) {
        console.log(`  - ${issue.description}`);
      }
    }

    if (minor.length > 0) {
      console.log(`\nMinor (${minor.length}):`);
      for (const issue of minor) {
        console.log(`  - ${issue.description}`);
      }
    }
  }

  console.log(`\n${"-".repeat(60)}`);
  console.log("  GENERATED REPORTS");
  console.log("-".repeat(60));

  console.log(`\nJSON:     ${reportPaths.json}`);
  console.log(`Markdown: ${reportPaths.markdown}`);
  console.log(`HTML:     ${reportPaths.html}`);

  console.log(`\n${"=".repeat(60)}\n`);
}

/**
 * Main CLI program using Commander.js.
 */
const program = new Command();

program
  .name("browsergame-qa")
  .description("Automated QA testing for browser-based games")
  .version(VERSION);

/**
 * Test command - runs QA test on a game URL.
 */
program
  .command("test")
  .description("Run QA test on a browser game")
  .argument("<gameUrl>", "URL of the game to test")
  .option(
    "-o, --output <dir>",
    "Output directory for test results",
    "./qa-tests/default",
  )
  .option("-t, --timeout <ms>", "Session timeout in milliseconds", "300000")
  .option("-m, --max-actions <n>", "Maximum number of actions to execute", "20")
  .option(
    "-d, --max-duration <ms>",
    "Maximum total test execution time in milliseconds",
    "300000",
  )
  .option(
    "-i, --input-hint <hint>",
    "Hint about game input controls (e.g., 'Arrow keys for movement, spacebar to jump')",
  )
  .option(
    "-g, --game-type <type>",
    "Manual game type override. Skips auto-detection if provided. Valid: platformer, clicker, puzzle, visual-novel, shooter, racing, rpg, strategy, arcade, card, sports, simulation, generic",
  )
  .option(
    "--no-warmup",
    "Disable loading warmup phase (progressive warmup enabled by default)",
  )
  .option(
    "--warmup-cycles <n>",
    "Number of warmup cycles (default: progressive - up to 3 rounds with early stopping). Providing this enables legacy warmup mode.",
  )
  .option(
    "--warmup-duration <ms>",
    "Duration of each warmup cycle in ms (default: progressive - 20s per round). Providing this enables legacy warmup mode.",
  )
  .option(
    "--warmup-interval <ms>",
    "Interval between warmup clicks in ms (default: 2000)",
  )
  .action(async (gameUrl: string, options: TestCommandOptions) => {
    try {
      console.log("\nStarting QA test...");
      console.log(`Game URL: ${gameUrl}`);
      console.log(`Output directory: ${options.output}`);
      console.log(`Session timeout: ${options.timeout}ms`);
      console.log(`Max duration: ${options.maxDuration}ms`);
      console.log(`Max actions: ${options.maxActions}`);
      if (options.inputHint) {
        console.log(`Input hint: ${options.inputHint}`);
      }
      if (options.gameType) {
        console.log(`Game type: ${options.gameType} (manual override, skipping auto-detection)`);
      } else {
        console.log("Game type: auto-detect");
      }

      // Log warmup config
      if (!options.noWarmup) {
        const isProgressive = !options.warmupCycles && !options.warmupDuration;

        if (isProgressive) {
          // Progressive warmup (default)
          const interval = options.warmupInterval ? Number.parseInt(options.warmupInterval, 10) : 2000;
          console.log(`Warmup: Progressive (up to 3×20s, stops early if responsive, clicks every ${interval}ms)`);
        } else {
          // Legacy warmup (user provided explicit config)
          const cycles = options.warmupCycles ? Number.parseInt(options.warmupCycles, 10) : 2;
          const duration = options.warmupDuration ? Number.parseInt(options.warmupDuration, 10) : 45000;
          const interval = options.warmupInterval ? Number.parseInt(options.warmupInterval, 10) : 2000;
          console.log(`Warmup: Legacy (${cycles} cycles × ${duration}ms, no early stopping, clicks every ${interval}ms)`);
        }
      } else {
        console.log("Warmup: disabled");
      }
      console.log();

      // Create orchestrator
      const orchestrator = new QAOrchestrator({
        gameUrl,
        outputDir: options.output,
        sessionTimeout: Number.parseInt(options.timeout, 10),
        maxDuration: Number.parseInt(options.maxDuration, 10),
        maxActions: Number.parseInt(options.maxActions, 10),
        inputHint: options.inputHint,
        gameType: options.gameType as GameType | undefined,
        warmup: {
          enabled: !options.noWarmup,
          cycles: options.warmupCycles ? Number.parseInt(options.warmupCycles, 10) : undefined,
          cycleDuration: options.warmupDuration ? Number.parseInt(options.warmupDuration, 10) : undefined,
          clickInterval: options.warmupInterval ? Number.parseInt(options.warmupInterval, 10) : undefined,
        },
      });

      // Run test with progress indication
      console.log("Validating URL and running test (this may take a few minutes)...\n");

      const result = await orchestrator.runTest();

      // Print results summary
      printResultsSummary(result.report, result.reportPaths);

      // Exit with appropriate code
      const exitCode = result.report.status === "success" ? 0 : 1;
      process.exit(exitCode);
    } catch (error) {
      // Handle errors
      console.error(`\n${"=".repeat(60)}`);
      console.error("  TEST FAILED");
      console.error(`${"=".repeat(60)}\n`);

      if (error instanceof ValidationError) {
        console.error("Validation Error:");
        console.error(`  ${error.message}\n`);
      } else if (error instanceof GameCrashError) {
        console.error("Game Crash:");
        console.error(`  ${error.message}\n`);
      } else if (error instanceof Error) {
        console.error("Error:");
        console.error(`  ${error.message}\n`);

        if (process.env.LOG_LEVEL === "debug") {
          console.error("Stack trace:");
          console.error(error.stack);
        }
      } else {
        console.error("Unknown error occurred\n");
      }

      log.error({ error }, "CLI test command failed");
      process.exit(1);
    }
  });

/**
 * Version command - shows version information.
 */
program
  .command("version")
  .description("Show version information")
  .action(() => {
    console.log(`Denethor v${VERSION}`);
    console.log("Runtime: Bun");
    console.log("Architecture: ESNext");
    process.exit(0);
  });

// Parse arguments
program.parse();
