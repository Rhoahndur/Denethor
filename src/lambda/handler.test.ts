/**
 * Unit tests for Lambda Handler.
 *
 * Tests Lambda event handling, response formatting, and error handling.
 */

import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { handler } from "./handler";

// Mock the API
vi.mock("@/api/index", () => ({
  runQATest: vi.fn().mockResolvedValue({
    report: {
      meta: {
        testId: "test-123",
        gameUrl: "https://example.com/game",
        timestamp: "2025-11-03T12:00:00Z",
        duration: 45,
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
        reasoning: "Game loaded and played well",
        confidence: 95,
      },
      issues: [],
      evidence: {
        screenshots: [],
        logs: {
          console: "",
          actions: "",
          errors: "",
        },
      },
      actions: [],
    },
    reportPaths: {
      json: "/tmp/qa-results/report.json",
      markdown: "/tmp/qa-results/report.md",
      html: "/tmp/qa-results/report.html",
    },
  }),
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

describe("Lambda Handler", () => {
  // Mock Lambda context
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: true,
    functionName: "browsergame-qa",
    functionVersion: "1",
    invokedFunctionArn:
      "arn:aws:lambda:us-east-1:123456789012:function:browsergame-qa",
    memoryLimitInMB: "2048",
    awsRequestId: "test-request-id",
    logGroupName: "/aws/lambda/browsergame-qa",
    logStreamName: "2025/11/03/test",
    getRemainingTimeInMillis: () => 300000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };

  describe("successful requests", () => {
    it("should handle valid event with gameUrl", async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          gameUrl: "https://example.com/game",
        }),
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toHaveProperty("Content-Type", "application/json");
      expect(result.body).toBeDefined();

      const body = JSON.parse(result.body);
      expect(body).toHaveProperty("testId");
      expect(body).toHaveProperty("gameUrl");
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("scores");
    });

    it("should handle event with optional parameters", async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          gameUrl: "https://example.com/game",
          maxActions: 15,
          sessionTimeout: 60000,
          outputDir: "/tmp/custom-output",
        }),
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.gameUrl).toBe("https://example.com/game");
    });

    it("should return properly formatted response body", async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          gameUrl: "https://example.com/game",
        }),
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);

      expect(body).toHaveProperty("testId");
      expect(body).toHaveProperty("gameUrl");
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("scores");
      expect(body).toHaveProperty("reasoning");
      expect(body).toHaveProperty("confidence");
      expect(body).toHaveProperty("issues");
      expect(body).toHaveProperty("reportPaths");
      expect(body).toHaveProperty("duration");

      expect(body.scores).toHaveProperty("loadSuccess");
      expect(body.scores).toHaveProperty("responsiveness");
      expect(body.scores).toHaveProperty("stability");
      expect(body.scores).toHaveProperty("overallPlayability");
    });
  });

  describe("error handling", () => {
    it("should return 400 for missing event body", async () => {
      const event: APIGatewayProxyEvent = {} as APIGatewayProxyEvent;

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty("error");
      expect(body).toHaveProperty("type", "ValidationError");
    });

    it("should return 400 for invalid JSON", async () => {
      const event: APIGatewayProxyEvent = {
        body: "invalid json",
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty("error");
      expect(body).toHaveProperty("type", "ParseError");
    });

    it("should return 400 for missing gameUrl", async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          maxActions: 15,
        }),
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty("error");
      expect(body).toHaveProperty("type", "ValidationError");
    });
  });

  describe("Lambda event format", () => {
    it("should accept event with string body", async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({ gameUrl: "https://example.com/game" }),
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext);
      expect(result.statusCode).toBe(200);
    });

    it("should return properly formatted API Gateway response", async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({ gameUrl: "https://example.com/game" }),
      } as APIGatewayProxyEvent;

      const result = await handler(event, mockContext);

      expect(result).toHaveProperty("statusCode");
      expect(result).toHaveProperty("headers");
      expect(result).toHaveProperty("body");
      expect(result.headers).toHaveProperty("Content-Type");
      expect(typeof result.body).toBe("string");
    });
  });
});
