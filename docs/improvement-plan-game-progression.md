# QA Game Progression Improvement Plan

**Date:** 2025-11-06
**Status:** Ready for Implementation
**Development Approach:** Parallel execution across 4 agents
**Estimated Total Time:** 6-8 hours (with parallelization)

---

## Executive Summary

**Problem:** QA tests complete as "success" but agent gets stuck at start screens, executes 0 gameplay actions, spends 2.5min in retry loops, then gives up.

**Root Cause:**
1. "Wait" actions incorrectly treated as crashes → enters retry hell
2. Unstick logic uses blind center-clicking instead of intelligent vision/DOM analysis
3. No progress detection (screen changes, state transitions)
4. Missing iframe handling for itch.io games

**Solution:** 3-phase implementation with 4 parallel work streams

---

## Current State Analysis

### Existing Capabilities (GOOD)
✅ **DOM Analysis (Layer 0.5)** - Already implemented in `browserAgent.ts:439-572`
  - Extracts buttons, links, inputs, canvases, headings, clickable text
  - Canvas detection with `isPrimaryGame` heuristic
  - Viewport dimensions
  - Interactive element count
  - **Already passed to vision analyzer** via `domAnalysis` parameter

✅ **Vision Analysis (Layer 2)** - Uses GPT-4o with DOM context
  - Receives DOM analysis in prompt (`visionAnalyzer.ts:299-337`)
  - Can identify buttons from DOM without visual detection
  - Cost-effective (~$0.0015 per call)

✅ **Hybrid Strategy** - 3-layer architecture is sound
  - Layer 1: Heuristics (fast, free)
  - Layer 2: Vision + DOM (intelligent, low cost)
  - Layer 3: RAG (future)

### Critical Gaps (NEEDS FIXING)
❌ **No Progress Detection** - Can't tell if screen is changing
❌ **Wait = Crash Logic** - Line 567 in `qaOrchestrator.ts` triggers retry hell
❌ **Blind Unstick** - Lines 629-750 just click center, ignore DOM/vision
❌ **No Iframe Handling** - Can't interact with itch.io embedded games
❌ **No Keyboard Strategy** - Only tries clicking, many games need keys
❌ **No State Verification** - Doesn't check if actions had effect

---

## Implementation Phases

### Phase 3: Quick Win POC (30 minutes - HIGHEST PRIORITY)
**Agent:** BMad Dev Agent #1
**File:** `src/orchestrator/qaOrchestrator.ts`
**Lines:** 567-583
**Goal:** Stop treating "wait" as crash, let tests progress

### Phase 2: Enhanced Progress Detection (3 hours - PARALLEL TRACK A)
**Agent:** BMad Dev Agent #2
**Files:** Multiple (new utilities + orchestrator integration)
**Goal:** Track screen changes, state transitions, input effectiveness

### Phase 1: Intelligent Unstick (4 hours - PARALLEL TRACK B)
**Agent:** BMad Dev Agent #3
**Files:** `qaOrchestrator.ts` unstick logic + new helpers
**Goal:** Use vision/DOM to find actual buttons, verify actions worked

### Documentation & Testing (2 hours - PARALLEL TRACK C)
**Agent:** BMad Paige (Documentation Agent)
**Files:** Architecture, test fixtures, troubleshooting guide
**Goal:** Document changes, update tests, create examples

---

## Detailed Technical Specifications

---

## PHASE 3: Quick Win POC (30 min)

### Agent Assignment
**Agent:** BMad Dev Agent #1
**Priority:** CRITICAL - Do this first
**Blocking:** None - independent work
**Dependencies:** None

### Objective
Fix the logic that treats "wait" actions as game crashes, allowing tests to progress past loading screens.

### Current Code (BROKEN)
**File:** `src/orchestrator/qaOrchestrator.ts`
**Lines:** 567-583

```typescript
// CURRENT - BROKEN LOGIC
if (
  (strategyResult.actionType === "wait" ||
    strategyResult.actionType === "unknown") &&
  strategyResult.confidence < 80
) {
  isFirstActionLoading = true; // ← ENTERS 2.5min RETRY HELL
  log.warn(
    {
      testId: this.testId,
      actionType: strategyResult.actionType,
      confidence: strategyResult.confidence,
    },
    "First action failed - game may be loading, will retry with progressive waits",
  );
}
```

**Problem:** "wait" is a valid action (game is loading), not a failure. This logic immediately enters the retry/unstick loop and wastes 2.5 minutes.

### Detailed Changes Required

#### Change 1.1: Separate "wait" from "unknown"
**Lines to modify:** 567-583

**New Logic:**
```typescript
// "wait" is valid - game is just loading
if (strategyResult.actionType === "wait") {
  log.info(
    {
      testId: this.testId,
      confidence: strategyResult.confidence,
      reasoning: strategyResult.reasoning,
    },
    "First action is wait - game appears to be loading, will wait and retry",
  );

  // Wait the recommended time (or default 5s)
  const waitTime = 5000;
  await new Promise((resolve) => setTimeout(resolve, waitTime));

  // Capture screenshot after waiting to see if anything changed
  const afterWaitScreenshot = await page.screenshot();
  await browserAgent
    .getEvidenceStore()
    .captureScreenshot(afterWaitScreenshot, "after-initial-wait");

  // Don't enter retry loop - just continue to next action attempt
  // Will naturally retry via the main action loop
  continue; // ← KEY CHANGE: Skip to next iteration, don't mark as loading
}

// Only treat "unknown" with very low confidence as potential crash
if (
  strategyResult.actionType === "unknown" &&
  strategyResult.confidence < 40  // ← Lowered threshold
) {
  isFirstActionLoading = true;
  log.warn(
    {
      testId: this.testId,
      confidence: strategyResult.confidence,
      reasoning: strategyResult.reasoning,
    },
    "First action completely uncertain - game may be stuck, will attempt unstick",
  );
}
```

#### Change 1.2: Try to execute low-confidence actions anyway
**Lines to add:** After 583

```typescript
// Even if confidence is low, try executing the action
// Many times the strategy is correct even with low confidence
if (
  strategyResult.confidence >= 30 && // Very low bar
  strategyResult.actionType !== "wait" &&
  strategyResult.actionType !== "unknown"
) {
  log.info(
    {
      testId: this.testId,
      actionType: strategyResult.actionType,
      confidence: strategyResult.confidence,
    },
    "Attempting action despite low confidence - may work anyway",
  );

  try {
    const executionResult = await browserAgent.executeAction({
      type: strategyResult.actionType,
      target: strategyResult.target,
      details: strategyResult.action,
    });

    if (executionResult.success) {
      log.info(
        { testId: this.testId },
        "Low-confidence action succeeded! Continuing normal flow",
      );
      actions.push({
        type: strategyResult.actionType,
        timestamp: new Date().toISOString(),
        success: true,
        details: strategyResult.action,
        confidence: strategyResult.confidence,
      });

      // Action worked - don't enter retry loop
      isFirstActionLoading = false;
      continue; // Skip retry logic
    }
  } catch (error) {
    log.warn(
      {
        testId: this.testId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Low-confidence action failed - will enter retry logic",
    );
    // Fall through to retry logic below
  }
}
```

### Testing Requirements
**Test File:** `tests/integration/first-action-handling.test.ts` (NEW)

