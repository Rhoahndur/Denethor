/**
 * Unit tests for Markdown Report Generator
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { QAReport } from "@/types";
import { generateMarkdown } from "./markdownGenerator";

// Create a mock QAReport for testing
const mockReport: QAReport = {
  meta: {
    testId: "test-md-456",
    gameUrl: "https://example.com/platformer",
    timestamp: "2025-11-04T14:30:00.000Z",
    duration: 240,
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
    responsiveness: 75,
    stability: 80,
    overallPlayability: 82,
  },
  evaluation: {
    reasoning:
      "Game loaded perfectly but has some responsiveness issues with keyboard inputs.",
    confidence: 88,
  },
  issues: [
    {
      severity: "critical",
      category: "Crash",
      description: "Game crashes on level 3",
      screenshot: "screenshots/10-crash.png",
    },
    {
      severity: "major",
      category: "Controls",
      description: "Jump button sometimes unresponsive",
    },
    {
      severity: "minor",
      category: "Graphics",
      description: "Minor texture flickering",
      screenshot: "screenshots/05-flicker.png",
    },
  ],
  evidence: {
    screenshots: [
      "screenshots/00-initial-load.png",
      "screenshots/01-level-1.png",
      "screenshots/02-level-2.png",
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
      timestamp: "2025-11-04T14:30:05.000Z",
      success: true,
    },
    {
      type: "click",
      timestamp: "2025-11-04T14:30:10.000Z",
      success: true,
      details: "Clicked start button",
    },
    {
      type: "keyboard",
      timestamp: "2025-11-04T14:30:20.000Z",
      success: false,
      details: "Arrow key input failed",
    },
  ],
};

describe("generateMarkdown", () => {
  const testOutputDir = "./qa-tests/test-output-markdown-generator";
  const outputPath = join(testOutputDir, "report.md");

  beforeEach(async () => {
    await mkdir(testOutputDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testOutputDir, { recursive: true, force: true });
  });

  it("should generate a Markdown file", async () => {
    await generateMarkdown(mockReport, outputPath);

    const file = Bun.file(outputPath);
    expect(await file.exists()).toBe(true);
  });

  it("should include header with test metadata", async () => {
    await generateMarkdown(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("# QA Test Report");
    expect(content).toContain(mockReport.meta.testId);
    expect(content).toContain(mockReport.meta.gameUrl);
    expect(content).toContain("SUCCESS");
  });

  it("should include summary section with duration", async () => {
    await generateMarkdown(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("## Summary");
    expect(content).toContain("4m 0s"); // 240 seconds = 4 minutes
    expect(content).toContain(mockReport.meta.agentVersion);
  });

  it("should include playability scores table", async () => {
    await generateMarkdown(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("## Playability Scores");
    expect(content).toContain("| Dimension | Score | Status |");
    expect(content).toContain("Load Success | 100/100");
    expect(content).toContain("Responsiveness | 75/100");
    expect(content).toContain("Stability | 80/100");
    expect(content).toContain("Overall Playability");
  });

  it("should include evaluation section", async () => {
    await generateMarkdown(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("## Evaluation");
    expect(content).toContain("**Confidence:** 88%");
    expect(content).toContain(mockReport.evaluation.reasoning);
  });

  it("should group issues by severity with emoji", async () => {
    await generateMarkdown(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("## Issues");
    expect(content).toContain("### Critical Issues");
    expect(content).toContain("🔴"); // Critical emoji
    expect(content).toContain("### Major Issues");
    expect(content).toContain("🟡"); // Major emoji
    expect(content).toContain("### Minor Issues");
    expect(content).toContain("🟢"); // Minor emoji
  });

  it("should include screenshot references in issues", async () => {
    await generateMarkdown(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("Evidence: `screenshots/10-crash.png`");
    expect(content).toContain("Evidence: `screenshots/05-flicker.png`");
  });

  it("should include actions section", async () => {
    await generateMarkdown(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("## Actions Taken");
    expect(content).toContain("✓"); // Success checkmark
    expect(content).toContain("✗"); // Failure X
    expect(content).toContain("**navigate**");
    expect(content).toContain("**click**");
    expect(content).toContain("Clicked start button");
  });

  it("should include evidence section with screenshots and logs", async () => {
    await generateMarkdown(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("## Evidence");
    expect(content).toContain("### Screenshots");
    expect(content).toContain("screenshots/00-initial-load.png");
    expect(content).toContain("### Logs");
    expect(content).toContain("**Console Log:**");
    expect(content).toContain("logs/console.log");
  });

  it("should handle empty issues array", async () => {
    const reportWithNoIssues: QAReport = {
      ...mockReport,
      issues: [],
    };

    await generateMarkdown(reportWithNoIssues, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("## Issues");
    expect(content).toContain("No issues detected");
  });

  it("should handle empty actions array", async () => {
    const reportWithNoActions: QAReport = {
      ...mockReport,
      actions: [],
    };

    await generateMarkdown(reportWithNoActions, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    expect(content).toContain("## Actions Taken");
    expect(content).toContain("No actions recorded");
  });

  it("should use horizontal rules to separate sections", async () => {
    await generateMarkdown(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    // Check for section separators
    expect(content).toContain("---");
  });

  it("should throw error for invalid output path", async () => {
    const invalidPath = "/invalid/path/that/does/not/exist/report.md";

    await expect(generateMarkdown(mockReport, invalidPath)).rejects.toThrow();
  });
});
