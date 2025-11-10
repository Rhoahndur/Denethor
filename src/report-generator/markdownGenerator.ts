/**
 * Markdown Report Generator
 *
 * Generates human-readable Markdown reports with structured sections, tables,
 * and emoji indicators for easy review.
 *
 * @module markdownGenerator
 *
 * @example
 * ```typescript
 * import { generateMarkdown } from '@/report-generator/markdownGenerator';
 * import type { QAReport } from '@/types';
 *
 * const report: QAReport = { ... };
 * await generateMarkdown(report, './output/report.md');
 * ```
 */

import { writeFile } from "node:fs/promises";
import type { Issue, QAReport } from "@/types";
import { logger } from "@/utils/logger";

const log = logger.child({ component: "MarkdownGenerator" });

/**
 * Generates a Markdown report from a QAReport and saves it to the specified path.
 *
 * The output includes the following sections:
 * 1. Summary - Test metadata and duration
 * 2. Playability Scores - Formatted as a table
 * 3. Evaluation - AI reasoning and confidence
 * 4. Issues - Grouped by severity with emoji indicators
 * 5. Actions Taken - List of all actions performed
 * 6. Evidence - Links to screenshots
 *
 * @param report - Complete QA report to format
 * @param outputPath - Full path where Markdown file will be saved
 * @throws Error if file write fails
 *
 * @example
 * ```typescript
 * await generateMarkdown(report, './output/report.md');
 * ```
 */
export async function generateMarkdown(
  report: QAReport,
  outputPath: string,
): Promise<void> {
  const startTime = Date.now();

  log.debug(
    {
      testId: report.meta.testId,
      outputPath,
    },
    "Generating Markdown report",
  );

  try {
    const content = buildMarkdownContent(report);

    // Write to file using Node.js fs API for cross-runtime compatibility
    await writeFile(outputPath, content, "utf-8");

    const duration = Date.now() - startTime;
    const sizeBytes = Buffer.byteLength(content, "utf-8");

    log.info(
      {
        testId: report.meta.testId,
        outputPath,
        duration,
        sizeBytes,
      },
      "Successfully generated Markdown report",
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
      "Failed to generate Markdown report",
    );

    throw new Error(`Failed to generate Markdown report: ${err.message}`);
  }
}

/**
 * Builds the complete Markdown content from a QAReport.
 *
 * @param report - QA report to format
 * @returns Formatted Markdown string
 * @private
 */
function buildMarkdownContent(report: QAReport): string {
  const sections = [
    buildHeader(report),
    buildSummary(report),
    buildScoresTable(report),
    buildEvaluation(report),
    buildIssues(report),
    buildActions(report),
    buildEvidence(report),
  ];

  // Add optional metrics sections if available
  if (report.progressMetrics) {
    sections.push(buildProgressMetrics(report));
  }
  if (report.timingMetrics) {
    sections.push(buildTimingMetrics(report));
  }

  return sections.join("\n\n---\n\n");
}

/**
 * Builds the report header.
 *
 * @param report - QA report
 * @returns Markdown header
 * @private
 */
function buildHeader(report: QAReport): string {
  return `# QA Test Report

**Test ID:** ${report.meta.testId}
**Game URL:** ${report.meta.gameUrl}
**Status:** ${report.status.toUpperCase()}
**Generated:** ${report.meta.timestamp}`;
}

/**
 * Builds the summary section with test metadata.
 *
 * @param report - QA report
 * @returns Markdown summary section
 * @private
 */
function buildSummary(report: QAReport): string {
  const durationMinutes = Math.floor(report.meta.duration / 60);
  const durationSeconds = report.meta.duration % 60;

  return `## Summary

- **Duration:** ${durationMinutes}m ${durationSeconds}s
- **Agent Version:** ${report.meta.agentVersion}
- **Overall Playability:** ${report.scores.overallPlayability}/100`;
}

/**
 * Builds the playability scores table.
 *
 * @param report - QA report
 * @returns Markdown table with scores
 * @private
 */
function buildScoresTable(report: QAReport): string {
  return `## Playability Scores

| Dimension | Score | Status |
|-----------|-------|--------|
| Load Success | ${report.scores.loadSuccess}/100 | ${getScoreStatus(report.scores.loadSuccess)} |
| Responsiveness | ${report.scores.responsiveness}/100 | ${getScoreStatus(report.scores.responsiveness)} |
| Stability | ${report.scores.stability}/100 | ${getScoreStatus(report.scores.stability)} |
| **Overall Playability** | **${report.scores.overallPlayability}/100** | **${getScoreStatus(report.scores.overallPlayability)}** |`;
}

/**
 * Gets status emoji based on score.
 *
 * @param score - Score value (0-100)
 * @returns Status string with emoji
 * @private
 */
function getScoreStatus(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}

