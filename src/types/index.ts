/**
 * Centralized type exports for Denethor.
 *
 * This barrel file re-exports all shared types used across the application.
 * Use `import type { TypeName} from '@/types'` to import types in components.
 *
 * @module types
 */

// Configuration types
export type { Config } from "./config";
// QA Report types
export type {
  Action,
  ActionResult,
  BrowserAction,
  Evidence,
  Issue,
  PlayabilityScores,
  QAReport,
  TestMetadata,
} from "./qaReport";
