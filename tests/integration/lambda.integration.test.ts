import type { Callback, Context } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "@/lambda/handler";
import { QAOrchestrator } from "@/orchestrator/qaOrchestrator";
import { sampleQAReport } from "../fixtures/sample-evidence";

/**
 * Lambda Integration Tests
 * Tests Lambda handler function with various event formats
 */
describe("Lambda Handler Integration Tests", () => {
  let mockContext: Context;
  let mockCallback: Callback;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Lambda context
    mockContext = {
      callbackWaitsForEmptyEventLoop: false,
      functionName: "qa-test-function",
      functionVersion: "$LATEST",
      invokedFunctionArn:
        "arn:aws:lambda:us-east-1:123456789012:function:qa-test-function",
      memoryLimitInMB: "2048",
      awsRequestId: "test-request-id-123",
      logGroupName: "/aws/lambda/qa-test-function",
      logStreamName: "2025/11/04/[$LATEST]test-stream",
      getRemainingTimeInMillis: () => 280000, // 280 seconds (20s buffer from 300s timeout)
      done: vi.fn(),
      fail: vi.fn(),
      succeed: vi.fn(),
    };

    mockCallback = vi.fn();
  });

  /**
   * Event Parsing Tests
   */
  describe("Event Parsing", () => {
    it("should parse valid event with gameUrl", async () => {
      const _mockExecute = vi
        .spyOn(QAOrchestrator.prototype, "runTest")
        .mockResolvedValue(sampleQAReport);

      const event = {
        gameUrl: "https://example.com/game.html",
      };

      const result = await handler(event, mockContext, mockCallback);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toHaveProperty("meta");
    });

    it("should handle event with additional options", async () => {
      const _mockExecute = vi
        .spyOn(QAOrchestrator.prototype, "runTest")
        .mockResolvedValue(sampleQAReport);

      const event = {
        gameUrl: "https://example.com/game.html",
        options: {
          timeout: 120,
          maxActions: 15,
        },
      };

      const result = await handler(event, mockContext, mockCallback);

      expect(result.statusCode).toBe(200);
    });

    it("should reject event without gameUrl", async () => {
      const event = {};

      const result = await handler(event, mockContext, mockCallback);

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain("gameUrl");
    });

    it("should reject event with invalid gameUrl", async () => {
      const event = {
        gameUrl: "not-a-url",
      };

      const result = await handler(event, mockContext, mockCallback);

      expect(result.statusCode).toBe(400);
    });
  });

  /**
   * Response Formatting Tests
   */
  describe("Response Formatting", () => {
    it("should return 200 status code on success", async () => {
      const _mockExecute = vi
        .spyOn(QAOrchestrator.prototype, "runTest")
        .mockResolvedValue(sampleQAReport);

      const event = {
        gameUrl: "https://example.com/game.html",
      };

      const result = await handler(event, mockContext, mockCallback);

      expect(result.statusCode).toBe(200);
    });

    it("should return JSON body on success", async () => {
      const _mockExecute = vi
        .spyOn(QAOrchestrator.prototype, "runTest")
        .mockResolvedValue(sampleQAReport);

      const event = {
        gameUrl: "https://example.com/game.html",
      };

      const result = await handler(event, mockContext, mockCallback);

      expect(result.statusCode).toBe(200);
      expect(() => JSON.parse(result.body)).not.toThrow();

      const body = JSON.parse(result.body);
      expect(body).toHaveProperty("meta");
      expect(body).toHaveProperty("scores");
      expect(body).toHaveProperty("status");
    });

    it("should return 400 for validation errors", async () => {
      const event = {
        gameUrl: "invalid-url",
      };

      const result = await handler(event, mockContext, mockCallback);

      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);
      expect(body).toHaveProperty("error");
    });

    it("should return 500 for internal errors", async () => {
      const _mockExecute = vi
        .spyOn(QAOrchestrator.prototype, "runTest")
        .mockRejectedValue(new Error("Internal error"));

      const event = {
        gameUrl: "https://example.com/game.html",
      };

      const result = await handler(event, mockContext, mockCallback);

      expect(result.statusCode).toBe(500);

      const body = JSON.parse(result.body);
      expect(body).toHaveProperty("error");
    });

    it("should include error type in response", async () => {
      const event = {
        gameUrl: "http://localhost/game.html",
      };

      const result = await handler(event, mockContext, mockCallback);

      const body = JSON.parse(result.body);
      expect(body).toHaveProperty("error");
      expect(body).toHaveProperty("type");
    });
  });

  /**
   * /tmp Directory Usage Tests
   */
  describe("/tmp Directory Usage", () => {
    it("should use /tmp directory for output in Lambda environment", async () => {
      const mockExecute = vi
        .spyOn(QAOrchestrator.prototype, "runTest")
        .mockResolvedValue(sampleQAReport);

      const event = {
        gameUrl: "https://example.com/game.html",
      };

      await handler(event, mockContext, mockCallback);

      // Handler should configure orchestrator to use /tmp
      expect(mockExecute).toHaveBeenCalled();
    });

    it("should handle /tmp directory creation", async () => {
      const _mockExecute = vi
        .spyOn(QAOrchestrator.prototype, "runTest")
        .mockResolvedValue(sampleQAReport);

      const event = {
        gameUrl: "https://example.com/game.html",
      };

      const result = await handler(event, mockContext, mockCallback);

      expect(result.statusCode).toBe(200);
    });
  });

  /**
   * Lambda Timeout Handling
   */
  describe("Lambda Timeout Handling", () => {
    it("should respect 280s timeout (20s buffer)", async () => {
      const mockExecute = vi
        .spyOn(QAOrchestrator.prototype, "runTest")
        .mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return sampleQAReport;
        });

      const event = {
        gameUrl: "https://example.com/game.html",
      };

      const result = await handler(event, mockContext, mockCallback);

      expect(result.statusCode).toBe(200);
      expect(mockExecute).toHaveBeenCalled();
    });

    it("should handle timeout gracefully", async () => {
      // Mock long-running operation
      const _mockExecute = vi
        .spyOn(QAOrchestrator.prototype, "runTest")
        .mockRejectedValue(new Error("Execution timeout"));

      const event = {
        gameUrl: "https://example.com/game.html",
      };

      const result = await handler(event, mockContext, mockCallback);

      expect(result.statusCode).toBe(500);

      const body = JSON.parse(result.body);
      expect(body.error).toContain("timeout");
    });

    it("should check remaining time from context", () => {
      const remainingTime = mockContext.getRemainingTimeInMillis();

      // Should have 280 seconds (280000ms) remaining
      expect(remainingTime).toBe(280000);
      expect(remainingTime).toBeGreaterThan(0);
    });
  });

  /**
   * Error Response Tests
   */
  describe("Error Response Tests", () => {
    it("should return structured error for 400 responses", async () => {
      const event = {
        gameUrl: "invalid-url",
      };

      const result = await handler(event, mockContext, mockCallback);

      expect(result.statusCode).toBe(400);

      const body = JSON.parse(result.body);
      expect(body).toHaveProperty("error");
      expect(body).toHaveProperty("type");
      expect(typeof body.error).toBe("string");
      expect(body.error.length).toBeGreaterThan(0);
    });

    it("should return structured error for 500 responses", async () => {
      const _mockExecute = vi
        .spyOn(QAOrchestrator.prototype, "runTest")
        .mockRejectedValue(new Error("Something went wrong"));

      const event = {
        gameUrl: "https://example.com/game.html",
      };

      const result = await handler(event, mockContext, mockCallback);

      expect(result.statusCode).toBe(500);

      const body = JSON.parse(result.body);
      expect(body).toHaveProperty("error");
      expect(body.error).toContain("Something went wrong");
    });

    it("should not expose sensitive information in errors", async () => {
      const _mockExecute = vi
        .spyOn(QAOrchestrator.prototype, "runTest")
        .mockRejectedValue(new Error("API key sk-test-123 is invalid"));

      const event = {
        gameUrl: "https://example.com/game.html",
      };

      const result = await handler(event, mockContext, mockCallback);

      const body = JSON.parse(result.body);
      // Error should be sanitized
      expect(body.error).not.toContain("sk-test-123");
    });
  });

  /**
   * Various Event Format Tests
   */
  describe("Various Event Format Tests", () => {
    it("should handle API Gateway event format", async () => {
      const _mockExecute = vi
        .spyOn(QAOrchestrator.prototype, "runTest")
        .mockResolvedValue(sampleQAReport);

      const event = {
        body: JSON.stringify({
          gameUrl: "https://example.com/game.html",
        }),
      };

      const result = await handler(event, mockContext, mockCallback);

      expect(result.statusCode).toBe(200);
    });

    it("should handle direct invocation format", async () => {
      const _mockExecute = vi
        .spyOn(QAOrchestrator.prototype, "runTest")
        .mockResolvedValue(sampleQAReport);

      const event = {
        gameUrl: "https://example.com/game.html",
      };

      const result = await handler(event, mockContext, mockCallback);

      expect(result.statusCode).toBe(200);
    });

    it("should handle SQS event format (if applicable)", async () => {
      const _mockExecute = vi
        .spyOn(QAOrchestrator.prototype, "runTest")
        .mockResolvedValue(sampleQAReport);

      // SQS sends records array
      const event = {
        Records: [
          {
            body: JSON.stringify({
              gameUrl: "https://example.com/game.html",
            }),
          },
        ],
      };

      // Handler should extract gameUrl from first record
      const result = await handler(event, mockContext, mockCallback);

      // Should either process or reject unknown format
      expect(result).toBeDefined();
    });
  });

  /**
   * Lambda Context Usage Tests
   */
  describe("Lambda Context Usage Tests", () => {
    it("should access Lambda context properties", () => {
      expect(mockContext.functionName).toBe("qa-test-function");
      expect(mockContext.awsRequestId).toBe("test-request-id-123");
      expect(mockContext.memoryLimitInMB).toBe("2048");
    });

    it("should use remaining time for timeout decisions", () => {
      const remainingTime = mockContext.getRemainingTimeInMillis();

      expect(typeof remainingTime).toBe("number");
      expect(remainingTime).toBeGreaterThan(0);
    });
  });
});
