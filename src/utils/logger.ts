import pino from "pino";
import { config } from "./config";

/**
 * Centralized Pino logger instance for structured logging.
 *
 * Usage in components:
 * ```typescript
 * import { logger } from '@/utils/logger'
 * const log = logger.child({ component: 'ComponentName' })
 *
 * log.info({ url, attempt: 1 }, 'Loading game')
 * log.error({ error, url }, 'Failed to load game')
 * log.debug({ action: 'click', selector }, 'Executing action')
 * log.warn({ retryCount: 2 }, 'Retrying action')
 * ```
 *
 * Log Level Usage:
 * - trace: Very detailed debugging information
 * - debug: Detailed action steps, state transitions
 * - info: Major milestones (test started, game loaded)
 * - warn: Retry attempts, recoverable issues
 * - error: Failures, exceptions thrown
 * - fatal: Critical errors that require immediate attention
 *
 * Rules:
 * - ALWAYS use structured logging: log.level({ context }, 'message')
 * - NEVER use console.log/console.error
 * - ALWAYS include relevant context (url, testId, action)
 * - Use child loggers for component context
 */
export const logger = pino({
  level: config.logging.level,
  transport: {
    target: "pino-pretty",
    options: { colorize: true },
  },
});
