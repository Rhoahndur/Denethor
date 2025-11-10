/**
 * Version Utility - Provides the current agent version from package.json.
 *
 * This module reads the version from package.json once and caches it for
 * subsequent calls. Used by QA reports, evidence stores, and metadata.
 *
 * @module version
 *
 * @example
 * ```typescript
 * import { getVersion } from '@/utils/version';
 *
 * const version = getVersion();
 * console.log(`Agent version: ${version}`); // "1.0.0"
 * ```
 */

import packageJson from "../../package.json";

/**
 * Cached version string read from package.json.
 * Initialized once at module load time for performance.
 */
const VERSION = packageJson.version;

/**
 * Gets the current agent version from package.json.
 *
 * The version is read once at module initialization and cached
 * for all subsequent calls, avoiding repeated file I/O.
 *
 * @returns Version string in semver format (e.g., "1.0.0")
 *
 * @example
 * ```typescript
 * const version = getVersion();
 * // => "1.0.0"
 * ```
 */
export function getVersion(): string {
  return VERSION;
}
