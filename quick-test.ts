#!/usr/bin/env node

/**
 * Quick Test Script - Minimal test to verify Browserbase session fix
 *
 * This script:
 * - Creates ONE Browserbase session (verifies fix)
 * - Loads the game URL
 * - Takes a single screenshot
 * - Exits in ~30 seconds
 * - Generates a report
 */

import * as dotenv from "dotenv";
import { BrowserAgent } from "./src/browser-agent/browserAgent";
import { EvidenceStore } from "./src/evidence-store/evidenceStore";
import { ReportGenerator } from "./src/report-generator/reportGenerator";
import type { QAReport } from "./src/types";

dotenv.config();

async function quickTest(gameUrl: string) {
  console.log("🚀 Quick Test - Browserbase Session Fix Verification\n");
  console.log(`Game URL: ${gameUrl}`);
  console.log(`Goal: Load game + take 1 screenshot in ~30 seconds\n`);

  const testId = `quick-test-${Date.now()}`;
  const outputDir = "./qa-tests/quick-test";

  // Initialize evidence store
  console.log("📁 Creating evidence store...");
  const evidenceStore = new EvidenceStore(testId, outputDir);
  await evidenceStore.initialize();
  console.log("✅ Evidence store ready\n");

  // Create browser agent
  console.log("🌐 Creating browser session...");
  const browserAgent = new BrowserAgent(testId, evidenceStore);

  try {
    // Create session (this is where the fix matters!)
    const startTime = Date.now();
    await browserAgent.createSession();
    console.log("✅ Session created successfully (fix verified!)\n");

    // Get page
    const page = browserAgent.getPage();
    if (!page) {
      throw new Error("No page available");
    }

    // Load game
    console.log(`⏳ Loading game: ${gameUrl}`);
    await page.goto(gameUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    console.log("✅ Game loaded\n");

    // Wait a moment for game to initialize
    console.log("⏳ Waiting 3 seconds for game to initialize...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Take screenshot
    console.log("📸 Capturing screenshot...");
    const screenshot = await page.screenshot({ fullPage: false });
    await evidenceStore.captureScreenshot(screenshot as Buffer, "game-loaded");
    console.log("✅ Screenshot captured\n");

    // Close session
    console.log("🔒 Closing browser session...");
    await browserAgent.closeSession();
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`✅ Session closed (took ${duration} seconds)\n`);

    // Generate mock report
    console.log("📊 Generating report...");
    const mockReport: QAReport = {
      meta: {
        testId,
        gameUrl,
        timestamp: new Date().toISOString(),
        duration,
        agentVersion: "1.0.0",
        browserSettings: {
          browser: "chrome",
          viewport: { width: 1280, height: 720 },
          arguments: [],
          device: "desktop",
          locale: "en-US",
        },
      },
      status: "success",
      scores: {
        loadSuccess: 100,
        responsiveness: 0, // Not tested
        stability: 100,
        overallPlayability: 75,
      },
      evaluation: {
        reasoning:
          "Quick test: Game loaded successfully. Only verified basic loading, no interaction testing.",
        confidence: 85,
      },
      issues: [],
      actions: [
        {
          type: "navigate",
          timestamp: new Date().toISOString(),
          success: true,
          details: `Navigated to ${gameUrl}`,
        },
      ],
      evidence: {
        screenshots: [
          `${evidenceStore.getTestDirectory()}/screenshots/game-loaded.png`,
        ],
        logs: {
          console: `${evidenceStore.getTestDirectory()}/logs/console.log`,
          actions: `${evidenceStore.getTestDirectory()}/logs/actions.log`,
          errors: `${evidenceStore.getTestDirectory()}/logs/errors.log`,
        },
      },
    };

    const reportGenerator = new ReportGenerator(mockReport, evidenceStore);
    const reportPaths = await reportGenerator.generateAll();
    console.log("✅ Reports generated\n");

    // Success summary
    console.log("============================================================");
    console.log("  ✅ QUICK TEST SUCCESSFUL!");
    console.log(
      "============================================================\n",
    );
    console.log("Verified:");
    console.log("  ✅ No duplicate session error (fix works!)");
    console.log("  ✅ Game loaded successfully");
    console.log("  ✅ Screenshot captured");
    console.log(`  ✅ Total time: ${duration} seconds (target: <30s)\n`);
    console.log("Reports:");
    console.log(`  📄 JSON: ${reportPaths.json}`);
    console.log(`  📝 Markdown: ${reportPaths.markdown}`);
    console.log(`  🌐 HTML: ${reportPaths.html}\n`);
    console.log("View report:");
    console.log(`  open ${reportPaths.html}\n`);
  } catch (error) {
    console.error(
      "\n============================================================",
    );
    console.error("  ❌ TEST FAILED");
    console.error(
      "============================================================\n",
    );

    if (error instanceof Error) {
      console.error("Error:", error.message);

      if (error.message.includes("429")) {
        console.error("\n⚠️  Still hitting rate limits!");
        console.error("   The fix may not have been applied correctly.");
      } else if (error.message.includes("currently 1")) {
        console.error("\n⚠️  Duplicate session error!");
        console.error("   The fix did not work - still creating 2 sessions.");
      }
    } else {
      console.error("Unknown error:", error);
    }

    // Try to cleanup
    try {
      await browserAgent.closeSession();
    } catch (_cleanupError) {
      // Ignore cleanup errors
    }

    process.exit(1);
  }
}

// Get game URL from command line or use default
const gameUrl = process.argv[2] || "https://meiri.itch.io/doce-fim";

quickTest(gameUrl);