```typescript
describe("First Action Handling", () => {
  it("should not enter retry loop when action is 'wait'", async () => {
    // Mock hybrid strategy to return "wait"
    vi.spyOn(actionStrategy, "executeHybridStrategy").mockResolvedValue({
      layer: 2,
      action: "Wait for game to load",
      actionType: "wait",
      confidence: 75,
      reasoning: "Game is loading assets",
    });

    const orchestrator = new QAOrchestrator({ gameUrl: "https://example.com" });
    const result = await orchestrator.runTest();

    // Should NOT have crash-detected in actions
    expect(result.report.actions).not.toContainEqual(
      expect.objectContaining({ type: "crash-detected" })
    );
  });

  it("should attempt low-confidence actions anyway", async () => {
    vi.spyOn(actionStrategy, "executeHybridStrategy").mockResolvedValue({
      layer: 1,
      action: "Click start button",
      actionType: "click",
      target: "#start",
      confidence: 35, // Low but not terrible
      reasoning: "Detected button via heuristic",
    });

    const executeSpy = vi.spyOn(BrowserAgent.prototype, "executeAction");

    const orchestrator = new QAOrchestrator({ gameUrl: "https://example.com" });
    await orchestrator.runTest();

    // Should have attempted the action
    expect(executeSpy).toHaveBeenCalled();
  });
});
```

### Success Criteria
- ✅ Tests no longer enter 2.5min retry loop for "wait" actions
- ✅ Tests execute at least 1 action before giving up
- ✅ "wait" actions log as INFO, not WARN
- ✅ Action logs show progression, not just unstick attempts
- ✅ Unit tests pass for new logic

### Estimated Time
- Code changes: 15 minutes
- Testing: 10 minutes
- Verification: 5 minutes
**Total: 30 minutes**

### Deliverables
1. Modified `qaOrchestrator.ts` (lines 567-620)
2. New test file `first-action-handling.test.ts`
3. Run real test to verify progression

---

## PHASE 2: Enhanced Progress Detection (3 hours)

### Agent Assignment
**Agent:** BMad Dev Agent #2
**Priority:** HIGH - Start in parallel with Phase 3
**Blocking:** None - independent implementation
**Dependencies:** None (can merge after Phase 3)

### Objective
Add comprehensive progress tracking to detect if game state is actually changing between actions, enabling smarter decision-making during test execution.

### Architecture

#### New File: `src/utils/progressDetector.ts`

**Purpose:** Centralized progress tracking and screenshot comparison

**Exports:**
```typescript
export interface ProgressMetrics {
  screenshotsWithChanges: number;
  screenshotsIdentical: number;
  consecutiveIdentical: number;
  uniqueGameStates: number;
  inputsAttempted: number;
  inputsSuccessful: number;
  progressScore: number; // 0-100 based on inputsSuccessful/inputsAttempted
}

export class ProgressDetector {
  constructor();

  // Core functionality
  recordScreenshot(screenshot: Buffer, actionType: string): boolean; // Returns: changed
  getMetrics(): ProgressMetrics;
  isStuck(): boolean; // True if 5+ consecutive identical screenshots

  // Helper utilities
  reset(): void;
  getLastScreenshotHash(): string | null;
}

// Utility functions
export function hashBuffer(buffer: Buffer): string;
export function buffersEqual(buf1: Buffer, buf2: Buffer): boolean;
export function calculateProgressScore(metrics: ProgressMetrics): number;
```

### Detailed Implementation

#### File 2.1: `src/utils/progressDetector.ts` (NEW)

```typescript
/**
 * Progress Detector - Tracks game state changes during QA testing.
 *
 * Monitors screenshot changes to determine if the game is responsive
 * and progressing, or stuck on the same screen.
 *
 * @module progressDetector
 */

import { createHash } from "node:crypto";
import { logger } from "./logger";

const log = logger.child({ component: "ProgressDetector" });

/**
 * Metrics tracking game progress during testing.
 */
export interface ProgressMetrics {
  /** Number of screenshots that showed visual changes */
  screenshotsWithChanges: number;

  /** Number of screenshots identical to previous */
  screenshotsIdentical: number;

  /** Current streak of consecutive identical screenshots */
  consecutiveIdentical: number;

  /** Number of unique visual game states seen */
  uniqueGameStates: number;

  /** Total inputs/actions attempted */
  inputsAttempted: number;

  /** Number of inputs that caused visible changes */
  inputsSuccessful: number;

  /** Progress score 0-100 (percentage of successful inputs) */
  progressScore: number;

  /** List of all unique screenshot hashes seen */
  seenStates: Set<string>;
}

/**
 * Progress Detector for monitoring game state changes.
 *
 * Tracks screenshots between actions to determine if the game
 * is responding to input or stuck on the same screen.
 *
 * @example
 * ```typescript
 * const detector = new ProgressDetector();
 *
 * const screenshot1 = await page.screenshot();
 * const changed = detector.recordScreenshot(screenshot1, "click");
 *
 * if (detector.isStuck()) {
 *   console.log("Game appears stuck - try different input");
 * }
 * ```
 */
export class ProgressDetector {
  private metrics: ProgressMetrics;
  private lastScreenshotHash: string | null = null;

  constructor() {
    this.metrics = {
      screenshotsWithChanges: 0,
      screenshotsIdentical: 0,
      consecutiveIdentical: 0,
      uniqueGameStates: 0,
      inputsAttempted: 0,
      inputsSuccessful: 0,
      progressScore: 0,
      seenStates: new Set<string>(),
    };
  }

  /**
   * Records a screenshot and checks if it differs from previous.
   *
   * @param screenshot - Screenshot buffer to analyze
   * @param actionType - Type of action that preceded this screenshot
   * @returns true if screenshot changed, false if identical to previous
   */
  recordScreenshot(screenshot: Buffer, actionType: string): boolean {
    this.metrics.inputsAttempted++;

    const currentHash = hashBuffer(screenshot);

    // First screenshot - nothing to compare to
    if (this.lastScreenshotHash === null) {
      this.lastScreenshotHash = currentHash;
      this.metrics.seenStates.add(currentHash);
      this.metrics.uniqueGameStates = this.metrics.seenStates.size;

      log.debug({ hash: currentHash }, "First screenshot recorded");
      return true; // Consider first screenshot as "changed"
    }

    // Compare to previous
    const changed = currentHash !== this.lastScreenshotHash;

    if (changed) {
      this.metrics.screenshotsWithChanges++;
      this.metrics.consecutiveIdentical = 0; // Reset streak
      this.metrics.inputsSuccessful++;

      // Track unique states
      const isNewState = !this.metrics.seenStates.has(currentHash);
      this.metrics.seenStates.add(currentHash);
      this.metrics.uniqueGameStates = this.metrics.seenStates.size;

      log.info(
        {
          actionType,
          hash: currentHash,
          isNewState,
          uniqueStates: this.metrics.uniqueGameStates,
        },
        "Screenshot changed - game is responsive",
      );
    } else {
      this.metrics.screenshotsIdentical++;
      this.metrics.consecutiveIdentical++;

      log.warn(
        {
          actionType,
          consecutiveIdentical: this.metrics.consecutiveIdentical,
        },
        "Screenshot unchanged - game may be stuck",
      );
    }

    this.lastScreenshotHash = currentHash;
    this.metrics.progressScore = calculateProgressScore(this.metrics);

    return changed;
  }

  /**
   * Checks if game appears stuck based on consecutive identical screenshots.
   *
   * @param threshold - Number of consecutive identical screenshots to consider stuck (default: 5)
   * @returns true if game is stuck
   */
  isStuck(threshold = 5): boolean {
    return this.metrics.consecutiveIdentical >= threshold;
  }

  /**
   * Gets current progress metrics.
   *
   * @returns Progress metrics object
   */
  getMetrics(): ProgressMetrics {
    return {
      ...this.metrics,
      seenStates: new Set(this.metrics.seenStates), // Return copy
    };
  }

  /**
   * Gets hash of last recorded screenshot.
   *
   * @returns Screenshot hash or null if no screenshots recorded
   */
  getLastScreenshotHash(): string | null {
    return this.lastScreenshotHash;
  }

  /**
   * Resets all metrics (useful for testing).
   */
  reset(): void {
    this.metrics = {
      screenshotsWithChanges: 0,
      screenshotsIdentical: 0,
      consecutiveIdentical: 0,
      uniqueGameStates: 0,
      inputsAttempted: 0,
      inputsSuccessful: 0,
      progressScore: 0,
      seenStates: new Set<string>(),
    };
    this.lastScreenshotHash = null;
  }
}

/**
 * Hashes a buffer using SHA-256.
 *
 * @param buffer - Buffer to hash
 * @returns Hex string hash
 */
export function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Compares two buffers for equality.
 *
 * @param buf1 - First buffer
 * @param buf2 - Second buffer
 * @returns true if buffers are identical
 */
export function buffersEqual(buf1: Buffer, buf2: Buffer): boolean {
  return Buffer.compare(buf1, buf2) === 0;
}

/**
 * Calculates progress score 0-100 based on metrics.
 *
 * @param metrics - Progress metrics
 * @returns Score 0-100
 */
export function calculateProgressScore(metrics: ProgressMetrics): number {
  if (metrics.inputsAttempted === 0) return 0;

  const successRate = (metrics.inputsSuccessful / metrics.inputsAttempted) * 100;

  // Bonus for seeing multiple unique states
  const uniqueStateBonus = Math.min(metrics.uniqueGameStates * 5, 20);

  const score = Math.min(successRate + uniqueStateBonus, 100);

  return Math.round(score);
}
```

