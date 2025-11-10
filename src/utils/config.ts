import { ValidationError } from "../errors/validationError";

/**
 * Centralized configuration module for environment variable management.
 * All environment variables should be accessed through this module, never directly via process.env.
 *
 * @throws {ValidationError} If any required environment variable is missing or empty
 */
export const config = {
  browserbase: {
    apiKey: process.env.BROWSERBASE_API_KEY as string,
    projectId: process.env.BROWSERBASE_PROJECT_ID as string,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY as string,
  },
  output: {
    dir: process.env.OUTPUT_DIR || "./qa-tests/default",
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
};

/**
 * Validates that all required environment variables are present and non-empty.
 * Called at module load time to fail fast if configuration is incomplete.
 *
 * @param cfg - The config object to validate
 * @throws {ValidationError} If any required environment variable is missing or empty
 */
function validateConfig(cfg: typeof config): void {
  if (!cfg.browserbase.apiKey) {
    throw new ValidationError("BROWSERBASE_API_KEY is required");
  }

  if (!cfg.browserbase.projectId) {
    throw new ValidationError("BROWSERBASE_PROJECT_ID is required");
  }

  if (!cfg.openai.apiKey) {
    throw new ValidationError("OPENAI_API_KEY is required");
  }
}

// Validate configuration at module load time (fail fast)
// Skip validation in test mode to allow tests to set env vars first
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  validateConfig(config);
}
