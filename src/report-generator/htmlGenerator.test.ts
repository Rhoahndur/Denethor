/**
 * Unit tests for HTML Report Generator
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { QAReport } from "@/types";
import { generateHTML } from "./htmlGenerator";

// Create a mock QAReport for testing
const mockReport: QAReport = {
  meta: {
    testId: "test-html-789",
    gameUrl: "https://example.com/rpg-game",
    timestamp: "2025-11-04T16:00:00.000Z",
    duration: 300,
    agentVersion: "1.0.0",
    browserSettings: {
      browser: "chrome",
      viewport: { width: 1280, height: 720 },
      arguments: [
        "--enable-webgl",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
      device: "desktop",
      locale: "en-US",
    },
  },
  status: "failure",
  scores: {
    loadSuccess: 60,
    responsiveness: 45,
    stability: 30,
    overallPlayability: 42,
  },
  evaluation: {
    reasoning:
      "Game has significant stability issues and crashes frequently. Not recommended for release.",
    confidence: 98,
  },
  issues: [
    {
      severity: "critical",
      category: "Stability",
      description: "Game crashes after 2 minutes of gameplay",
      screenshot: "screenshots/15-crash-screen.png",
    },
    {
      severity: "major",
      category: "Performance",
      description: "Severe frame drops during combat",
    },
    {
      severity: "minor",
      category: "UI",
      description: "Menu button overlaps with score display",
      screenshot: "screenshots/08-ui-overlap.png",
    },
  ],
  evidence: {
    screenshots: [
      "screenshots/00-initial-load.png",
      "screenshots/01-main-menu.png",
      "screenshots/02-gameplay.png",
      "screenshots/15-crash-screen.png",
    ],
    logs: {
      console: "logs/console.log",
      actions: "logs/actions.log",
      errors: "logs/errors.log",
    },
  },
  actions: [
    {
      type: "navigate",
      timestamp: "2025-11-04T16:00:05.000Z",
      success: true,
      details: "Loaded game URL",
    },
    {
      type: "click",
      timestamp: "2025-11-04T16:00:12.000Z",
      success: true,
      details: "Started new game",
    },
    {
      type: "keyboard",
      timestamp: "2025-11-04T16:01:00.000Z",
      success: false,
      details: "Movement controls unresponsive",
    },
  ],
};

describe("generateHTML", () => {
  const testOutputDir = "./qa-tests/test-output-html-generator";
  const reportsDir = join(testOutputDir, "reports");
  const screenshotsDir = join(testOutputDir, "screenshots");
  const outputPath = join(reportsDir, "report.html");

  beforeEach(async () => {
    await mkdir(reportsDir, { recursive: true });
    await mkdir(screenshotsDir, { recursive: true });

    // Create dummy screenshot files for testing
    // Create a minimal 1x1 PNG image (base64 decoded)
    const minimalPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );

    const screenshotFiles = [
      "00-initial-load.png",
      "01-main-menu.png",
      "02-gameplay.png",
      "15-crash-screen.png",
    ];

    for (const filename of screenshotFiles) {
      await Bun.write(join(screenshotsDir, filename), minimalPng);
    }
  });

  afterEach(async () => {
    await rm(testOutputDir, { recursive: true, force: true });
  });

  it("should generate an HTML file", async () => {
    await generateHTML(mockReport, outputPath);

    const file = Bun.file(outputPath);
    expect(await file.exists()).toBe(true);
  });

  it("should generate valid HTML5 structure", async () => {
    await generateHTML(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("<!DOCTYPE html>");
    expect(content).toContain('<html lang="en">');
    expect(content).toContain("<head>");
    expect(content).toContain("<body>");
    expect(content).toContain("</html>");
  });

  it("should include meta tags for responsive design", async () => {
    await generateHTML(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain('<meta charset="UTF-8">');
    expect(content).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    );
  });

  it("should embed CSS styles", async () => {
    await generateHTML(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("<style>");
    expect(content).toContain("</style>");
    // Check for some key CSS rules
    expect(content).toContain("font-family:");
    expect(content).toContain("background:");
    expect(content).toContain(".score-bar");
    expect(content).toContain(".issue-item");
  });

  it("should include header with game URL", async () => {
    await generateHTML(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("<header>");
    expect(content).toContain("QA Test Report");
    expect(content).toContain(mockReport.meta.testId);
    expect(content).toContain(mockReport.meta.gameUrl);
  });

  it("should include summary card with status badge", async () => {
    await generateHTML(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("summary-card");
    expect(content).toContain("FAILURE");
    expect(content).toContain("5m 0s"); // 300 seconds
    expect(content).toContain("Overall Score");
  });

  it("should include scores section with progress bars", async () => {
    await generateHTML(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("Playability Scores");
    expect(content).toContain("score-bar");
    expect(content).toContain("Load Success");
    expect(content).toContain("Responsiveness");
    expect(content).toContain("Stability");
    expect(content).toContain("Overall Playability");
    // Check for score values
    expect(content).toContain("60/100");
    expect(content).toContain("45/100");
    expect(content).toContain("30/100");
  });

  it("should apply color coding to score bars", async () => {
    await generateHTML(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    // Check for CSS classes based on score ranges
    expect(content).toContain("bar-fill");
    // Should have poor/fair classes for low scores
    expect(content).toMatch(/bar-fill (poor|fair)/);
  });

  it("should include evaluation section with confidence badge", async () => {
    await generateHTML(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("Evaluation");
    expect(content).toContain("confidence-badge");
    expect(content).toContain("Confidence: 98%");
    expect(content).toContain(mockReport.evaluation.reasoning);
  });

  it("should group issues by severity", async () => {
    await generateHTML(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("Issues");
    expect(content).toContain("Critical Issues");
    expect(content).toContain("Major Issues");
    expect(content).toContain("Minor Issues");
  });

  it("should include severity badges with proper styling", async () => {
    await generateHTML(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("issue-badge critical");
    expect(content).toContain("issue-badge major");
    expect(content).toContain("issue-badge minor");
  });

  it("should include screenshot references in issues", async () => {
    await generateHTML(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("Evidence:");
    expect(content).toContain("screenshots/15-crash-screen.png");
    expect(content).toContain("screenshots/08-ui-overlap.png");
  });

  it("should include actions timeline", async () => {
    await generateHTML(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("Actions Taken");
    expect(content).toContain("action-timeline");
    expect(content).toContain("navigate");
    expect(content).toContain("click");
    expect(content).toContain("keyboard");
  });

  it("should differentiate successful and failed actions", async () => {
    await generateHTML(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("action-item success");
    expect(content).toContain("action-item failure");
  });

  it("should include evidence section with screenshots gallery", async () => {
    await generateHTML(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("Evidence");
    expect(content).toContain("Screenshots");
    expect(content).toContain("screenshot-gallery");
    expect(content).toContain("Screenshot 1");
    expect(content).toContain("Screenshot 4");

    // Verify screenshots are embedded as base64 data URIs
    expect(content).toContain("data:image/png;base64,");
    expect(content).toContain("00-initial-load.png");
    expect(content).toContain("15-crash-screen.png");
  });

  it("should include log paths", async () => {
    await generateHTML(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("Logs");
    expect(content).toContain("Console Log:");
    expect(content).toContain("Actions Log:");
    expect(content).toContain("Errors Log:");
    expect(content).toContain("logs/console.log");
    expect(content).toContain("logs/actions.log");
    expect(content).toContain("logs/errors.log");
  });

  it("should include footer with generation info", async () => {
    await generateHTML(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("<footer>");
    expect(content).toContain("Generated by Denethor Agent");
    expect(content).toContain(mockReport.meta.agentVersion);
  });

  it("should escape HTML special characters", async () => {
    const reportWithSpecialChars: QAReport = {
      ...mockReport,
      meta: {
        ...mockReport.meta,
        gameUrl: "https://example.com/game?test=<script>alert('xss')</script>",
      },
      // Remove screenshots to avoid base64 encoding bloat in this test
      evidence: {
        ...mockReport.evidence,
        screenshots: [],
      },
    };

    await generateHTML(reportWithSpecialChars, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    // Should escape the XSS attempt in the title and header
    expect(content).toContain(
      "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;",
    );
    // Should not allow the raw XSS script in user content areas (title tag)
    expect(content).toContain(
      "<title>QA Report - https://example.com/game?test=&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;</title>",
    );
  });

  it("should handle empty issues gracefully", async () => {
    const reportWithNoIssues: QAReport = {
      ...mockReport,
      issues: [],
    };

    await generateHTML(reportWithNoIssues, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("No issues detected");
  });

  it("should handle empty actions gracefully", async () => {
    const reportWithNoActions: QAReport = {
      ...mockReport,
      actions: [],
    };

    await generateHTML(reportWithNoActions, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("No actions recorded");
  });

  it("should include responsive CSS for mobile", async () => {
    await generateHTML(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("@media (max-width: 768px)");
  });

  it("should throw error for invalid output path", async () => {
    const invalidPath = "/invalid/path/that/does/not/exist/report.html";

    await expect(generateHTML(mockReport, invalidPath)).rejects.toThrow();
  });
});