#### File 2.2: Integration into `qaOrchestrator.ts`

**Lines to modify:** Action execution loop (around 850-920)

```typescript
// Add import at top
import { ProgressDetector } from "@/utils/progressDetector";

// In runTest() method, after creating browserAgent:
const progressDetector = new ProgressDetector();

// In action execution loop, after each action:
const afterActionScreenshot = await page.screenshot();
await browserAgent
  .getEvidenceStore()
  .captureScreenshot(afterActionScreenshot, `action-${actionCount}-after`);

// NEW: Track progress
const changed = progressDetector.recordScreenshot(
  afterActionScreenshot,
  strategyResult.actionType,
);

// Check if stuck
if (progressDetector.isStuck()) {
  log.warn(
    {
      testId: this.testId,
      consecutiveIdentical: progressDetector.getMetrics().consecutiveIdentical,
    },
    "Game appears stuck - screen unchanged for 5+ actions - triggering enhanced unstick",
  );

  // TODO: Trigger keyboard mashing or enhanced unstick (Phase 1 work)
  // For now, just log the warning
}

// At end of test, include metrics in report:
const progressMetrics = progressDetector.getMetrics();

log.info(
  {
    testId: this.testId,
    progressScore: progressMetrics.progressScore,
    uniqueStates: progressMetrics.uniqueGameStates,
    successRate: `${progressMetrics.inputsSuccessful}/${progressMetrics.inputsAttempted}`,
  },
  "Test execution complete - progress metrics",
);

// Add to QA report (modify report structure):
const report: QAReport = {
  // ... existing fields ...

  // NEW: Add progress metrics
  progressMetrics: {
    uniqueStates: progressMetrics.uniqueGameStates,
    inputSuccessRate: progressMetrics.progressScore,
    totalActions: progressMetrics.inputsAttempted,
    successfulActions: progressMetrics.inputsSuccessful,
  },
};
```

#### File 2.3: Update `src/types/qaReport.ts`

Add progress metrics to QAReport interface:

```typescript
export interface QAReport {
  // ... existing fields ...

  /**
   * Progress metrics showing how well the test progressed through the game.
   * @since v1.4.0
   */
  progressMetrics?: {
    /** Number of unique visual game states seen */
    uniqueStates: number;

    /** Percentage of inputs that caused visible changes (0-100) */
    inputSuccessRate: number;

    /** Total actions attempted */
    totalActions: number;

    /** Actions that resulted in screen changes */
    successfulActions: number;
  };
}
```

### Testing Requirements

#### Test File 2.1: `src/utils/progressDetector.test.ts` (NEW)

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  ProgressDetector,
  hashBuffer,
  buffersEqual,
  calculateProgressScore,
} from "./progressDetector";

