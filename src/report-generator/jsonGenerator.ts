/**
 * JSON Report Generator
 *
 * Generates machine-readable JSON reports that match the QAReport interface exactly.
 * Output is pretty-printed with 2-space indentation for readability.
 *
 * @module jsonGenerator
 *
 * @example
 * ```typescript
 * import { generateJSON } from '@/report-generator/jsonGenerator';
 * import type { QAReport } from '@/types';
 *
 * const report: QAReport = { ... };
 * await generateJSON(report, './output/report.json');
 * ```
 */

import { writeFile } from "node:fs/promises";
import type { QAReport } from "@/types";
import { logger } from "@/utils/logger";

const log = logger.child({ component: "JSONGenerator" });

/**
 * Generates a JSON report from a QAReport and saves it to the specified path.
 *
 * The output JSON format matches the QAReport interface exactly and includes:
 * - Test metadata (testId, gameUrl, timestamp, duration, agentVersion)
 * - Test status (success | failure | error)
 * - Playability scores (loadSuccess, responsiveness, stability, overallPlayability)
 * - AI evaluation (reasoning, confidence)
 * - Issues detected (severity, category, description, screenshot)
 * - Evidence collected (screenshots, logs)
 * - Actions taken (type, timestamp, success, details)
 *
 * The JSON is pretty-printed with 2-space indentation for human readability
 * while maintaining full machine-readability.
 *
 * @param report - Complete QA report to serialize
 * @param outputPath - Full path where JSON file will be saved
 * @throws Error if file write fails
 *
 * @example
 * ```typescript
 * const report: QAReport = {
 *   meta: { testId: 'abc', gameUrl: 'https://game.com', ... },
 *   status: 'success',
 *   scores: { loadSuccess: 100, ... },
 *   evaluation: { reasoning: '...', confidence: 95 },
 *   issues: [],
 *   evidence: { screenshots: [...], logs: {...} },
 *   actions: [...]
 * };
 *
 * await generateJSON(report, './output/report.json');
 * ```
 */
export async function generateJSON(
  report: QAReport,
  outputPath: string,
): Promise<void> {
  const startTime = Date.now();

  log.debug(
    {
      testId: report.meta.testId,
      outputPath,
    },
    "Generating JSON report",
  );

  try {
    // Serialize QAReport to JSON with 2-space indentation
    const jsonContent = JSON.stringify(report, null, 2);

    // Write to file using Node.js fs API for cross-runtime compatibility
    await writeFile(outputPath, jsonContent, "utf-8");

    const duration = Date.now() - startTime;
    const sizeBytes = Buffer.byteLength(jsonContent, "utf-8");

    log.info(
      {
        testId: report.meta.testId,
        outputPath,
        duration,
        sizeBytes,
      },
      "Successfully generated JSON report",
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const duration = Date.now() - startTime;

    log.error(
      {
        error: err.message,
        testId: report.meta.testId,
        outputPath,
        duration,
      },
      "Failed to generate JSON report",
    );

    throw new Error(`Failed to generate JSON report: ${err.message}`);
  }
}
