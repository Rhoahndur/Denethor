/**
 * Unit tests for Report Generator Core Module
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { EvidenceStore } from "@/evidence-store/evidenceStore";
import type { QAReport } from "@/types";
import { ReportGenerator } from "./reportGenerator";

// Create a mock QAReport for testing
const mockReport: QAReport = {
  meta: {
    testId: "test-123",
    gameUrl: "https://example.com/game",
    timestamp: "2025-11-04T12:00:00.000Z",
    duration: 120,
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
    responsiveness: 85,
    stability: 90,
    overallPlayability: 88,
  },
  evaluation: {
    reasoning: "Game loaded successfully and played well with minor issues.",
    confidence: 95,
  },
  issues: [
    {
      severity: "minor",
      category: "Performance",
      description: "Slight lag during scene transitions",
      screenshot: "screenshots/03-scene-transition.png",
    },
  ],
  evidence: {
    screenshots: [
      "screenshots/00-initial-load.png",
      "screenshots/01-gameplay.png",
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
  ],
};

// Mock EvidenceStore
const createMockEvidenceStore = (reportsDir: string): EvidenceStore => {
  return {
    getReportsDirectory: () => reportsDir,
  } as EvidenceStore;
};

describe("ReportGenerator", () => {
  const testOutputDir = "./qa-tests/test-output-report-generator";
  const reportsDir = join(testOutputDir, "reports");
  let evidenceStore: EvidenceStore;

  beforeEach(async () => {
    // Create test output directory
    await mkdir(reportsDir, { recursive: true });
    evidenceStore = createMockEvidenceStore(reportsDir);
  });

  afterEach(async () => {
    // Clean up test output directory
    await rm(testOutputDir, { recursive: true, force: true });
  });

  it("should create a ReportGenerator instance", () => {
    const generator = new ReportGenerator(mockReport, evidenceStore);
    expect(generator).toBeDefined();
  });

  it("should generate all report formats in parallel", async () => {
    const generator = new ReportGenerator(mockReport, evidenceStore);
    const reportPaths = await generator.generateAll();

    expect(reportPaths).toBeDefined();
    expect(reportPaths.json).toContain("report.json");
    expect(reportPaths.markdown).toContain("report.md");
    expect(reportPaths.html).toContain("report.html");
  });

  it("should save all reports to the reports directory", async () => {
    const generator = new ReportGenerator(mockReport, evidenceStore);
    const reportPaths = await generator.generateAll();

    // Verify files exist by checking Bun.file
    const jsonFile = Bun.file(reportPaths.json);
    const mdFile = Bun.file(reportPaths.markdown);
    const htmlFile = Bun.file(reportPaths.html);

    expect(await jsonFile.exists()).toBe(true);
    expect(await mdFile.exists()).toBe(true);
    expect(await htmlFile.exists()).toBe(true);
  });

  it("should return correct file paths", async () => {
    const generator = new ReportGenerator(mockReport, evidenceStore);
    const reportPaths = await generator.generateAll();

    expect(reportPaths.json).toBe(join(reportsDir, "report.json"));
    expect(reportPaths.markdown).toBe(join(reportsDir, "report.md"));
    expect(reportPaths.html).toBe(join(reportsDir, "report.html"));
  });

  it("should handle errors gracefully", async () => {
    // Create a mock store with invalid directory
    const invalidStore = createMockEvidenceStore(
      "/invalid/path/that/does/not/exist",
    );
    const generator = new ReportGenerator(mockReport, invalidStore);

    await expect(generator.generateAll()).rejects.toThrow();
  });
});