describe("ProgressDetector", () => {
  let detector: ProgressDetector;

  beforeEach(() => {
    detector = new ProgressDetector();
  });

  describe("recordScreenshot", () => {
    it("should detect first screenshot as changed", () => {
      const screenshot = Buffer.from("test image 1");
      const changed = detector.recordScreenshot(screenshot, "click");

      expect(changed).toBe(true);
      expect(detector.getMetrics().screenshotsWithChanges).toBe(0); // First doesn't count
      expect(detector.getMetrics().uniqueGameStates).toBe(1);
    });

    it("should detect changed screenshots", () => {
      const screenshot1 = Buffer.from("test image 1");
      const screenshot2 = Buffer.from("test image 2");

      detector.recordScreenshot(screenshot1, "click");
      const changed = detector.recordScreenshot(screenshot2, "click");

      expect(changed).toBe(true);
      expect(detector.getMetrics().screenshotsWithChanges).toBe(1);
      expect(detector.getMetrics().uniqueGameStates).toBe(2);
    });

    it("should detect identical screenshots", () => {
      const screenshot1 = Buffer.from("test image 1");
      const screenshot2 = Buffer.from("test image 1"); // Same content

      detector.recordScreenshot(screenshot1, "click");
      const changed = detector.recordScreenshot(screenshot2, "click");

      expect(changed).toBe(false);
      expect(detector.getMetrics().screenshotsIdentical).toBe(1);
      expect(detector.getMetrics().consecutiveIdentical).toBe(1);
    });

    it("should track consecutive identical screenshots", () => {
      const screenshot = Buffer.from("stuck screen");

      detector.recordScreenshot(screenshot, "click");
      detector.recordScreenshot(screenshot, "click");
      detector.recordScreenshot(screenshot, "click");
      detector.recordScreenshot(screenshot, "click");
      detector.recordScreenshot(screenshot, "click");

      expect(detector.getMetrics().consecutiveIdentical).toBe(4);
    });

    it("should reset consecutive count when screen changes", () => {
      const screenshot1 = Buffer.from("screen 1");
      const screenshot2 = Buffer.from("screen 2");

      detector.recordScreenshot(screenshot1, "click");
      detector.recordScreenshot(screenshot1, "click");
      detector.recordScreenshot(screenshot1, "click");
      detector.recordScreenshot(screenshot2, "click"); // Changed!

      expect(detector.getMetrics().consecutiveIdentical).toBe(0);
    });
  });

  describe("isStuck", () => {
    it("should return false when not stuck", () => {
      const screenshot1 = Buffer.from("screen 1");
      const screenshot2 = Buffer.from("screen 2");

      detector.recordScreenshot(screenshot1, "click");
      detector.recordScreenshot(screenshot2, "click");

      expect(detector.isStuck()).toBe(false);
    });

    it("should return true after 5 consecutive identical screenshots", () => {
      const screenshot = Buffer.from("stuck screen");

      detector.recordScreenshot(screenshot, "click");
      detector.recordScreenshot(screenshot, "click");
      detector.recordScreenshot(screenshot, "click");
      detector.recordScreenshot(screenshot, "click");
      detector.recordScreenshot(screenshot, "click");
      detector.recordScreenshot(screenshot, "click"); // 5 consecutive

      expect(detector.isStuck()).toBe(true);
    });

    it("should support custom threshold", () => {
      const screenshot = Buffer.from("stuck screen");

      detector.recordScreenshot(screenshot, "click");
      detector.recordScreenshot(screenshot, "click");
      detector.recordScreenshot(screenshot, "click");

      expect(detector.isStuck(3)).toBe(true); // Custom threshold
      expect(detector.isStuck(5)).toBe(false); // Default threshold
    });
  });

  describe("calculateProgressScore", () => {
    it("should calculate 100% for perfect success rate", () => {
      const metrics = {
        inputsAttempted: 10,
        inputsSuccessful: 10,
        uniqueGameStates: 5,
        screenshotsWithChanges: 10,
        screenshotsIdentical: 0,
        consecutiveIdentical: 0,
        progressScore: 0,
        seenStates: new Set<string>(),
      };

      const score = calculateProgressScore(metrics);
      expect(score).toBeGreaterThanOrEqual(100);
    });

    it("should calculate 0% for no successful inputs", () => {
      const metrics = {
        inputsAttempted: 10,
        inputsSuccessful: 0,
        uniqueGameStates: 1,
        screenshotsWithChanges: 0,
        screenshotsIdentical: 10,
        consecutiveIdentical: 10,
        progressScore: 0,
        seenStates: new Set<string>(),
      };

      const score = calculateProgressScore(metrics);
      expect(score).toBeLessThanOrEqual(20); // May have small bonus
    });

    it("should add bonus for unique states", () => {
      const metricsWithFewStates = {
        inputsAttempted: 10,
        inputsSuccessful: 5,
        uniqueGameStates: 1,
        screenshotsWithChanges: 5,
        screenshotsIdentical: 5,
        consecutiveIdentical: 0,
        progressScore: 0,
        seenStates: new Set<string>(),
      };

      const metricsWithManyStates = {
        ...metricsWithFewStates,
        uniqueGameStates: 10,
      };

      const scoreFew = calculateProgressScore(metricsWithFewStates);
      const scoreMany = calculateProgressScore(metricsWithManyStates);

      expect(scoreMany).toBeGreaterThan(scoreFew);
    });
  });

  describe("utility functions", () => {
    it("hashBuffer should produce consistent hashes", () => {
      const buffer = Buffer.from("test data");
      const hash1 = hashBuffer(buffer);
      const hash2 = hashBuffer(buffer);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex string
    });

    it("hashBuffer should produce different hashes for different data", () => {
      const buffer1 = Buffer.from("test data 1");
      const buffer2 = Buffer.from("test data 2");

      const hash1 = hashBuffer(buffer1);
      const hash2 = hashBuffer(buffer2);

      expect(hash1).not.toBe(hash2);
    });

    it("buffersEqual should detect equal buffers", () => {
      const buffer1 = Buffer.from("same data");
      const buffer2 = Buffer.from("same data");

      expect(buffersEqual(buffer1, buffer2)).toBe(true);
    });

    it("buffersEqual should detect different buffers", () => {
      const buffer1 = Buffer.from("data 1");
      const buffer2 = Buffer.from("data 2");

      expect(buffersEqual(buffer1, buffer2)).toBe(false);
    });
  });
});
```

### Success Criteria
- ✅ ProgressDetector correctly tracks screenshot changes
- ✅ isStuck() detects 5+ consecutive identical screenshots
- ✅ Progress metrics included in QA report
- ✅ Logs show progress detection working
- ✅ Unit tests achieve 90%+ coverage
- ✅ Integration test shows stuck detection working

### Estimated Time
- ProgressDetector implementation: 1 hour
- Integration into orchestrator: 1 hour
- Testing: 1 hour
**Total: 3 hours**

### Deliverables
1. New file: `src/utils/progressDetector.ts`
2. Updated: `src/orchestrator/qaOrchestrator.ts` (add progress tracking)
3. Updated: `src/types/qaReport.ts` (add progressMetrics field)
4. New test: `src/utils/progressDetector.test.ts`
5. Documentation in code comments

---

## PHASE 1: Intelligent Unstick Logic (4 hours)

### Agent Assignment
**Agent:** BMad Dev Agent #3
**Priority:** HIGH - Start in parallel with Phase 2
**Blocking:** None - independent implementation
**Dependencies:** Benefits from Phase 2 but not required

### Objective
Replace blind center-clicking unstick logic with intelligent vision/DOM-guided button finding, keyboard input attempts, and iframe handling.

### Architecture

#### New File: `src/browser-agent/unstickStrategies.ts`

**Purpose:** Modular unstick strategies that can be tried in sequence

**Exports:**
```typescript
export interface UnstickStrategy {
  name: string;
  execute(page: Page, context: UnstickContext): Promise<UnstickResult>;
}

export interface UnstickContext {
  testId: string;
  attemptNumber: number;
  domAnalysis: DOMAnalysis;
  inputHint?: string;
  evidenceStore: EvidenceStore;
}

export interface UnstickResult {
  success: boolean;
  action: string;
  changed: boolean; // Did screen change?
  error?: string;
}

// Concrete strategies
export class VisionGuidedClickStrategy implements UnstickStrategy;
export class DOMButtonFinderStrategy implements UnstickStrategy;
export class KeyboardMashStrategy implements UnstickStrategy;
export class IframeDetectionStrategy implements UnstickStrategy;
export class PageRefreshStrategy implements UnstickStrategy;

// Strategy executor
export class UnstickStrategyExecutor {
  constructor(strategies: UnstickStrategy[]);
  async executeAll(page: Page, context: UnstickContext): Promise<UnstickResult>;
}
```

### Detailed Implementation

#### File 1.1: `src/browser-agent/unstickStrategies.ts` (NEW)

```typescript
/**
 * Unstick Strategies - Modular approaches to get games past loading/start screens.
 *
 * Provides multiple strategies that can be tried in sequence to unstick
 * games that are frozen on loading screens or require specific user interaction.
 *
 * @module unstickStrategies
 */

import type { Page } from "@browserbasehq/stagehand";
import type { DOMAnalysis } from "@/types/qaReport";
import type { EvidenceStore } from "@/evidence-store/evidenceStore";
import { VisionAnalyzer } from "./visionAnalyzer";
import { logger } from "@/utils/logger";
import { hashBuffer, buffersEqual } from "@/utils/progressDetector";

const log = logger.child({ component: "UnstickStrategies" });

/**
 * Context information for unstick strategies.
 */
export interface UnstickContext {
  /** Test ID for logging */
  testId: string;

  /** Attempt number (1, 2, 3, etc.) */
  attemptNumber: number;

  /** DOM analysis from last scan */
  domAnalysis: DOMAnalysis;

  /** Optional hint about expected inputs */
  inputHint?: string;

  /** Evidence store for capturing screenshots */
  evidenceStore: EvidenceStore;
}

/**
 * Result from executing an unstick strategy.
 */
export interface UnstickResult {
  /** Whether the strategy execution succeeded */
  success: boolean;

  /** Description of action taken */
  action: string;

  /** Whether screen changed after action */
  changed: boolean;

  /** Error message if strategy failed */
  error?: string;

  /** Screenshot hash before action */
  beforeHash?: string;

  /** Screenshot hash after action */
  afterHash?: string;
}

/**
 * Interface for unstick strategies.
 */
export interface UnstickStrategy {
  /** Strategy name for logging */
  name: string;

  /** Execute the unstick strategy */
  execute(page: Page, context: UnstickContext): Promise<UnstickResult>;
}

/**
 * Strategy 1: Vision-Guided Click
 *
 * Uses GPT-4o vision analysis to identify and click visible buttons.
 */
export class VisionGuidedClickStrategy implements UnstickStrategy {
  name = "Vision-Guided Click";

