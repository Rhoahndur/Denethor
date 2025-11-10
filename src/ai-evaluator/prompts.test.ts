/**
 * Unit tests for AI Evaluation Prompts.
 *
 * Tests prompt structure, template replacement, and context building
 * to ensure consistent and accurate prompt generation.
 */

import { describe, expect, it } from "vitest";
import {
  buildEvaluationPrompt,
  buildIssueDetectionPrompt,
  type EvaluationContext,
  ISSUE_DETECTION_PROMPT,
  PLAYABILITY_EVALUATION_PROMPT,
} from "./prompts";

describe("Prompts", () => {
  describe("PLAYABILITY_EVALUATION_PROMPT", () => {
    it("should be a non-empty string", () => {
      expect(PLAYABILITY_EVALUATION_PROMPT).toBeDefined();
      expect(typeof PLAYABILITY_EVALUATION_PROMPT).toBe("string");
      expect(PLAYABILITY_EVALUATION_PROMPT.length).toBeGreaterThan(0);
    });

    it("should contain scoring rubric for all dimensions", () => {
      expect(PLAYABILITY_EVALUATION_PROMPT).toContain("Load Success");
      expect(PLAYABILITY_EVALUATION_PROMPT).toContain("Responsiveness");
      expect(PLAYABILITY_EVALUATION_PROMPT).toContain("Stability");
      expect(PLAYABILITY_EVALUATION_PROMPT).toContain("Overall Playability");
    });

    it("should contain score ranges (0-100)", () => {
      expect(PLAYABILITY_EVALUATION_PROMPT).toContain("0-100");
      expect(PLAYABILITY_EVALUATION_PROMPT).toContain("90-100");
      expect(PLAYABILITY_EVALUATION_PROMPT).toContain("70-89");
      expect(PLAYABILITY_EVALUATION_PROMPT).toContain("40-69");
      expect(PLAYABILITY_EVALUATION_PROMPT).toContain("0-39");
    });

    it("should request JSON response format", () => {
      expect(PLAYABILITY_EVALUATION_PROMPT).toContain("JSON");
      expect(PLAYABILITY_EVALUATION_PROMPT).toContain("scores");
      expect(PLAYABILITY_EVALUATION_PROMPT).toContain("reasoning");
      expect(PLAYABILITY_EVALUATION_PROMPT).toContain("confidence");
    });

    it("should include evidence context placeholders", () => {
      expect(PLAYABILITY_EVALUATION_PROMPT).toContain("{screenshotCount}");
      expect(PLAYABILITY_EVALUATION_PROMPT).toContain("{consoleLogs}");
      expect(PLAYABILITY_EVALUATION_PROMPT).toContain("{actionLogs}");
      expect(PLAYABILITY_EVALUATION_PROMPT).toContain("{errorLogs}");
    });
  });

  describe("ISSUE_DETECTION_PROMPT", () => {
    it("should be a non-empty string", () => {
      expect(ISSUE_DETECTION_PROMPT).toBeDefined();
      expect(typeof ISSUE_DETECTION_PROMPT).toBe("string");
      expect(ISSUE_DETECTION_PROMPT.length).toBeGreaterThan(0);
    });

    it("should define severity levels", () => {
      expect(ISSUE_DETECTION_PROMPT).toContain("critical");
      expect(ISSUE_DETECTION_PROMPT).toContain("major");
      expect(ISSUE_DETECTION_PROMPT).toContain("minor");
    });

    it("should define issue categories", () => {
      expect(ISSUE_DETECTION_PROMPT).toContain("performance");
      expect(ISSUE_DETECTION_PROMPT).toContain("stability");
      expect(ISSUE_DETECTION_PROMPT).toContain("usability");
      expect(ISSUE_DETECTION_PROMPT).toContain("compatibility");
    });

    it("should request JSON array response format", () => {
      expect(ISSUE_DETECTION_PROMPT).toContain("JSON");
      expect(ISSUE_DETECTION_PROMPT).toContain("severity");
      expect(ISSUE_DETECTION_PROMPT).toContain("category");
      expect(ISSUE_DETECTION_PROMPT).toContain("description");
      expect(ISSUE_DETECTION_PROMPT).toContain("screenshot");
    });
  });

  describe("buildEvaluationPrompt", () => {
    it("should replace screenshot count placeholder", () => {
      const context: EvaluationContext = {
        screenshotCount: 5,
        hasConsoleLogs: true,
        hasActionLogs: true,
        hasErrors: false,
      };

      const prompt = buildEvaluationPrompt(context);

      expect(prompt).toContain("5 images");
      expect(prompt).not.toContain("{screenshotCount}");
    });

    it("should indicate when console logs are available", () => {
      const context: EvaluationContext = {
        screenshotCount: 3,
        hasConsoleLogs: true,
        hasActionLogs: false,
        hasErrors: false,
      };

      const prompt = buildEvaluationPrompt(context);

      expect(prompt).toContain("Available");
      expect(prompt).not.toContain("{consoleLogs}");
    });

    it("should indicate when console logs are not available", () => {
      const context: EvaluationContext = {
        screenshotCount: 3,
        hasConsoleLogs: false,
        hasActionLogs: true,
        hasErrors: false,
      };

      const prompt = buildEvaluationPrompt(context);

      expect(prompt).toContain("Not available");
    });

    it("should include console summary when provided", () => {
      const context: EvaluationContext = {
        screenshotCount: 3,
        hasConsoleLogs: true,
        hasActionLogs: true,
        hasErrors: false,
        consoleSummary: "3 errors, 5 warnings",
      };

      const prompt = buildEvaluationPrompt(context);

      expect(prompt).toContain("3 errors, 5 warnings");
    });

    it("should include action summary when provided", () => {
      const context: EvaluationContext = {
        screenshotCount: 3,
        hasConsoleLogs: true,
        hasActionLogs: true,
        hasErrors: false,
        actionSummary: "Clicked start, pressed arrow keys",
      };

      const prompt = buildEvaluationPrompt(context);

      expect(prompt).toContain("Clicked start, pressed arrow keys");
    });

    it("should indicate when errors are detected", () => {
      const context: EvaluationContext = {
        screenshotCount: 3,
        hasConsoleLogs: true,
        hasActionLogs: true,
        hasErrors: true,
      };

      const prompt = buildEvaluationPrompt(context);

      expect(prompt).toContain("errors detected");
    });

    it("should handle context with all logs unavailable", () => {
      const context: EvaluationContext = {
        screenshotCount: 1,
        hasConsoleLogs: false,
        hasActionLogs: false,
        hasErrors: false,
      };

      const prompt = buildEvaluationPrompt(context);

      expect(prompt).toContain("Not available");
      expect(prompt).toContain("None");
    });
  });

  describe("buildIssueDetectionPrompt", () => {
    it("should include playability scores in prompt", () => {
      const scores = {
        loadSuccess: 85,
        responsiveness: 75,
        stability: 90,
        overallPlayability: 80,
      };

      const prompt = buildIssueDetectionPrompt(scores);

      expect(prompt).toContain("Load Success: 85/100");
      expect(prompt).toContain("Responsiveness: 75/100");
      expect(prompt).toContain("Stability: 90/100");
      expect(prompt).toContain("Overall Playability: 80/100");
    });

    it("should flag low load success scores", () => {
      const scores = {
        loadSuccess: 45,
        responsiveness: 80,
        stability: 90,
        overallPlayability: 70,
      };

      const prompt = buildIssueDetectionPrompt(scores);

      expect(prompt).toContain("Low load success");
    });

    it("should flag low responsiveness scores", () => {
      const scores = {
        loadSuccess: 90,
        responsiveness: 40,
        stability: 85,
        overallPlayability: 70,
      };

      const prompt = buildIssueDetectionPrompt(scores);

      expect(prompt).toContain("Low responsiveness");
    });

    it("should flag low stability scores", () => {
      const scores = {
        loadSuccess: 85,
        responsiveness: 80,
        stability: 35,
        overallPlayability: 65,
      };

      const prompt = buildIssueDetectionPrompt(scores);

      expect(prompt).toContain("Low stability");
    });

    it("should flag low overall playability scores", () => {
      const scores = {
        loadSuccess: 50,
        responsiveness: 50,
        stability: 50,
        overallPlayability: 45,
      };

      const prompt = buildIssueDetectionPrompt(scores);

      expect(prompt).toContain("Low overall playability");
    });

    it("should not flag high scores", () => {
      const scores = {
        loadSuccess: 95,
        responsiveness: 90,
        stability: 92,
        overallPlayability: 93,
      };

      const prompt = buildIssueDetectionPrompt(scores);

      expect(prompt).not.toContain("Low load success");
      expect(prompt).not.toContain("Low responsiveness");
      expect(prompt).not.toContain("Low stability");
      expect(prompt).not.toContain("Low overall playability");
    });

    it("should include base issue detection prompt", () => {
      const scores = {
        loadSuccess: 75,
        responsiveness: 70,
        stability: 80,
        overallPlayability: 75,
      };

      const prompt = buildIssueDetectionPrompt(scores);

      expect(prompt).toContain("Severity Levels");
      expect(prompt).toContain("Issue Types");
    });
  });
});
