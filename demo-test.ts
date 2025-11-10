#!/usr/bin/env bun
/**
 * Demo Test - Shows what works without API calls
 *
 * This demonstrates:
 * - Evidence collection (screenshots, logs)
 * - Report generation (JSON, Markdown, HTML)
 * - No OpenAI/Browserbase APIs needed
 */

import { EvidenceStore } from "./src/evidence-store/evidenceStore";
import { ReportGenerator } from "./src/report-generator/reportGenerator";
import type { QAReport } from "./src/types";

console.log("\n🎮 Denethor Demo Test (No APIs Required)\n");
console.log("=".repeat(60));

async function runDemo() {
  // 1. Create evidence store
  console.log("\n📁 Step 1: Creating evidence store...");
  const testId = `demo-test-${Date.now()}`;
  const evidenceStore = new EvidenceStore(testId, "./qa-tests/demo");
  await evidenceStore.initialize();
  console.log(
    `   ✅ Evidence store created: ${evidenceStore.getTestDirectory()}`,
  );

  // 2. Simulate collecting evidence (normally from browser)
  console.log("\n📸 Step 2: Collecting mock evidence...");

  // Mock screenshot
  const mockScreenshot = Buffer.from("fake-screenshot-data");
  await evidenceStore.captureScreenshot(mockScreenshot, "initial-load");
  await evidenceStore.captureScreenshot(mockScreenshot, "after-click");
  console.log("   ✅ Captured 2 mock screenshots");

  // Mock logs
  await evidenceStore.collectConsoleLog("Game loaded successfully");
  await evidenceStore.collectConsoleLog("User clicked start button");
  await evidenceStore.collectActionLog("click", { target: "start-button" });
  console.log("   ✅ Collected mock logs");

  // 3. Create a mock QA report (normally from AI evaluation)
  console.log("\n🤖 Step 3: Creating mock evaluation report...");

  // Get screenshots
  const screenshots = await evidenceStore.getScreenshots();

  const mockReport: QAReport = {
    meta: {
      testId: testId,
      gameUrl: "https://example.com/demo-game",
      timestamp: new Date().toISOString(),
      duration: 45, // seconds
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
      loadSuccess: 95,
      responsiveness: 88,
      stability: 92,
      overallPlayability: 91,
    },
    evaluation: {
      reasoning:
        "Game loaded smoothly and responds well to user input. Minor UI polish needed.",
      confidence: 87,
    },
    issues: [
      {
        severity: "minor",
        category: "UI/UX",
        description: "Start button could be more prominent",
        screenshot: screenshots[0] || "",
      },
    ],
    actions: [
      {
        type: "click",
        timestamp: new Date().toISOString(),
        success: true,
        details: "Clicked start button",
      },
    ],
    evidence: {
      screenshots: screenshots,
      logs: {
        console: `${evidenceStore.getTestDirectory()}/logs/console.log`,
        actions: `${evidenceStore.getTestDirectory()}/logs/actions.log`,
        errors: `${evidenceStore.getTestDirectory()}/logs/errors.log`,
      },
    },
  };
  console.log("   ✅ Mock evaluation created");

  // 4. Generate reports
  console.log("\n📊 Step 4: Generating reports...");
  const reportGenerator = new ReportGenerator(mockReport, evidenceStore);
  const reportPaths = await reportGenerator.generateAll();

  console.log("\n✨ Reports generated:");
  console.log(`   📄 JSON:     ${reportPaths.json}`);
  console.log(`   📝 Markdown: ${reportPaths.markdown}`);
  console.log(`   🌐 HTML:     ${reportPaths.html}`);

  // 5. Display results
  console.log(`\n${"=".repeat(60)}`);
  console.log("🎯 TEST RESULTS");
  console.log("=".repeat(60));
  console.log(`\nGame URL: ${mockReport.meta.gameUrl}`);
  console.log(`Duration: ${mockReport.meta.duration}s`);
  console.log(`Status: ${mockReport.status.toUpperCase()}`);
  console.log("\n📊 Scores:");
  console.log(`   Load Success:     ${mockReport.scores.loadSuccess}/100`);
  console.log(`   Responsiveness:   ${mockReport.scores.responsiveness}/100`);
  console.log(`   Stability:        ${mockReport.scores.stability}/100`);
  console.log(
    `   Overall:          ${mockReport.scores.overallPlayability}/100`,
  );
  console.log(`\n💭 Reasoning: ${mockReport.evaluation.reasoning}`);
  console.log(`🎯 Confidence: ${mockReport.evaluation.confidence}%`);

  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ Demo complete! Check the reports above.");
  console.log(`${"=".repeat(60)}\n`);

  console.log("💡 To view the HTML report:");
  console.log(`   open ${reportPaths.html}`);
  console.log("");
}

// Run the demo
runDemo().catch((error) => {
  console.error("\n❌ Demo failed:", error);
  process.exit(1);
});