  async execute(page: Page, context: UnstickContext): Promise<UnstickResult> {
    log.info(
      { testId: context.testId, attempt: context.attemptNumber },
      "Executing Vision-Guided Click strategy",
    );

    try {
      // Capture current screenshot
      const beforeScreenshot = await page.screenshot();
      const beforeHash = hashBuffer(beforeScreenshot);

      await context.evidenceStore.captureScreenshot(
        beforeScreenshot,
        `unstick-vision-${context.attemptNumber}-before`,
      );

      // Use vision analyzer to find clickable element
      const visionAnalyzer = new VisionAnalyzer();
      const visionResult = await visionAnalyzer.analyzeScreenshot(
        beforeScreenshot,
        {
          previousAction: "Game stuck on start screen",
          gameState: "attempting to start game",
          attempt: context.attemptNumber,
          inputHint: context.inputHint,
          domAnalysis: context.domAnalysis,
        },
      );

      log.info(
        {
          testId: context.testId,
          actionType: visionResult.actionType,
          confidence: visionResult.confidence,
          target: visionResult.targetDescription,
        },
        "Vision analysis complete",
      );

      // If vision recommends a click with target description
      if (
        visionResult.actionType === "click" &&
        visionResult.targetDescription &&
        visionResult.confidence > 50
      ) {
        // Try to find and click the element described by vision
        const clicked = await this.clickDescribedElement(
          page,
          visionResult.targetDescription,
        );

        if (!clicked) {
          log.warn(
            { target: visionResult.targetDescription },
            "Could not find element described by vision - trying center click",
          );

          // Fallback to center click
          const viewport = await page.evaluate(() => ({
            width: window.innerWidth,
            height: window.innerHeight,
          }));
          if (viewport) {
            await page.mouse.click(viewport.width / 2, viewport.height / 2);
          }
        }

        // Wait for potential animation
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check if screen changed
        const afterScreenshot = await page.screenshot();
        const afterHash = hashBuffer(afterScreenshot);
        const changed = beforeHash !== afterHash;

        await context.evidenceStore.captureScreenshot(
          afterScreenshot,
          `unstick-vision-${context.attemptNumber}-after`,
        );

        return {
          success: true,
          action: `Vision-guided click on "${visionResult.targetDescription}"`,
          changed,
          beforeHash,
          afterHash,
        };
      }

      // Vision didn't recommend click or low confidence
      return {
        success: false,
        action: `Vision analysis uncertain (${visionResult.actionType}, ${visionResult.confidence}% confidence)`,
        changed: false,
        error: "Vision did not recommend clickable element",
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        { testId: context.testId, error: err.message },
        "Vision-guided click failed",
      );

      return {
        success: false,
        action: "Vision-guided click",
        changed: false,
        error: err.message,
      };
    }
  }

  /**
   * Attempts to click an element based on text description.
   * Uses Stagehand's act() method or fallback DOM searching.
   */
  private async clickDescribedElement(
    page: Page,
    description: string,
  ): Promise<boolean> {
    try {
      // Try to find element matching description
      // Look for text content, button labels, etc.
      const clickedResult = await page.evaluate((desc) => {
        // Search for elements with matching text
        const allButtons = Array.from(
          document.querySelectorAll("button, [role='button'], a"),
        );

        const matchingButton = allButtons.find((btn) => {
          const text = btn.textContent?.toLowerCase() || "";
          const descLower = desc.toLowerCase();

          return (
            text.includes(descLower) ||
            text.includes("start") ||
            text.includes("play") ||
            text.includes("begin") ||
            text.includes("continue")
          );
        });

        if (matchingButton) {
          (matchingButton as HTMLElement).click();
          return true;
        }

        return false;
      }, description);

      if (clickedResult) {
        log.info(
          { description },
          "Found and clicked element matching description",
        );
        return true;
      }

      return false;
    } catch (error) {
      log.warn(
        {
          description,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to click described element",
      );
      return false;
    }
  }
}

/**
 * Strategy 2: DOM Button Finder
 *
 * Uses DOM analysis to find obvious start/play buttons.
 */
export class DOMButtonFinderStrategy implements UnstickStrategy {
  name = "DOM Button Finder";

  async execute(page: Page, context: UnstickContext): Promise<UnstickResult> {
    log.info(
      { testId: context.testId, attempt: context.attemptNumber },
      "Executing DOM Button Finder strategy",
    );

    try {
      const beforeScreenshot = await page.screenshot();
      const beforeHash = hashBuffer(beforeScreenshot);

      // Look for obvious start buttons in DOM analysis
      const startButtons = context.domAnalysis.buttons.filter(
        (btn) =>
          btn.visible &&
          (btn.text.toLowerCase().includes("start") ||
            btn.text.toLowerCase().includes("play") ||
            btn.text.toLowerCase().includes("begin") ||
            btn.text.toLowerCase().includes("continue") ||
            btn.text.toLowerCase().includes("click") ||
            btn.id?.toLowerCase().includes("start") ||
            btn.id?.toLowerCase().includes("play")),
      );

      if (startButtons.length > 0) {
        const button = startButtons[0];
        log.info(
          {
            testId: context.testId,
            buttonText: button.text,
            buttonId: button.id,
            position: button.position,
          },
          "Found start button in DOM",
        );

        // Click the button center
        const clickX = button.position.x + button.position.width / 2;
        const clickY = button.position.y + button.position.height / 2;

        await page.mouse.click(clickX, clickY);
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const afterScreenshot = await page.screenshot();
        const afterHash = hashBuffer(afterScreenshot);
        const changed = beforeHash !== afterHash;

        return {
          success: true,
          action: `Clicked DOM button "${button.text}" at (${Math.round(clickX)}, ${Math.round(clickY)})`,
          changed,
          beforeHash,
          afterHash,
        };
      }

      // No obvious start buttons found
      log.info(
        { testId: context.testId, buttonsFound: context.domAnalysis.buttons.length },
        "No obvious start buttons found in DOM",
      );

      return {
        success: false,
        action: "DOM button finder",
        changed: false,
        error: "No start/play buttons found in DOM",
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        { testId: context.testId, error: err.message },
        "DOM button finder failed",
      );

      return {
        success: false,
        action: "DOM button finder",
        changed: false,
        error: err.message,
      };
    }
  }
}

/**
 * Strategy 3: Keyboard Mash
 *
 * Tries common keyboard inputs (Space, Enter, WASD, arrows).
 */
export class KeyboardMashStrategy implements UnstickStrategy {
  name = "Keyboard Mash";

  async execute(page: Page, context: UnstickContext): Promise<UnstickResult> {
    log.info(
      { testId: context.testId, attempt: context.attemptNumber },
      "Executing Keyboard Mash strategy",
    );

    try {
      const beforeScreenshot = await page.screenshot();
      const beforeHash = hashBuffer(beforeScreenshot);

      const keysToTry = [
        "Space",
        "Enter",
        "Escape",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "w",
        "a",
        "s",
        "d",
      ];

      let keyThatWorked: string | null = null;

      for (const key of keysToTry) {
        await page.keyboard.press(key);
        await new Promise((resolve) => setTimeout(resolve, 500));

        const currentScreenshot = await page.screenshot();
        const currentHash = hashBuffer(currentScreenshot);

        if (currentHash !== beforeHash) {
          keyThatWorked = key;
          log.info(
            { testId: context.testId, key },
            "Key press caused screen change!",
          );
          break;
        }
      }

      const afterScreenshot = await page.screenshot();
      const afterHash = hashBuffer(afterScreenshot);
      const changed = beforeHash !== afterHash;

      if (keyThatWorked) {
        return {
          success: true,
          action: `Pressed "${keyThatWorked}" key`,
          changed: true,
          beforeHash,
          afterHash,
        };
      }

      return {
        success: false,
        action: `Tried ${keysToTry.length} keys`,
        changed,
        error: "No keyboard input caused screen change",
        beforeHash,
        afterHash,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        { testId: context.testId, error: err.message },
        "Keyboard mash strategy failed",
      );

      return {
        success: false,
        action: "Keyboard mash",
        changed: false,
        error: err.message,
      };
    }
  }
}

/**
 * Strategy 4: Iframe Detection
 *
 * Detects if game is in iframe and switches context.
 */
export class IframeDetectionStrategy implements UnstickStrategy {
  name = "Iframe Detection";

