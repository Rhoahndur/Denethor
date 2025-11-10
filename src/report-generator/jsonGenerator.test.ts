/**
 * Unit tests for JSON Report Generator
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { QAReport } from "@/types";
import { generateJSON } from "./jsonGenerator";

// Create a comprehensive mock QAReport for testing
const mockReport: QAReport = {
  meta: {
    testId: "test-json-123",
    gameUrl: "https://example.com/test-game",
    timestamp: "2025-11-04T12:00:00.000Z",
    duration: 180,
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
    responsiveness: 80,
    stability: 85,
    overallPlayability: 87,
  },
  evaluation: {
    reasoning:
      "Game loaded successfully with good performance. Minor responsiveness issues detected.",
    confidence: 92,
  },
  issues: [
    {
      severity: "critical",
      category: "Load Error",
      description: "Failed to load texture assets",
      screenshot: "screenshots/00-load-error.png",
    },
    {
      severity: "major",
      category: "Performance",
      description: "Frame rate drops below 30fps",
    },
    {
      severity: "minor",
      category: "UI",
      description: "Button text slightly misaligned",
      screenshot: "screenshots/05-ui-issue.png",
    },
  ],
  evidence: {
    screenshots: [
      "screenshots/00-initial-load.png",
      "screenshots/01-gameplay.png",
      "screenshots/02-menu.png",
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
      timestamp: "2025-11-04T12:00:05.000Z",
      success: true,
      details: "Navigated to game URL",
    },
    {
      type: "click",
      timestamp: "2025-11-04T12:00:10.000Z",
      success: true,
      details: "Clicked start button",
    },
    {
      type: "keyboard",
      timestamp: "2025-11-04T12:00:15.000Z",
      success: false,
      details: "Arrow key press did not register",
    },
  ],
};

describe("generateJSON", () => {
  const testOutputDir = "./qa-tests/test-output-json-generator";
  const outputPath = join(testOutputDir, "report.json");

  beforeEach(async () => {
    // Create test output directory
    await mkdir(testOutputDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test output directory
    await rm(testOutputDir, { recursive: true, force: true });
  });

  it("should generate a JSON file", async () => {
    await generateJSON(mockReport, outputPath);

    const file = Bun.file(outputPath);
    expect(await file.exists()).toBe(true);
  });

  it("should generate valid JSON that matches QAReport structure", async () => {
    await generateJSON(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();
    const parsed = JSON.parse(content) as QAReport;

    // Verify structure matches
    expect(parsed.meta).toBeDefined();
    expect(parsed.status).toBeDefined();
    expect(parsed.scores).toBeDefined();
    expect(parsed.evaluation).toBeDefined();
    expect(parsed.issues).toBeDefined();
    expect(parsed.evidence).toBeDefined();
    expect(parsed.actions).toBeDefined();
  });

  it("should include all metadata fields", async () => {
    await generateJSON(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();
    const parsed = JSON.parse(content) as QAReport;

    expect(parsed.meta.testId).toBe(mockReport.meta.testId);
    expect(parsed.meta.gameUrl).toBe(mockReport.meta.gameUrl);
    expect(parsed.meta.timestamp).toBe(mockReport.meta.timestamp);
    expect(parsed.meta.duration).toBe(mockReport.meta.duration);
    expect(parsed.meta.agentVersion).toBe(mockReport.meta.agentVersion);
  });

  it("should include all playability scores", async () => {
    await generateJSON(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();
    const parsed = JSON.parse(content) as QAReport;

    expect(parsed.scores.loadSuccess).toBe(mockReport.scores.loadSuccess);
    expect(parsed.scores.responsiveness).toBe(mockReport.scores.responsiveness);
    expect(parsed.scores.stability).toBe(mockReport.scores.stability);
    expect(parsed.scores.overallPlayability).toBe(
      mockReport.scores.overallPlayability,
    );
  });

  it("should include all issues with correct structure", async () => {
    await generateJSON(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();
    const parsed = JSON.parse(content) as QAReport;

    expect(parsed.issues.length).toBe(3);
    expect(parsed.issues[0].severity).toBe("critical");
    expect(parsed.issues[1].severity).toBe("major");
    expect(parsed.issues[2].severity).toBe("minor");
    expect(parsed.issues[0].screenshot).toBeDefined();
    expect(parsed.issues[1].screenshot).toBeUndefined();
  });

  it("should include all evidence", async () => {
    await generateJSON(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();
    const parsed = JSON.parse(content) as QAReport;

    expect(parsed.evidence.screenshots.length).toBe(3);
    expect(parsed.evidence.logs.console).toBeDefined();
    expect(parsed.evidence.logs.actions).toBeDefined();
    expect(parsed.evidence.logs.errors).toBeDefined();
  });

  it("should include all actions", async () => {
    await generateJSON(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();
    const parsed = JSON.parse(content) as QAReport;

    expect(parsed.actions.length).toBe(3);
    expect(parsed.actions[0].success).toBe(true);
    expect(parsed.actions[2].success).toBe(false);
    expect(parsed.actions[0].details).toBeDefined();
  });

  it("should pretty-print JSON with 2-space indentation", async () => {
    await generateJSON(mockReport, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();

    // Check for proper indentation (2 spaces)
    expect(content).toContain('  "meta"');
    expect(content).toContain('    "testId"');
    expect(content).not.toContain("\t"); // No tabs
  });

  it("should handle empty issues array", async () => {
    const reportWithNoIssues: QAReport = {
      ...mockReport,
      issues: [],
    };

    await generateJSON(reportWithNoIssues, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();
    const parsed = JSON.parse(content) as QAReport;

    expect(parsed.issues).toEqual([]);
  });

  it("should handle empty actions array", async () => {
    const reportWithNoActions: QAReport = {
      ...mockReport,
      actions: [],
    };

    await generateJSON(reportWithNoActions, outputPath);

    const file = Bun.file(outputPath);
    const content = await file.text();
    const parsed = JSON.parse(content) as QAReport;

    expect(parsed.actions).toEqual([]);
  });

  it("should throw error for invalid output path", async () => {
    const invalidPath = "/invalid/path/that/does/not/exist/report.json";

    await expect(generateJSON(mockReport, invalidPath)).rejects.toThrow();
  });
});