/**
 * Builds the evaluation section with AI reasoning and confidence.
 *
 * @param report - QA report
 * @returns Markdown evaluation section
 * @private
 */
function buildEvaluation(report: QAReport): string {
  return `## Evaluation

**Confidence:** ${report.evaluation.confidence}%

${report.evaluation.reasoning}`;
}

/**
 * Builds the issues section, grouped by severity with emoji indicators.
 *
 * @param report - QA report
 * @returns Markdown issues section
 * @private
 */
function buildIssues(report: QAReport): string {
  if (report.issues.length === 0) {
    return `## Issues

No issues detected.`;
  }

  // Group issues by severity
  const critical = report.issues.filter((i) => i.severity === "critical");
  const major = report.issues.filter((i) => i.severity === "major");
  const minor = report.issues.filter((i) => i.severity === "minor");

  const sections: string[] = ["## Issues"];

  if (critical.length > 0) {
    sections.push("### Critical Issues");
    sections.push(...critical.map((issue) => formatIssue(issue, "critical")));
  }

  if (major.length > 0) {
    sections.push("### Major Issues");
    sections.push(...major.map((issue) => formatIssue(issue, "major")));
  }

  if (minor.length > 0) {
    sections.push("### Minor Issues");
    sections.push(...minor.map((issue) => formatIssue(issue, "minor")));
  }

  return sections.join("\n\n");
}

/**
 * Formats a single issue with emoji indicator.
 *
 * @param issue - Issue to format
 * @param severity - Issue severity
 * @returns Formatted issue string
 * @private
 */
function formatIssue(
  issue: Issue,
  severity: "critical" | "major" | "minor",
): string {
  const emoji =
    severity === "critical" ? "🔴" : severity === "major" ? "🟡" : "🟢";
  let formatted = `${emoji} **${issue.category}:** ${issue.description}`;

  if (issue.screenshot) {
    formatted += `\n  - Evidence: \`${issue.screenshot}\``;
  }

  return formatted;
}

/**
 * Builds the actions section with all actions taken during test.
 *
 * @param report - QA report
 * @returns Markdown actions section
 * @private
 */
function buildActions(report: QAReport): string {
  if (report.actions.length === 0) {
    return `## Actions Taken

No actions recorded.`;
  }

  const actionsList = report.actions
    .map((action) => {
      const status = action.success ? "✓" : "✗";
      const details = action.details ? ` - ${action.details}` : "";
      return `- ${status} **${action.type}** (${action.timestamp})${details}`;
    })
    .join("\n");

  return `## Actions Taken

${actionsList}`;
}

/**
 * Builds the evidence section with links to screenshots and logs.
 *
 * @param report - QA report
 * @returns Markdown evidence section
 * @private
 */
function buildEvidence(report: QAReport): string {
  const sections: string[] = ["## Evidence"];

  // Screenshots
  if (report.evidence.screenshots.length > 0) {
    sections.push("### Screenshots");
    const screenshotsList = report.evidence.screenshots
      .map((path, index) => `${index + 1}. \`${path}\``)
      .join("\n");
    sections.push(screenshotsList);
  }

  // Logs
  sections.push("### Logs");
  sections.push(`- **Console Log:** \`${report.evidence.logs.console}\``);
  sections.push(`- **Actions Log:** \`${report.evidence.logs.actions}\``);
  sections.push(`- **Errors Log:** \`${report.evidence.logs.errors}\``);

  return sections.join("\n\n");
}

/**
 * Builds the progress metrics section showing game progression insights.
 *
 * @param report - QA report
 * @returns Markdown progress metrics section
 * @private
 */
function buildProgressMetrics(report: QAReport): string {
  if (!report.progressMetrics) {
    return "";
  }

  const metrics = report.progressMetrics;

  return `## Progress Metrics

| Metric | Value |
|--------|-------|
| Unique States Seen | ${metrics.uniqueStates} |
| Total Actions | ${metrics.totalActions} |
| Successful Actions | ${metrics.successfulActions} |
| Input Success Rate | ${metrics.inputSuccessRate.toFixed(1)}% |`;
}

/**
 * Builds the timing metrics section showing action performance insights.
 *
 * @param report - QA report
 * @returns Markdown timing metrics section
 * @private
 */
function buildTimingMetrics(report: QAReport): string {
  if (!report.timingMetrics) {
    return "";
  }

  const metrics = report.timingMetrics;

  return `## Timing Metrics

| Metric | Value |
|--------|-------|
| Total Timed Actions | ${metrics.totalTimedActions} |
| Average Duration | ${metrics.averageDurationMs}ms |
| Min Duration | ${metrics.minDurationMs}ms |
| Max Duration | ${metrics.maxDurationMs}ms |
| Total Duration | ${metrics.totalDurationMs}ms |
| Slow Actions (>5s) | ${metrics.slowActionsCount} |`;
}
