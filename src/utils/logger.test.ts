import { afterEach, beforeEach, describe, expect, test } from "vitest";

describe("logger module", () => {
  // Store original env vars (only the keys we care about)
  const originalEnv = {
    LOG_LEVEL: process.env.LOG_LEVEL,
    BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY,
    BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };

  beforeEach(() => {
    // Set mock env vars (don't leak real API keys into tests)
    process.env.BROWSERBASE_API_KEY = "test-key";
    process.env.BROWSERBASE_PROJECT_ID = "test-project";
    process.env.OPENAI_API_KEY = "test-openai";
  });

  afterEach(() => {
    // Restore original env vars
    if (originalEnv.LOG_LEVEL) {
      process.env.LOG_LEVEL = originalEnv.LOG_LEVEL;
    } else {
      delete process.env.LOG_LEVEL;
    }
    if (originalEnv.BROWSERBASE_API_KEY)
      process.env.BROWSERBASE_API_KEY = originalEnv.BROWSERBASE_API_KEY;
    if (originalEnv.BROWSERBASE_PROJECT_ID)
      process.env.BROWSERBASE_PROJECT_ID = originalEnv.BROWSERBASE_PROJECT_ID;
    if (originalEnv.OPENAI_API_KEY)
      process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
  });

  describe("logger instance", () => {
    test("should create and export logger instance", async () => {
      const { logger } = await import("./logger");

      expect(logger).toBeDefined();
      expect(typeof logger).toBe("object");
    });

    test("should be a Pino logger instance", async () => {
      const { logger } = await import("./logger");

      // Pino logger has these methods
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.child).toBe("function");
    });
  });

  describe("log level configuration", () => {
    test("should use default log level 'info' when LOG_LEVEL not set", async () => {
      delete process.env.LOG_LEVEL;

      const { logger } = await import("./logger");

      expect(logger.level).toBe("info");
    });

    test("should use LOG_LEVEL from environment when set to 'debug'", async () => {
      process.env.LOG_LEVEL = "debug";

      const { logger } = await import("./logger");

      expect(logger.level).toBe("debug");
    });

    test("should use LOG_LEVEL from environment when set to 'warn'", async () => {
      process.env.LOG_LEVEL = "warn";

      const { logger } = await import("./logger");

      expect(logger.level).toBe("warn");
    });

    test("should use LOG_LEVEL from environment when set to 'error'", async () => {
      process.env.LOG_LEVEL = "error";

      const { logger } = await import("./logger");

      expect(logger.level).toBe("error");
    });

    test("should use LOG_LEVEL from environment when set to 'trace'", async () => {
      process.env.LOG_LEVEL = "trace";

      const { logger } = await import("./logger");

      expect(logger.level).toBe("trace");
    });
  });

  describe("child logger support", () => {
    test("should create child logger with component context", async () => {
      const { logger } = await import("./logger");

      const childLogger = logger.child({ component: "TestComponent" });

      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe("function");
      expect(typeof childLogger.warn).toBe("function");
      expect(typeof childLogger.error).toBe("function");
      expect(typeof childLogger.debug).toBe("function");
    });

    test("should create child logger with custom bindings", async () => {
      const { logger } = await import("./logger");

      const childLogger = logger.child({
        component: "BrowserAgent",
        sessionId: "test-123",
      });

      expect(childLogger).toBeDefined();
    });

    test("should allow multiple child loggers", async () => {
      const { logger } = await import("./logger");

      const childLogger1 = logger.child({ component: "Component1" });
      const childLogger2 = logger.child({ component: "Component2" });

      expect(childLogger1).toBeDefined();
      expect(childLogger2).toBeDefined();
      expect(childLogger1).not.toBe(childLogger2);
    });
  });

  describe("logger methods", () => {
    test("should have info method", async () => {
      const { logger } = await import("./logger");

      expect(typeof logger.info).toBe("function");
      // Should not throw when called
      expect(() => logger.info("test message")).not.toThrow();
    });

    test("should have warn method", async () => {
      const { logger } = await import("./logger");

      expect(typeof logger.warn).toBe("function");
      expect(() => logger.warn("test warning")).not.toThrow();
    });

    test("should have error method", async () => {
      const { logger } = await import("./logger");

      expect(typeof logger.error).toBe("function");
      expect(() => logger.error("test error")).not.toThrow();
    });

    test("should have debug method", async () => {
      const { logger } = await import("./logger");

      expect(typeof logger.debug).toBe("function");
      expect(() => logger.debug("test debug")).not.toThrow();
    });

    test("should support structured logging with context object", async () => {
      const { logger } = await import("./logger");

      // Should not throw with structured logging
      expect(() =>
        logger.info({ url: "https://example.com", attempt: 1 }, "Loading game"),
      ).not.toThrow();

      expect(() =>
        logger.error({ error: new Error("test"), code: 500 }, "Request failed"),
      ).not.toThrow();
    });
  });

  describe("pino-pretty transport", () => {
    test("should import without errors when pino-pretty is available", async () => {
      // This test verifies that the logger can be imported successfully
      // which means pino-pretty transport is configured correctly
      await expect(import("./logger")).resolves.toBeDefined();
    });
  });

  describe("integration with config module", () => {
    test("should use config.logging.level from config module", async () => {
      process.env.LOG_LEVEL = "debug";

      const { config } = await import("./config");
      const { logger } = await import("./logger");

      expect(config.logging.level).toBe("debug");
      expect(logger.level).toBe("debug");
    });

    test("should reflect config defaults when LOG_LEVEL not set", async () => {
      delete process.env.LOG_LEVEL;

      const { config } = await import("./config");
      const { logger } = await import("./logger");

      expect(config.logging.level).toBe("info");
      expect(logger.level).toBe("info");
    });
  });
});
