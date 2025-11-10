import { afterEach, beforeEach, describe, expect, test } from "vitest";

describe("config module", () => {
  // Store original env vars (only the keys we care about)
  const originalEnv = {
    BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY,
    BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OUTPUT_DIR: process.env.OUTPUT_DIR,
    NODE_ENV: process.env.NODE_ENV,
    VITEST: process.env.VITEST,
  };

  beforeEach(() => {
    // Clear ONLY the config-related env vars (don't leak real API keys into tests)
    delete process.env.BROWSERBASE_API_KEY;
    delete process.env.BROWSERBASE_PROJECT_ID;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OUTPUT_DIR;
  });

  afterEach(() => {
    // Restore original env vars
    if (originalEnv.BROWSERBASE_API_KEY)
      process.env.BROWSERBASE_API_KEY = originalEnv.BROWSERBASE_API_KEY;
    if (originalEnv.BROWSERBASE_PROJECT_ID)
      process.env.BROWSERBASE_PROJECT_ID = originalEnv.BROWSERBASE_PROJECT_ID;
    if (originalEnv.OPENAI_API_KEY)
      process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
    if (originalEnv.OUTPUT_DIR) process.env.OUTPUT_DIR = originalEnv.OUTPUT_DIR;
    if (originalEnv.NODE_ENV) process.env.NODE_ENV = originalEnv.NODE_ENV;
    if (originalEnv.VITEST) process.env.VITEST = originalEnv.VITEST;
  });

  describe("config object structure", () => {
    test("should have browserbase section with apiKey and projectId", async () => {
      // Set up valid env vars
      process.env.BROWSERBASE_API_KEY = "test-api-key";
      process.env.BROWSERBASE_PROJECT_ID = "test-project-id";
      process.env.OPENAI_API_KEY = "test-openai-key";

      // Import config after setting env vars
      const { config } = await import("./config");

      expect(config.browserbase).toBeDefined();
      expect(config.browserbase.apiKey).toBe("test-api-key");
      expect(config.browserbase.projectId).toBe("test-project-id");
    });

    test("should have openai section with apiKey", async () => {
      // Set up valid env vars
      process.env.BROWSERBASE_API_KEY = "test-api-key";
      process.env.BROWSERBASE_PROJECT_ID = "test-project-id";
      process.env.OPENAI_API_KEY = "test-openai-key";

      const { config } = await import("./config");

      expect(config.openai).toBeDefined();
      expect(config.openai.apiKey).toBe("test-openai-key");
    });

    test("should have output section with dir", async () => {
      // Set up valid env vars
      process.env.BROWSERBASE_API_KEY = "test-api-key";
      process.env.BROWSERBASE_PROJECT_ID = "test-project-id";
      process.env.OPENAI_API_KEY = "test-openai-key";

      const { config } = await import("./config");

      expect(config.output).toBeDefined();
      expect(config.output.dir).toBeDefined();
    });
  });

  describe("environment variable loading", () => {
    test("should load BROWSERBASE_API_KEY from process.env", async () => {
      process.env.BROWSERBASE_API_KEY = "my-browserbase-key";
      process.env.BROWSERBASE_PROJECT_ID = "my-project-id";
      process.env.OPENAI_API_KEY = "my-openai-key";

      const { config } = await import("./config");

      expect(config.browserbase.apiKey).toBe("my-browserbase-key");
    });

    test("should load BROWSERBASE_PROJECT_ID from process.env", async () => {
      process.env.BROWSERBASE_API_KEY = "my-browserbase-key";
      process.env.BROWSERBASE_PROJECT_ID = "my-project-id";
      process.env.OPENAI_API_KEY = "my-openai-key";

      const { config } = await import("./config");

      expect(config.browserbase.projectId).toBe("my-project-id");
    });

    test("should load OPENAI_API_KEY from process.env", async () => {
      process.env.BROWSERBASE_API_KEY = "my-browserbase-key";
      process.env.BROWSERBASE_PROJECT_ID = "my-project-id";
      process.env.OPENAI_API_KEY = "my-openai-key";

      const { config } = await import("./config");

      expect(config.openai.apiKey).toBe("my-openai-key");
    });
  });

  describe("OUTPUT_DIR default value", () => {
    test("should default to './output' when OUTPUT_DIR is not set", async () => {
      process.env.BROWSERBASE_API_KEY = "test-key";
      process.env.BROWSERBASE_PROJECT_ID = "test-project";
      process.env.OPENAI_API_KEY = "test-openai";
      // Explicitly delete OUTPUT_DIR
      delete process.env.OUTPUT_DIR;

      const { config } = await import("./config");

      expect(config.output.dir).toBe("./output");
    });

    test("should use custom value when OUTPUT_DIR is set", async () => {
      process.env.BROWSERBASE_API_KEY = "test-key";
      process.env.BROWSERBASE_PROJECT_ID = "test-project";
      process.env.OPENAI_API_KEY = "test-openai";
      process.env.OUTPUT_DIR = "/custom/output/path";

      const { config } = await import("./config");

      expect(config.output.dir).toBe("/custom/output/path");
    });
  });

  describe("validation - missing required keys", () => {
    test("should throw ValidationError when BROWSERBASE_API_KEY is missing", async () => {
      // Delete BROWSERBASE_API_KEY
      delete process.env.BROWSERBASE_API_KEY;
      process.env.BROWSERBASE_PROJECT_ID = "test-project";
      process.env.OPENAI_API_KEY = "test-openai";
      // Set NODE_ENV to non-test to enable validation
      process.env.NODE_ENV = "production";
      delete process.env.VITEST;

      await expect(import("./config")).rejects.toThrowError(
        "BROWSERBASE_API_KEY is required",
      );
    });

    test("should throw ValidationError when BROWSERBASE_API_KEY is empty string", async () => {
      process.env.BROWSERBASE_API_KEY = "";
      process.env.BROWSERBASE_PROJECT_ID = "test-project";
      process.env.OPENAI_API_KEY = "test-openai";
      // Set NODE_ENV to non-test to enable validation
      process.env.NODE_ENV = "production";
      delete process.env.VITEST;

      await expect(import("./config")).rejects.toThrowError(
        "BROWSERBASE_API_KEY is required",
      );
    });

    test("should throw ValidationError when BROWSERBASE_PROJECT_ID is missing", async () => {
      process.env.BROWSERBASE_API_KEY = "test-key";
      delete process.env.BROWSERBASE_PROJECT_ID;
      process.env.OPENAI_API_KEY = "test-openai";
      // Set NODE_ENV to non-test to enable validation
      process.env.NODE_ENV = "production";
      delete process.env.VITEST;

      await expect(import("./config")).rejects.toThrowError(
        "BROWSERBASE_PROJECT_ID is required",
      );
    });

    test("should throw ValidationError when BROWSERBASE_PROJECT_ID is empty string", async () => {
      process.env.BROWSERBASE_API_KEY = "test-key";
      process.env.BROWSERBASE_PROJECT_ID = "";
      process.env.OPENAI_API_KEY = "test-openai";
      // Set NODE_ENV to non-test to enable validation
      process.env.NODE_ENV = "production";
      delete process.env.VITEST;

      await expect(import("./config")).rejects.toThrowError(
        "BROWSERBASE_PROJECT_ID is required",
      );
    });

    test("should throw ValidationError when OPENAI_API_KEY is missing", async () => {
      process.env.BROWSERBASE_API_KEY = "test-key";
      process.env.BROWSERBASE_PROJECT_ID = "test-project";
      delete process.env.OPENAI_API_KEY;
      // Set NODE_ENV to non-test to enable validation
      process.env.NODE_ENV = "production";
      delete process.env.VITEST;

      await expect(import("./config")).rejects.toThrowError(
        "OPENAI_API_KEY is required",
      );
    });

    test("should throw ValidationError when OPENAI_API_KEY is empty string", async () => {
      process.env.BROWSERBASE_API_KEY = "test-key";
      process.env.BROWSERBASE_PROJECT_ID = "test-project";
      process.env.OPENAI_API_KEY = "";
      // Set NODE_ENV to non-test to enable validation
      process.env.NODE_ENV = "production";
      delete process.env.VITEST;

      await expect(import("./config")).rejects.toThrowError(
        "OPENAI_API_KEY is required",
      );
    });
  });

  describe("validation - all required keys present", () => {
    test("should not throw when all required variables are present and non-empty", async () => {
      process.env.BROWSERBASE_API_KEY = "valid-key";
      process.env.BROWSERBASE_PROJECT_ID = "valid-project";
      process.env.OPENAI_API_KEY = "valid-openai";

      await expect(import("./config")).resolves.toBeDefined();
    });

    test("should import successfully with all required env vars", async () => {
      process.env.BROWSERBASE_API_KEY = "valid-key";
      process.env.BROWSERBASE_PROJECT_ID = "valid-project";
      process.env.OPENAI_API_KEY = "valid-openai";

      const { config } = await import("./config");

      expect(config).toBeDefined();
      expect(config.browserbase.apiKey).toBe("valid-key");
      expect(config.browserbase.projectId).toBe("valid-project");
      expect(config.openai.apiKey).toBe("valid-openai");
    });
  });

  describe("error message clarity", () => {
    test("should provide clear error message indicating which env var is missing", async () => {
      delete process.env.BROWSERBASE_API_KEY;
      process.env.BROWSERBASE_PROJECT_ID = "test-project";
      process.env.OPENAI_API_KEY = "test-openai";
      // Set NODE_ENV to non-test to enable validation
      process.env.NODE_ENV = "production";
      delete process.env.VITEST;

      await expect(import("./config")).rejects.toThrowError(
        /BROWSERBASE_API_KEY/,
      );
    });
  });
});
