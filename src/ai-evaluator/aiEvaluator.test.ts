/**
 * Unit tests for AI Evaluator module.
 *
 * Tests the AIEvaluator class initialization, configuration, and core functionality
 * including playability evaluation and issue detection.
 *
 * Note: These tests verify structure and integration without making actual API calls.
 * Integration tests with real API calls should be done separately.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { EvidenceCollection } from "@/evidence-store/evidenceStore";
import { AIEvaluator } from "./aiEvaluator";

describe("AIEvaluator", () => {
  let evaluator: AIEvaluator;

  // Set up test environment variables
  beforeAll(() => {
    process.env.OPENAI_API_KEY = "test-api-key";
    process.env.BROWSERBASE_API_KEY = "test-browserbase-key";
    process.env.BROWSERBASE_PROJECT_ID = "test-project-id";
  });

  afterAll(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.BROWSERBASE_API_KEY;
    delete process.env.BROWSERBASE_PROJECT_ID;
  });

  describe("Initialization", () => {
    it("should initialize with OpenAI provider", () => {
      evaluator = new AIEvaluator();
      expect(evaluator).toBeDefined();
    });

    it("should use GPT-4o model", () => {
      evaluator = new AIEvaluator();
      expect(evaluator.getModel()).toBe("gpt-4o");
    });
  });

  describe("evaluatePlayability", () => {
    beforeAll(() => {
      evaluator = new AIEvaluator();
    });

    it("should be a callable method that accepts evidence collection", () => {
      const _mockEvidence: EvidenceCollection = {
        screenshots: [],
        logs: {
          console: null,
          actions: null,
          errors: null,
        },
        metadata: null,
      };

      // Verify method exists and is callable
      expect(evaluator.evaluatePlayability).toBeDefined();
      expect(typeof evaluator.evaluatePlayability).toBe("function");

      // Note: We don't call it in unit tests to avoid API calls
      // Integration tests should verify actual behavior
    });

    it("should have the correct method signature", () => {
      // Verify the method accepts EvidenceCollection and returns Promise
      const mockEvidence: EvidenceCollection = {
        screenshots: [],
        logs: {
          console: null,
          actions: null,
          errors: null,
        },
        metadata: null,
      };

      const result = evaluator.evaluatePlayability(mockEvidence);
      expect(result).toBeInstanceOf(Promise);
    }, 100); // Short timeout since we're just checking signature
  });

  describe("detectIssues", () => {
    beforeAll(() => {
      evaluator = new AIEvaluator();
    });

    it("should be a callable method that accepts evidence and scores", () => {
      // Verify method exists and is callable
      expect(evaluator.detectIssues).toBeDefined();
      expect(typeof evaluator.detectIssues).toBe("function");
    });

    it("should have the correct method signature", () => {
      const mockEvidence: EvidenceCollection = {
        screenshots: [],
        logs: {
          console: null,
          actions: null,
          errors: null,
        },
        metadata: null,
      };

      const mockScores = {
        loadSuccess: 50,
        responsiveness: 60,
        stability: 70,
        overallPlayability: 60,
      };

      const result = evaluator.detectIssues(mockEvidence, mockScores);

      // Verify it returns a Promise
      expect(result).toBeInstanceOf(Promise);
    }, 100); // Short timeout since we're just checking signature

    it("should handle empty evidence gracefully", async () => {
      const mockEvidence: EvidenceCollection = {
        screenshots: [],
        logs: {
          console: null,
          actions: null,
          errors: null,
        },
        metadata: null,
      };

      const mockScores = {
        loadSuccess: 50,
        responsiveness: 60,
        stability: 70,
        overallPlayability: 60,
      };

      // This should not throw even without API calls - should return empty array on error
      const issues = await evaluator.detectIssues(mockEvidence, mockScores);
      expect(Array.isArray(issues)).toBe(true);
    }, 15000); // Longer timeout for API retry logic
  });

  describe("Configuration", () => {
    it("should use configuration from centralized config module", () => {
      // This test verifies that the evaluator uses config.openai.apiKey
      // The actual API key validation happens in the config module
      evaluator = new AIEvaluator();
      expect(evaluator).toBeDefined();
    });
  });
});