  async execute(page: Page, context: UnstickContext): Promise<UnstickResult> {
    log.info(
      { testId: context.testId, attempt: context.attemptNumber },
      "Executing Iframe Detection strategy",
    );

    try {
      // Check for common iframe selectors (itch.io, GameJolt, etc.)
      const iframeSelectors = [
        "#game_drop", // itch.io
        "iframe[src*='game']",
        "iframe[id*='game']",
        "iframe[class*='game']",
        ".game-frame",
        "#gameFrame",
      ];

      for (const selector of iframeSelectors) {
        const iframeHandle = await page.$(selector);

        if (iframeHandle) {
          log.info(
            { testId: context.testId, selector },
            "Found game iframe - switching context",
          );

          // Get iframe content
          const frame = await iframeHandle.contentFrame();

          if (frame) {
            // Try clicking center of iframe
            const viewport = await frame.evaluate(() => ({
              width: window.innerWidth,
              height: window.innerHeight,
            }));

            if (viewport) {
              await frame.mouse.click(viewport.width / 2, viewport.height / 2);
              await new Promise((resolve) => setTimeout(resolve, 1000));

              return {
                success: true,
                action: `Found iframe (${selector}) and clicked center`,
                changed: true, // Assume changed since we found new context
              };
            }
          }
        }
      }

      return {
        success: false,
        action: "Iframe detection",
        changed: false,
        error: "No game iframe found",
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        { testId: context.testId, error: err.message },
        "Iframe detection failed",
      );

      return {
        success: false,
        action: "Iframe detection",
        changed: false,
        error: err.message,
      };
    }
  }
}

/**
 * Strategy 5: Page Refresh
 *
 * Refreshes the page (last resort).
 */
export class PageRefreshStrategy implements UnstickStrategy {
  name = "Page Refresh";

  async execute(page: Page, context: UnstickContext): Promise<UnstickResult> {
    log.info(
      { testId: context.testId, attempt: context.attemptNumber },
      "Executing Page Refresh strategy",
    );

    try {
      await page.reload({ waitUntil: "load" });
      await new Promise((resolve) => setTimeout(resolve, 3000));

      return {
        success: true,
        action: "Refreshed page",
        changed: true, // Page refresh always changes screen
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        { testId: context.testId, error: err.message },
        "Page refresh failed",
      );

      return {
        success: false,
        action: "Page refresh",
        changed: false,
        error: err.message,
      };
    }
  }
}

/**
 * Executes multiple unstick strategies in sequence until one works.
 */
export class UnstickStrategyExecutor {
  private strategies: UnstickStrategy[];

  constructor(strategies: UnstickStrategy[]) {
    this.strategies = strategies;
  }

  /**
   * Executes all strategies in order until one reports success.
   *
   * @param page - Playwright page
   * @param context - Unstick context
   * @returns Result from first successful strategy, or last strategy if all fail
   */
  async executeAll(
    page: Page,
    context: UnstickContext,
  ): Promise<UnstickResult> {
    log.info(
      {
        testId: context.testId,
        strategyCount: this.strategies.length,
        attempt: context.attemptNumber,
      },
      "Executing unstick strategy sequence",
    );

    let lastResult: UnstickResult = {
      success: false,
      action: "No strategies executed",
      changed: false,
    };

    for (const strategy of this.strategies) {
      log.info(
        { testId: context.testId, strategy: strategy.name },
        "Trying unstick strategy",
      );

      const result = await strategy.execute(page, context);
      lastResult = result;

      if (result.success && result.changed) {
        log.info(
          {
            testId: context.testId,
            strategy: strategy.name,
            action: result.action,
          },
          "Unstick strategy succeeded - screen changed!",
        );
        return result;
      }

      log.info(
        {
          testId: context.testId,
          strategy: strategy.name,
          success: result.success,
          changed: result.changed,
        },
        "Unstick strategy completed - trying next",
      );
    }

    log.warn(
      { testId: context.testId },
      "All unstick strategies failed - game may be truly stuck",
    );

    return lastResult;
  }

