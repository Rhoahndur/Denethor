/**
 * Configuration types for application settings and feature flags.
 *
 * These interfaces define the structure of the centralized configuration object
 * that manages environment variables and feature flags across the application.
 *
 * @module config
 */

/**
 * Complete application configuration structure.
 *
 * This interface defines all configuration sections including API credentials,
 * output settings, and feature flags. The actual config implementation lives
 * in src/utils/config.ts and accesses environment variables.
 *
 * @example
 * ```typescript
 * const config: Config = {
 *   browserbase: {
 *     apiKey: process.env.BROWSERBASE_API_KEY!,
 *     projectId: process.env.BROWSERBASE_PROJECT_ID!
 *   },
 *   openai: {
 *     apiKey: process.env.OPENAI_API_KEY!
 *   },
 *   output: {
 *     dir: process.env.OUTPUT_DIR || './output'
 *   },
 *   features: {
 *     ragEnabled: false
 *   }
 * }
 * ```
 */
export interface Config {
  /** Browserbase cloud browser service configuration */
  browserbase: {
    /** Browserbase API key */
    apiKey: string;
    /** Browserbase project ID */
    projectId: string;
  };
  /** OpenAI API configuration */
  openai: {
    /** OpenAI API key for GPT-4o/GPT-4o-mini */
    apiKey: string;
  };
  /** Output directory configuration */
  output: {
    /** Directory path for test results and reports */
    dir: string;
  };
  /** Feature flags for optional functionality */
  features: {
    /** Whether RAG augmentation is enabled (Layer 3 of hybrid strategy) */
    ragEnabled: boolean;
  };
}
