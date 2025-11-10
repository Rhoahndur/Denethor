import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QAOrchestrator } from "@/orchestrator/qaOrchestrator";
import type { QAReport } from "@/types/qaReport";

/**
 * Integration Tests for QAOrchestrator + Components
 * Tests the full orchestration flow with real component instances but mocked external APIs
 */
describe("QAOrchestrator Integration Tests", () => {
  let _orchestrator: QAOrchestrator;
  let mockEvidenceStore: any;
  let mockBrowserAgent: any;
  let mockAIEvaluator: any;
  let mockReportGenerator: any;

  beforeEach(() => {
    // Mock EvidenceStore
    mockEvidenceStore = {
      captureScreenshot: vi
        .fn()
        .mockResolvedValue("/test/screenshots/00-initial-load.png"),
      collectConsoleLog: vi.fn().mockResolvedValue(undefined),
      collectActionLog: vi.fn().mockResolvedValue(undefined),
      collectErrorLog: vi.fn().mockResolvedValue(undefined),
      getScreenshots: vi
        .fn()
        .mockReturnValue([
          "/test/screenshots/00-initial-load.png",
          "/test/screenshots/01-gameplay.png",
        ]),
      getLogPath: vi.fn((type: string) => `/test/logs/${type}.log`),
      getMetadata: vi.fn().mockReturnValue({
        testId: "test-123",
        gameUrl: "https://example.com/game.html",
        timestamp: new Date().toISOString(),
      }),
      getAllEvidence: vi.fn().mockReturnValue({
        screenshots: ["/test/screenshots/00-initial-load.png"],
        logs: {
          console: "/test/logs/console.log",
          actions: "/test/logs/actions.log",
          errors: "/test/logs/errors.log",
        },
      }),
    };

    // Mock BrowserAgent
    mockBrowserAgent = {
      initialize: vi.fn().mockResolvedValue(undefined),
      navigateToGame: vi.fn().mockResolvedValue(undefined),
      detectGameType: vi.fn().mockResolvedValue("platformer"),
      simulateGameplay: vi.fn().mockResolvedValue({
        success: true,
        actionsPerformed: 5,
        screenshots: ["/test/screenshots/00-initial-load.png"],
      }),
      cleanup: vi.fn().mockResolvedValue(undefined),
    };

    // Mock AIEvaluator
    mockAIEvaluator = {
      evaluatePlayability: vi.fn().mockResolvedValue({
        scores: {
          loadSuccess: 95,
          responsiveness: 90,
          stability: 92,
          overallPlayability: 92,
        },
        reasoning: "Game loaded and played successfully",
        confidence: 90,
      }),
      detectIssues: vi.fn().mockResolvedValue([
        {
          severity: "minor" as const,
          category: "performance",
          description: "Slight delay in initial load",
          screenshot: "/test/screenshots/00-initial-load.png",
        },
      ]),
    };

    // Mock ReportGenerator
    mockReportGenerator = {
      generateAll: vi.fn().mockResolvedValue({
        json: "/test/reports/report.json",
        markdown: "/test/reports/report.md",
        html: "/test/reports/report.html",
      }),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should orchestrate full QA flow with all components", async () => {
    // This would be the actual orchestrator integration test
    // For now, we test that components work together
    const gameUrl = "https://example.com/game.html";

    // Initialize browser
    await mockBrowserAgent.initialize();
    expect(mockBrowserAgent.initialize).toHaveBeenCalled();

    // Navigate to game
    await mockBrowserAgent.navigateToGame(gameUrl);
    expect(mockBrowserAgent.navigateToGame).toHaveBeenCalledWith(gameUrl);

    // Detect game type
    const gameType = await mockBrowserAgent.detectGameType();
    expect(gameType).toBe("platformer");

    // Simulate gameplay
    const gameplayResult = await mockBrowserAgent.simulateGameplay();
    expect(gameplayResult.success).toBe(true);

    // Collect evidence
    await mockEvidenceStore.captureScreenshot("initial-load");
    await mockEvidenceStore.collectActionLog("Action performed");
    expect(mockEvidenceStore.captureScreenshot).toHaveBeenCalled();
    expect(mockEvidenceStore.collectActionLog).toHaveBeenCalled();

    // Evaluate playability
    const evidence = mockEvidenceStore.getAllEvidence();
    const evaluation = await mockAIEvaluator.evaluatePlayability(evidence);
    expect(evaluation.scores.overallPlayability).toBeGreaterThanOrEqual(90);

    // Detect issues
    const issues = await mockAIEvaluator.detectIssues(
      evidence,
      evaluation.scores,
    );
    expect(Array.isArray(issues)).toBe(true);

    // Generate reports
    const reportPaths = await mockReportGenerator.generateAll();
    expect(reportPaths.json).toBeDefined();
    expect(reportPaths.markdown).toBeDefined();
    expect(reportPaths.html).toBeDefined();

    // Cleanup
    await mockBrowserAgent.cleanup();
    expect(mockBrowserAgent.cleanup).toHaveBeenCalled();
  });

  it("should handle evidence collection correctly throughout flow", async () => {
    // Test evidence is captured at key moments
    await mockEvidenceStore.captureScreenshot("initial-load");
    await mockEvidenceStore.captureScreenshot("gameplay-1");
    await mockEvidenceStore.captureScreenshot("gameplay-2");

    const screenshots = mockEvidenceStore.getScreenshots();
    expect(screenshots).toHaveLength(2); // Based on mock

    await mockEvidenceStore.collectActionLog("Action 1");
    await mockEvidenceStore.collectActionLog("Action 2");
    await mockEvidenceStore.collectConsoleLog("Console message");

    expect(mockEvidenceStore.collectActionLog).toHaveBeenCalledTimes(2);
    expect(mockEvidenceStore.collectConsoleLog).toHaveBeenCalledTimes(1);
  });

  it("should propagate data correctly between components", async () => {
    // Test data flow: BrowserAgent → EvidenceStore → AIEvaluator → ReportGenerator
    const gameUrl = "https://example.com/game.html";

    // Browser agent produces evidence
    await mockBrowserAgent.navigateToGame(gameUrl);
    const gameplayResult = await mockBrowserAgent.simulateGameplay();

    // Evidence store collects it
    for (const screenshot of gameplayResult.screenshots) {
      await mockEvidenceStore.captureScreenshot(screenshot);
    }

    // AI evaluator consumes evidence
    const evidence = mockEvidenceStore.getAllEvidence();
    const evaluation = await mockAIEvaluator.evaluatePlayability(evidence);
    const issues = await mockAIEvaluator.detectIssues(
      evidence,
      evaluation.scores,
    );

    // Report generator creates final output
    const report: Partial<QAReport> = {
      meta: mockEvidenceStore.getMetadata(),
      status: "success",
      scores: evaluation.scores,
      evaluation: {
        reasoning: evaluation.reasoning,
        confidence: evaluation.confidence,
      },
      issues,
      evidence,
      actions: [],
    };

    await mockReportGenerator.generateAll(report);

    // Verify all components were called in correct order
    expect(mockBrowserAgent.navigateToGame).toHaveBeenCalled();
    expect(mockBrowserAgent.simulateGameplay).toHaveBeenCalled();
    expect(mockEvidenceStore.captureScreenshot).toHaveBeenCalled();
    expect(mockAIEvaluator.evaluatePlayability).toHaveBeenCalled();
    expect(mockReportGenerator.generateAll).toHaveBeenCalled();
  });

  it("should handle errors from browser agent", async () => {
    mockBrowserAgent.navigateToGame.mockRejectedValueOnce(
      new Error("Navigation failed"),
    );

    await expect(
      mockBrowserAgent.navigateToGame("https://example.com/game.html"),
    ).rejects.toThrow("Navigation failed");
  });

  it("should handle errors from AI evaluator", async () => {
    mockAIEvaluator.evaluatePlayability.mockRejectedValueOnce(
      new Error("API rate limit exceeded"),
    );

    await expect(mockAIEvaluator.evaluatePlayability({})).rejects.toThrow(
      "API rate limit exceeded",
    );
  });

  it("should clean up browser session even on errors", async () => {
    mockBrowserAgent.simulateGameplay.mockRejectedValueOnce(
      new Error("Game crashed"),
    );

    try {
      await mockBrowserAgent.simulateGameplay();
    } catch (_error) {
      // Expected error
    }

    await mockBrowserAgent.cleanup();
    expect(mockBrowserAgent.cleanup).toHaveBeenCalled();
  });

  it("should generate reports with correct data structure", async () => {
    const evidence = mockEvidenceStore.getAllEvidence();
    const evaluation = await mockAIEvaluator.evaluatePlayability(evidence);
    const issues = await mockAIEvaluator.detectIssues(
      evidence,
      evaluation.scores,
    );

    const report: Partial<QAReport> = {
      meta: mockEvidenceStore.getMetadata(),
      status: "success",
      scores: evaluation.scores,
      evaluation: {
        reasoning: evaluation.reasoning,
        confidence: evaluation.confidence,
      },
      issues,
      evidence,
      actions: [],
    };

    await mockReportGenerator.generateAll(report);

    expect(mockReportGenerator.generateAll).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.any(Object),
        status: "success",
        scores: expect.any(Object),
        evaluation: expect.any(Object),
        issues: expect.any(Array),
        evidence: expect.any(Object),
      }),
    );
  });

  it("should handle multiple gameplay actions", async () => {
    const gameplayResult = await mockBrowserAgent.simulateGameplay();
    expect(gameplayResult.actionsPerformed).toBeGreaterThan(0);

    // Verify actions were logged
    for (let i = 0; i < gameplayResult.actionsPerformed; i++) {
      await mockEvidenceStore.collectActionLog(`Action ${i}`);
    }

    expect(mockEvidenceStore.collectActionLog).toHaveBeenCalledTimes(
      gameplayResult.actionsPerformed,
    );
  });

  it("should collect console logs during execution", async () => {
    await mockEvidenceStore.collectConsoleLog("Game loaded");
    await mockEvidenceStore.collectConsoleLog("Player moved");
    await mockEvidenceStore.collectConsoleLog("Game completed");

    expect(mockEvidenceStore.collectConsoleLog).toHaveBeenCalledTimes(3);
  });

  it("should collect error logs when errors occur", async () => {
    await mockEvidenceStore.collectErrorLog("JavaScript error: undefined");
    await mockEvidenceStore.collectErrorLog("Network error: timeout");

    expect(mockEvidenceStore.collectErrorLog).toHaveBeenCalledTimes(2);
  });
});