  /**
   * Creates default unstick strategy sequence.
   *
   * @returns Executor with recommended strategy order
   */
  static createDefault(): UnstickStrategyExecutor {
    return new UnstickStrategyExecutor([
      new IframeDetectionStrategy(), // Try iframe first (common for itch.io)
      new DOMButtonFinderStrategy(), // Then try DOM buttons
      new VisionGuidedClickStrategy(), // Then use AI vision
      new KeyboardMashStrategy(), // Then try keyboard
      new PageRefreshStrategy(), // Last resort: refresh
    ]);
  }
}
```

#### File 1.2: Integration into `qaOrchestrator.ts`

**Lines to replace:** 629-750 (current unstick logic)

```typescript
// Add import at top
import {
  UnstickStrategyExecutor,
  type UnstickContext,
} from "@/browser-agent/unstickStrategies";

// Replace the entire unstick section (lines 629-750) with:

// Create unstick context
const unstickContext: UnstickContext = {
  testId: this.testId,
  attemptNumber: retryAttempt + 1,
  domAnalysis: await browserAgent.getLatestDOMAnalysis() || {
    buttons: [],
    links: [],
    inputs: [],
    canvases: [],
    headings: [],
    clickableText: [],
    viewport: { width: 1280, height: 720 },
    interactiveCount: 0,
  },
  inputHint: this.config.inputHint,
  evidenceStore: browserAgent.getEvidenceStore(),
};

// Execute unstick strategy sequence
const unstickExecutor = UnstickStrategyExecutor.createDefault();
const unstickResult = await unstickExecutor.executeAll(page, unstickContext);

log.info(
  {
    testId: this.testId,
    retryAttempt: retryAttempt + 1,
    action: unstickResult.action,
    changed: unstickResult.changed,
    success: unstickResult.success,
  },
  "Unstick strategies complete",
);

// Log the action
actions.push({
  type: "unstick-attempt",
  timestamp: new Date().toISOString(),
  success: unstickResult.success && unstickResult.changed,
  details: unstickResult.action,
});

// If unstick worked (screen changed), break out and retry hybrid strategy
if (unstickResult.changed) {
  log.info(
    { testId: this.testId, retryAttempt: retryAttempt + 1 },
    "Unstick successful - screen changed, retrying hybrid strategy",
  );
  break; // Exit retry loop
}

// If unstick failed and this was last retry, will fall through to crash detection
```

### Testing Requirements

#### Test File 1.1: `src/browser-agent/unstickStrategies.test.ts` (NEW)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Page } from "@browserbasehq/stagehand";
import {
  VisionGuidedClickStrategy,
  DOMButtonFinderStrategy,
  KeyboardMashStrategy,
  IframeDetectionStrategy,
  PageRefreshStrategy,
  UnstickStrategyExecutor,
  type UnstickContext,
} from "./unstickStrategies";

describe("Unstick Strategies", () => {
  let mockPage: Partial<Page>;
  let mockContext: UnstickContext;

  beforeEach(() => {
    mockPage = {
      screenshot: vi.fn().mockResolvedValue(Buffer.from("test screenshot")),
      mouse: {
        click: vi.fn().mockResolvedValue(undefined),
      },
      keyboard: {
        press: vi.fn().mockResolvedValue(undefined),
      },
      evaluate: vi.fn().mockResolvedValue({ width: 1280, height: 720 }),
      $: vi.fn().mockResolvedValue(null),
      reload: vi.fn().mockResolvedValue(undefined),
    };

    mockContext = {
      testId: "test-123",
      attemptNumber: 1,
      domAnalysis: {
        buttons: [
          {
            tag: "button",
            text: "Start Game",
            id: "start-btn",
            classes: [],
            position: { x: 100, y: 100, width: 200, height: 50 },
            visible: true,
            clickable: true,
          },
        ],
        links: [],
        inputs: [],
        canvases: [],
        headings: [],
        clickableText: [],
        viewport: { width: 1280, height: 720 },
        interactiveCount: 1,
      },
      evidenceStore: {
        captureScreenshot: vi.fn().mockResolvedValue("screenshot-path"),
      } as any,
    };
  });

  describe("DOMButtonFinderStrategy", () => {
    it("should find and click start button from DOM", async () => {
      const strategy = new DOMButtonFinderStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(true);
      expect(result.action).toContain("Start Game");
      expect(mockPage.mouse?.click).toHaveBeenCalledWith(200, 125); // Center of button
    });

    it("should fail if no start buttons found", async () => {
      mockContext.domAnalysis.buttons = [];

      const strategy = new DOMButtonFinderStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No start/play buttons");
    });
  });

  describe("KeyboardMashStrategy", () => {
    it("should try multiple keys", async () => {
      const strategy = new KeyboardMashStrategy();
      await strategy.execute(mockPage as Page, mockContext);

      // Should have tried Space, Enter, arrows, WASD
      expect(mockPage.keyboard?.press).toHaveBeenCalled();
      const callCount = (mockPage.keyboard?.press as any).mock.calls.length;
      expect(callCount).toBeGreaterThan(5);
    });
  });

  describe("IframeDetectionStrategy", () => {
    it("should detect and click into iframe", async () => {
      const mockFrame = {
        mouse: { click: vi.fn() },
        evaluate: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
      };

      const mockIframeHandle = {
        contentFrame: vi.fn().mockResolvedValue(mockFrame),
      };

      mockPage.$ = vi.fn().mockResolvedValue(mockIframeHandle);

      const strategy = new IframeDetectionStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(true);
      expect(result.changed).toBe(true);
      expect(mockFrame.mouse.click).toHaveBeenCalledWith(400, 300); // Center of iframe
    });

    it("should fail if no iframe found", async () => {
      mockPage.$ = vi.fn().mockResolvedValue(null);

      const strategy = new IframeDetectionStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No game iframe");
    });
  });

  describe("PageRefreshStrategy", () => {
    it("should refresh page", async () => {
      const strategy = new PageRefreshStrategy();
      const result = await strategy.execute(mockPage as Page, mockContext);

      expect(result.success).toBe(true);
      expect(result.changed).toBe(true);
      expect(mockPage.reload).toHaveBeenCalled();
    });
  });

  describe("UnstickStrategyExecutor", () => {
    it("should execute strategies in order until one succeeds", async () => {
      const failStrategy = {
        name: "Fail Strategy",
        execute: vi.fn().mockResolvedValue({
          success: false,
          action: "Failed",
          changed: false,
        }),
      };

      const successStrategy = {
        name: "Success Strategy",
        execute: vi.fn().mockResolvedValue({
          success: true,
          action: "Succeeded",
          changed: true,
        }),
      };

      const neverCalledStrategy = {
        name: "Never Called",
        execute: vi.fn(),
      };

      const executor = new UnstickStrategyExecutor([
        failStrategy,
        successStrategy,
        neverCalledStrategy,
      ]);

      const result = await executor.executeAll(mockPage as Page, mockContext);

      expect(failStrategy.execute).toHaveBeenCalled();
      expect(successStrategy.execute).toHaveBeenCalled();
      expect(neverCalledStrategy.execute).not.toHaveBeenCalled(); // Stopped after success

      expect(result.success).toBe(true);
      expect(result.changed).toBe(true);
    });

    it("should return last result if all strategies fail", async () => {
      const strategy1 = {
        name: "Fail 1",
        execute: vi.fn().mockResolvedValue({
          success: false,
          action: "Failed 1",
          changed: false,
        }),
      };

      const strategy2 = {
        name: "Fail 2",
        execute: vi.fn().mockResolvedValue({
          success: false,
          action: "Failed 2",
          changed: false,
        }),
      };

      const executor = new UnstickStrategyExecutor([strategy1, strategy2]);
      const result = await executor.executeAll(mockPage as Page, mockContext);

      expect(strategy1.execute).toHaveBeenCalled();
      expect(strategy2.execute).toHaveBeenCalled();
      expect(result.action).toBe("Failed 2"); // Last strategy result
    });
  });
});
```

### Success Criteria
- ✅ Unstick strategies successfully find and click start buttons
- ✅ Iframe detection works for itch.io games
- ✅ Keyboard strategy can unstick keyboard-only games
- ✅ Strategies execute in proper order
- ✅ Screen change detection works after each strategy
- ✅ Unit tests achieve 85%+ coverage
- ✅ Real game test shows progression past start screen

### Estimated Time
- Unstick strategies implementation: 2 hours
- Integration into orchestrator: 1 hour
- Testing: 1 hour
**Total: 4 hours**

### Deliverables
1. New file: `src/browser-agent/unstickStrategies.ts`
2. Updated: `src/orchestrator/qaOrchestrator.ts` (replace lines 629-750)
3. New test: `src/browser-agent/unstickStrategies.test.ts`
4. Documentation in code comments

---

## PHASE 4: Documentation & Testing (2 hours - PARALLEL)

### Agent Assignment
**Agent:** BMad Paige (Documentation Agent)
**Priority:** MEDIUM - Can start immediately in parallel
**Blocking:** None - independent work
**Dependencies:** Will need to update after Phases 1-3 complete

### Objective
Document all changes, update architecture, create troubleshooting guide, and add test fixtures.

### Tasks

#### Task 4.1: Update Architecture Documentation (30 min)
**File:** `docs/architecture.md`

Add new section:

```markdown
## Game Progression Strategy (v1.4.0)

**Problem:** Early versions got stuck at game loading/start screens.

**Solution:** Multi-layered unstick strategies + progress detection.

### Progress Detection
- Tracks screenshot hashes between actions
- Detects 5+ consecutive identical screenshots as "stuck"
- Calculates progress score based on input success rate
- Included in QA report as `progressMetrics`

**Implementation:** `src/utils/progressDetector.ts`

### Unstick Strategies
Modular strategies tried in sequence:
1. **Iframe Detection** - Find game in iframe (itch.io)
2. **DOM Button Finder** - Find start/play buttons in DOM
3. **Vision-Guided Click** - Use GPT-4o to identify clickable elements
4. **Keyboard Mash** - Try common keys (Space, Enter, WASD, arrows)
5. **Page Refresh** - Last resort

**Implementation:** `src/browser-agent/unstickStrategies.ts`

### First Action Handling
- "Wait" actions are valid (game loading), not crashes
- Low-confidence actions (30%+) attempted anyway
- Only ultra-low confidence (<40%) triggers unstick

**Changed:** `src/orchestrator/qaOrchestrator.ts:567-620`
```

#### Task 4.2: Create Troubleshooting Guide (30 min)
**File:** `docs/troubleshooting.md` (NEW)

```markdown
# Troubleshooting Guide

## Game Gets Stuck at Start Screen

**Symptoms:**
- Test completes but reports 0 actions
- Screenshots show only loading screen
- Action logs show "crash-detected" after 2.5 minutes

**Diagnosis:**
1. Check if game is in iframe: `itch.io`, `gamejolt`, etc.
2. Check console logs for JavaScript errors
3. Look for "click to start" prompts

**Solutions:**
1. **Provide input hint:**
   ```bash
   bun run cli test <url> --input-hint "Click screen to start, then use WASD"
   ```

2. **Check iframe handling:**
   - Logs should show "Found game iframe - switching context"
   - If not, game may use non-standard iframe selector

3. **Increase timeout for slow games:**
   ```bash
   bun run cli test <url> --timeout 180000 # 3 minutes
   ```

## Progress Metrics Show 0% Success Rate

**Symptoms:**
- `progressMetrics.progressScore` is 0
- `uniqueStates` is 1 (only one screen seen)
- All screenshots look identical

**Diagnosis:**
- Game not responding to any input
- Possible reasons:
  - Game requires specific initialization (audio context, WebGL)
  - Game stuck in loading loop
  - Game requires cookie/privacy consent

**Solutions:**
1. **Check for consent prompts:**
   - Look for cookie banners, age verification, etc.
   - May need to add special handling

2. **Try different input types:**
   - Some games ignore clicks, need keyboard
   - Some games ignore keyboard, need clicks
   - Input hint helps guide strategy

3. **Check browser console:**
   - `WebGL not supported` → Game won't work in headless
   - `Audio context blocked` → Game waiting for user gesture

## Vision Analysis Keeps Failing

**Symptoms:**
- Logs show "Vision API rate limit"
- Or "Vision analysis returned invalid format"

**Solutions:**
1. **Rate limits:**
   - Use `--max-actions 5` for testing
   - Add delays between tests
   - Check OpenAI API usage

2. **Invalid format:**
   - Usually temporary API issue
   - System will retry automatically
   - Falls back to heuristics if persistent
```

#### Task 4.3: Add Test Fixtures (30 min)
**File:** `tests/fixtures/game-progression-scenarios.ts` (NEW)

```typescript
/**
 * Test fixtures for game progression scenarios.
 */

export const stuckOnLoadingScreen = {
  url: "https://example.com/stuck-game",
  domAnalysis: {
    buttons: [],
    links: [],
    canvases: [{ id: "game", width: 800, height: 600, visible: true, isPrimaryGame: true, position: { x: 0, y: 0, width: 800, height: 600 } }],
    headings: [{ tag: "h1", text: "Loading...", visible: true, position: { x: 0, y: 0, width: 200, height: 50 } }],
    viewport: { width: 1280, height: 720 },
    interactiveCount: 0,
  },
  expectedBehavior: "Should enter unstick loop, try strategies, eventually timeout",
};

export const itchIoGame = {
  url: "https://meiri.itch.io/doce-fim",
  domAnalysis: {
    buttons: [{ tag: "button", text: "Run game", visible: true, clickable: true }],
    canvases: [], // Game is in iframe
    viewport: { width: 1280, height: 720 },
    interactiveCount: 1,
  },
  expectedBehavior: "Should detect iframe, switch context, find game canvas",
};

export const keyboardOnlyGame = {
  url: "https://example.com/keyboard-game",
  domAnalysis: {
    buttons: [],
    canvases: [{ id: "game", width: 640, height: 480, visible: true, isPrimaryGame: true }],
    headings: [{ tag: "h2", text: "Press Space to Start" }],
    viewport: { width: 1280, height: 720 },
    interactiveCount: 0,
  },
  expectedBehavior: "Should try keyboard strategy, press Space, game starts",
};
```

#### Task 4.4: Update Success Criteria (30 min)
**File:** `PRD.md`

Update success criteria section:

```markdown
### Updated Success Criteria (v1.4.0)

| Criterion | Target | Measurement | v1.4 Changes |
|-----------|--------|-------------|--------------|
| **Game Progression** | 10+ actions executed per test | Action logs | NEW - was 0 actions |
| **Unique States** | 3+ unique screens seen | Progress metrics | NEW metric |
| **Input Success Rate** | 60%+ inputs cause changes | Progress score | NEW metric |
| **Start Screen Escape** | <30 seconds to first gameplay | Action logs | Was 2.5min retry loop |
| Assessment Accuracy | 80%+ accuracy on playability | Compare to human QA | Unchanged |
| Reliability | Handles common failures gracefully | Test with broken games | Improved |
| Execution Time | < 5 minutes per game | Automated timing | Unchanged |
```

### Success Criteria
- ✅ Architecture doc updated with new strategies
- ✅ Troubleshooting guide created
- ✅ Test fixtures added for common scenarios
- ✅ PRD updated with new success metrics
- ✅ All documentation reviewed and accurate

### Estimated Time
- Architecture update: 30min
- Troubleshooting guide: 30min
- Test fixtures: 30min
- PRD updates: 30min
**Total: 2 hours**

### Deliverables
1. Updated: `docs/architecture.md`
2. New: `docs/troubleshooting.md`
3. New: `tests/fixtures/game-progression-scenarios.ts`
4. Updated: `PRD.md`

---

## Execution Plan & Agent Assignments

### Parallel Execution Timeline

```
Hour 0 (START):
├─ Agent #1 → Phase 3 (30 min) → MERGE → Start next task
├─ Agent #2 → Phase 2 (3 hours)
├─ Agent #3 → Phase 1 (4 hours)
└─ Paige → Phase 4 (2 hours) → Update docs after code merges

Hour 0.5:
├─ Agent #1 → DONE (Phase 3) → Merge PR → Run tests
├─ Agent #2 → Working on Phase 2 (2.5h remaining)
├─ Agent #3 → Working on Phase 1 (3.5h remaining)
└─ Paige → Working on Phase 4 (1.5h remaining)

Hour 2:
├─ Agent #1 → Available for reviews/testing
├─ Agent #2 → Working on Phase 2 (1h remaining)
├─ Agent #3 → Working on Phase 1 (2h remaining)
└─ Paige → DONE (Phase 4 draft) → Wait for code to finalize

Hour 3:
├─ Agent #1 → Integration testing
├─ Agent #2 → DONE (Phase 2) → Merge PR
├─ Agent #3 → Working on Phase 1 (1h remaining)
└─ Paige → Updating docs with final code

Hour 4:
├─ Agent #1 → Final testing
├─ Agent #2 → Code review
├─ Agent #3 → DONE (Phase 1) → Merge PR
└─ Paige → Final doc updates

Hour 5-6:
└─ All agents → Integration testing, final verification, real game tests
```

### Assignment Summary

| Phase | Agent | Duration | Dependencies | Start Time |
|-------|-------|----------|--------------|------------|
| Phase 3 | Dev #1 | 30 min | None | Hour 0 |
| Phase 2 | Dev #2 | 3 hours | None | Hour 0 |
| Phase 1 | Dev #3 | 4 hours | None | Hour 0 |
| Phase 4 | Paige | 2 hours | None (draft) | Hour 0 |

**Total Time with Parallelization:** ~6 hours (vs 11.5 hours sequential)

---

## Integration & Testing

### After All Phases Complete

#### Integration Test Checklist
- [ ] Phase 3 changes don't conflict with Phase 1/2
- [ ] ProgressDetector works with unstick strategies
- [ ] All new code has passing unit tests
- [ ] No TypeScript errors (`bun run type-check`)
- [ ] No linting errors (`bun run lint`)
- [ ] All existing tests still pass (`bun test`)

#### Real Game Test
Run against known problematic games:

```bash
# Test 1: Itch.io game (iframe handling)
bun run cli test "https://meiri.itch.io/doce-fim" \
  --max-actions 10 \
  --output ./validation-tests/itch-io-test

# Test 2: Platformer (keyboard input)
bun run cli test "https://example.com/platformer" \
  --max-actions 15 \
  --input-hint "Arrow keys to move, Space to jump"

# Test 3: Loading screen game
bun run cli test "https://example.com/slow-game" \
  --timeout 180000 \
  --max-actions 20
```

**Expected Results:**
- ✅ Tests execute 10+ actions (was 0)
- ✅ Progress metrics show 60%+ success rate
- ✅ Unique states > 3 (was 1)
- ✅ Escape start screen in <30s (was 2.5min)
- ✅ No "crash-detected" for valid games

---

## Success Metrics

### Before Implementation
- Actions executed: 0
- Time stuck in retry: 2.5 minutes
- Progress score: 0%
- Unique states: 1
- Test outcome: "success" but nothing tested

### After Implementation
- Actions executed: 10-20
- Time to first gameplay: <30 seconds
- Progress score: 60-80%
- Unique states: 3-10
- Test outcome: Accurate assessment of game quality

---

## Next Steps for User

1. **Review this plan** - Confirm approach makes sense
2. **Invoke BMad agents** - I can start the work via slash commands
3. **Monitor progress** - Agents will work in parallel
4. **Test results** - We'll run real games to verify improvements

Would you like me to start invoking the BMad agents to begin parallel development?
