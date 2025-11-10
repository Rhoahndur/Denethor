/**
 * Report Generator Core Module
 *
 * Orchestrates the generation of QA reports in multiple formats (JSON, Markdown, HTML).
 * Takes a QAReport and EvidenceStore, generates all three report formats in parallel,
 * and saves them to the reports directory.
 *
 * @module reportGenerator
 *
 * @example
 * ```typescript
 * import { ReportGenerator } from '@/report-generator/reportGenerator';
 * import type { QAReport } from '@/types';
 *
 * const generator = new ReportGenerator(qaReport, evidenceStore);
 * const reportPaths = await generator.generateAll();
 * // => { json: '...', markdown: '...', html: '...' }
 * ```
 */

import { join, resolve } from "node:path";
import type { EvidenceStore } from "@/evidence-store/evidenceStore";
import type { QAReport } from "@/types";
import { logger } from "@/utils/logger";
import { generateHTML } from "./htmlGenerator";
import { generateJSON } from "./jsonGenerator";
import { generateMarkdown } from "./markdownGenerator";

const log = logger.child({ component: "ReportGenerator" });

/**
 * Report file paths for all generated formats.
 * All paths are absolute for easy access.
 */
export interface ReportPaths {
  /** Absolute path to JSON report */
  json: string;
  /** Absolute path to Markdown report */
  markdown: string;
  /** Absolute path to HTML report */
  html: string;
}

/**
 * Report Generator class that orchestrates multi-format report generation.
 *
 * This class takes a complete QAReport and EvidenceStore, generates reports in
 * JSON, Markdown, and HTML formats in parallel, and saves them to the evidence
 * store's reports directory.
 *
 * @example
 * ```typescript
 * const generator = new ReportGenerator(qaReport, evidenceStore);
 * const paths = await generator.generateAll();
 * console.log(paths.json); // Path to report.json
 * console.log(paths.markdown); // Path to report.md
 * console.log(paths.html); // Path to report.html
 * ```
 */
export class ReportGenerator {
  /** The QA report to generate from */
  private readonly qaReport: QAReport;

  /** Reports directory path */
  private readonly reportsDir: string;

  /**
   * Creates a new ReportGenerator instance.
   *
   * @param qaReport - Complete QA test report
   * @param evidenceStore - Evidence store with screenshots and logs
   *
   * @example
   * ```typescript
   * const generator = new ReportGenerator(qaReport, evidenceStore);
   * ```
   */
  constructor(qaReport: QAReport, evidenceStore: EvidenceStore) {
    this.qaReport = qaReport;
    this.reportsDir = evidenceStore.getReportsDirectory();

    log.debug(
      {
        testId: qaReport.meta.testId,
        reportsDir: this.reportsDir,
      },
      "ReportGenerator instance created",
    );
  }

  /**
   * Generates all report formats in parallel and saves them to the reports directory.
   *
   * This method:
   * 1. Calls generateJSON(), generateMarkdown(), and generateHTML() in parallel
   * 2. Saves all reports to {evidenceStore.reportsDir}/
   * 3. Returns object with paths to all generated reports
   *
   * @returns Promise resolving to object with paths to all generated reports
   * @throws Error if any report generation fails
   *
   * @example
   * ```typescript
   * const generator = new ReportGenerator(qaReport, evidenceStore);
   * const reportPaths = await generator.generateAll();
   * console.log(reportPaths.json); // '/Users/.../output/.../reports/report.json'
   * console.log(reportPaths.markdown); // '/Users/.../output/.../reports/report.md'
   * console.log(reportPaths.html); // '/Users/.../output/.../reports/report.html'
   * ```
   */
  async generateAll(): Promise<ReportPaths> {
    const startTime = Date.now();

    log.info(
      {
        testId: this.qaReport.meta.testId,
        reportsDir: this.reportsDir,
      },
      "Starting parallel report generation",
    );

    try {
      // Define output paths for each format
      const jsonPath = join(this.reportsDir, "report.json");
      const markdownPath = join(this.reportsDir, "report.md");
      const htmlPath = join(this.reportsDir, "report.html");

      // Generate all formats in parallel
      await Promise.all([
        generateJSON(this.qaReport, jsonPath),
        generateMarkdown(this.qaReport, markdownPath),
        generateHTML(this.qaReport, htmlPath),
      ]);

      const duration = Date.now() - startTime;

      // Convert to absolute paths for easier access
      const absolutePaths = {
        json: resolve(jsonPath),
        markdown: resolve(markdownPath),
        html: resolve(htmlPath),
      };

      log.info(
        {
          testId: this.qaReport.meta.testId,
          duration,
          jsonPath: absolutePaths.json,
          markdownPath: absolutePaths.markdown,
          htmlPath: absolutePaths.html,
        },
        "Successfully generated all report formats",
      );

      return absolutePaths;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const duration = Date.now() - startTime;

      log.error(
        {
          error: err.message,
          testId: this.qaReport.meta.testId,
          duration,
        },
        "Failed to generate reports",
      );

      throw new Error(`Failed to generate reports: ${err.message}`);
    }
  }
}
