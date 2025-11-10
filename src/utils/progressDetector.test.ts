import { describe, it, expect, beforeEach } from "bun:test";
import {
  ProgressDetector,
  hashBuffer,
  buffersEqual,
  calculateProgressScore,
  type ProgressMetrics,
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
      const metrics = detector.getMetrics();
      expect(metrics.screenshotsWithChanges).toBe(0); // First doesn't count as change
      expect(metrics.uniqueGameStates).toBe(1);
      expect(metrics.inputsAttempted).toBe(1);
    });

    it("should detect changed screenshots", () => {
      const screenshot1 = Buffer.from("test image 1");
      const screenshot2 = Buffer.from("test image 2");

      detector.recordScreenshot(screenshot1, "click");
      const changed = detector.recordScreenshot(screenshot2, "click");

      expect(changed).toBe(true);
      const metrics = detector.getMetrics();
      expect(metrics.screenshotsWithChanges).toBe(1);
      expect(metrics.uniqueGameStates).toBe(2);
      expect(metrics.inputsSuccessful).toBe(1);
    });

    it("should detect identical screenshots", () => {
      const screenshot1 = Buffer.from("test image 1");
      const screenshot2 = Buffer.from("test image 1"); // Same content

      detector.recordScreenshot(screenshot1, "click");
      const changed = detector.recordScreenshot(screenshot2, "click");

      expect(changed).toBe(false);
      const metrics = detector.getMetrics();
      expect(metrics.screenshotsIdentical).toBe(1);
      expect(metrics.consecutiveIdentical).toBe(1);
    });

    it("should track consecutive identical screenshots", () => {
      const screenshot = Buffer.from("stuck screen");

      detector.recordScreenshot(screenshot, "click");
      detector.recordScreenshot(screenshot, "click");
      detector.recordScreenshot(screenshot, "click");
      detector.recordScreenshot(screenshot, "click");
      detector.recordScreenshot(screenshot, "click");

      const metrics = detector.getMetrics();
      expect(metrics.consecutiveIdentical).toBe(4);
      expect(metrics.screenshotsIdentical).toBe(4);
    });

    it("should reset consecutive count when screen changes", () => {
      const screenshot1 = Buffer.from("screen 1");
      const screenshot2 = Buffer.from("screen 2");

      detector.recordScreenshot(screenshot1, "click");
      detector.recordScreenshot(screenshot1, "click");
      detector.recordScreenshot(screenshot1, "click");
      detector.recordScreenshot(screenshot2, "click"); // Changed!

      const metrics = detector.getMetrics();
      expect(metrics.consecutiveIdentical).toBe(0);
      expect(metrics.screenshotsWithChanges).toBe(1);
    });

    it("should track unique game states correctly", () => {
      const screenshot1 = Buffer.from("state 1");
      const screenshot2 = Buffer.from("state 2");
      const screenshot3 = Buffer.from("state 1"); // Back to state 1

      detector.recordScreenshot(screenshot1, "click");
      detector.recordScreenshot(screenshot2, "click");
      detector.recordScreenshot(screenshot3, "click");

      const metrics = detector.getMetrics();
      expect(metrics.uniqueGameStates).toBe(2); // Only 2 unique states
      expect(metrics.seenStates.size).toBe(2);
    });

    it("should calculate progress score after each screenshot", () => {
      const screenshot1 = Buffer.from("state 1");
      const screenshot2 = Buffer.from("state 2");
      const screenshot3 = Buffer.from("state 3");

      detector.recordScreenshot(screenshot1, "click");
      const metrics1 = detector.getMetrics();
      // First screenshot has score from unique state bonus only
      expect(metrics1.progressScore).toBeGreaterThanOrEqual(0);

      detector.recordScreenshot(screenshot2, "click");
      const metrics2 = detector.getMetrics();
      // Second screenshot shows change, should have higher score
      expect(metrics2.progressScore).toBeGreaterThan(0);

      detector.recordScreenshot(screenshot3, "click");
      const metrics3 = detector.getMetrics();
      // Third screenshot shows another change, score should increase
      expect(metrics3.progressScore).toBeGreaterThan(metrics2.progressScore);
    });

    it("should track inputs attempted and successful", () => {
      const screenshot1 = Buffer.from("state 1");
      const screenshot2 = Buffer.from("state 2");
      const screenshot3 = Buffer.from("state 2"); // Same as previous

      detector.recordScreenshot(screenshot1, "click");
      detector.recordScreenshot(screenshot2, "click");
      detector.recordScreenshot(screenshot3, "click");

      const metrics = detector.getMetrics();
      expect(metrics.inputsAttempted).toBe(3);
      expect(metrics.inputsSuccessful).toBe(1); // Only second screenshot caused change
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
      expect(detector.isStuck()).toBe(false);

      detector.recordScreenshot(screenshot, "click");
      expect(detector.isStuck()).toBe(false);

      detector.recordScreenshot(screenshot, "click");
      expect(detector.isStuck()).toBe(false);

      detector.recordScreenshot(screenshot, "click");
      expect(detector.isStuck()).toBe(false);

      detector.recordScreenshot(screenshot, "click");
      expect(detector.isStuck()).toBe(false);

      detector.recordScreenshot(screenshot, "click");
      expect(detector.isStuck()).toBe(true); // 5 consecutive
    });

    it("should support custom threshold", () => {
      const screenshot = Buffer.from("stuck screen");

      detector.recordScreenshot(screenshot, "click");
      detector.recordScreenshot(screenshot, "click");
      detector.recordScreenshot(screenshot, "click");
      detector.recordScreenshot(screenshot, "click");

      expect(detector.isStuck(3)).toBe(true); // Custom threshold - 3 consecutive identical
      expect(detector.isStuck(5)).toBe(false); // Default threshold - not 5 yet
    });

    it("should reset stuck status when screen changes", () => {
      const screenshot1 = Buffer.from("stuck screen");
      const screenshot2 = Buffer.from("different screen");

      // Get stuck
      for (let i = 0; i < 6; i++) {
        detector.recordScreenshot(screenshot1, "click");
      }
      expect(detector.isStuck()).toBe(true);

      // Screen changes - should no longer be stuck
      detector.recordScreenshot(screenshot2, "click");
      expect(detector.isStuck()).toBe(false);
    });
  });

  describe("getMetrics", () => {
    it("should return copy of metrics with copied Set", () => {
      const screenshot = Buffer.from("test");
      detector.recordScreenshot(screenshot, "click");

      const metrics1 = detector.getMetrics();
      const metrics2 = detector.getMetrics();

      // Should be different Set instances
      expect(metrics1.seenStates).not.toBe(metrics2.seenStates);
      // But have same content
      expect(metrics1.seenStates.size).toBe(metrics2.seenStates.size);
    });

    it("should return complete metrics", () => {
      const screenshot1 = Buffer.from("state 1");
      const screenshot2 = Buffer.from("state 2");

      detector.recordScreenshot(screenshot1, "click");
      detector.recordScreenshot(screenshot2, "wait");

      const metrics = detector.getMetrics();

      expect(metrics).toHaveProperty("screenshotsWithChanges");
      expect(metrics).toHaveProperty("screenshotsIdentical");
      expect(metrics).toHaveProperty("consecutiveIdentical");
      expect(metrics).toHaveProperty("uniqueGameStates");
      expect(metrics).toHaveProperty("inputsAttempted");
      expect(metrics).toHaveProperty("inputsSuccessful");
      expect(metrics).toHaveProperty("progressScore");
      expect(metrics).toHaveProperty("seenStates");
    });
  });

  describe("getLastScreenshotHash", () => {
    it("should return null when no screenshots recorded", () => {
      expect(detector.getLastScreenshotHash()).toBe(null);
    });

    it("should return hash of last screenshot", () => {
      const screenshot1 = Buffer.from("state 1");
      const screenshot2 = Buffer.from("state 2");

      detector.recordScreenshot(screenshot1, "click");
      const hash1 = detector.getLastScreenshotHash();

      detector.recordScreenshot(screenshot2, "click");
      const hash2 = detector.getLastScreenshotHash();

      expect(hash1).not.toBe(null);
      expect(hash2).not.toBe(null);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("reset", () => {
    it("should reset all metrics to initial state", () => {
      const screenshot1 = Buffer.from("state 1");
      const screenshot2 = Buffer.from("state 2");

      detector.recordScreenshot(screenshot1, "click");
      detector.recordScreenshot(screenshot2, "click");

      detector.reset();

      const metrics = detector.getMetrics();
      expect(metrics.screenshotsWithChanges).toBe(0);
      expect(metrics.screenshotsIdentical).toBe(0);
      expect(metrics.consecutiveIdentical).toBe(0);
      expect(metrics.uniqueGameStates).toBe(0);
      expect(metrics.inputsAttempted).toBe(0);
      expect(metrics.inputsSuccessful).toBe(0);
      expect(metrics.progressScore).toBe(0);
      expect(metrics.seenStates.size).toBe(0);
      expect(detector.getLastScreenshotHash()).toBe(null);
    });
  });
});

describe("calculateProgressScore", () => {
  it("should calculate 100% for perfect success rate", () => {
    const metrics: ProgressMetrics = {
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
    expect(score).toBe(100);
  });

  it("should calculate 0% for no successful inputs with minimal bonus", () => {
    const metrics: ProgressMetrics = {
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
    expect(score).toBe(5); // 0% success + 5 bonus (1 unique state * 5)
  });

  it("should calculate 0 for no attempts", () => {
    const metrics: ProgressMetrics = {
      inputsAttempted: 0,
      inputsSuccessful: 0,
      uniqueGameStates: 0,
      screenshotsWithChanges: 0,
      screenshotsIdentical: 0,
      consecutiveIdentical: 0,
      progressScore: 0,
      seenStates: new Set<string>(),
    };

    const score = calculateProgressScore(metrics);
    expect(score).toBe(0);
  });

  it("should add bonus for unique states", () => {
    const metricsWithFewStates: ProgressMetrics = {
      inputsAttempted: 10,
      inputsSuccessful: 5,
      uniqueGameStates: 1,
      screenshotsWithChanges: 5,
      screenshotsIdentical: 5,
      consecutiveIdentical: 0,
      progressScore: 0,
      seenStates: new Set<string>(),
    };

    const metricsWithManyStates: ProgressMetrics = {
      ...metricsWithFewStates,
      uniqueGameStates: 10,
    };

    const scoreFew = calculateProgressScore(metricsWithFewStates);
    const scoreMany = calculateProgressScore(metricsWithManyStates);

    expect(scoreMany).toBeGreaterThan(scoreFew);
    // 1 state gives 5 bonus, 10 states gives 20 bonus (capped at 20)
    // So difference is 15 points
    expect(scoreMany - scoreFew).toBe(15);
  });

  it("should cap unique state bonus at 20 points", () => {
    const metrics: ProgressMetrics = {
      inputsAttempted: 10,
      inputsSuccessful: 5,
      uniqueGameStates: 100, // Way more than needed
      screenshotsWithChanges: 5,
      screenshotsIdentical: 5,
      consecutiveIdentical: 0,
      progressScore: 0,
      seenStates: new Set<string>(),
    };

    const score = calculateProgressScore(metrics);
    // 50% success rate + max 20 bonus = 70
    expect(score).toBe(70);
  });

  it("should cap total score at 100", () => {
    const metrics: ProgressMetrics = {
      inputsAttempted: 10,
      inputsSuccessful: 10,
      uniqueGameStates: 20, // Would give 100 bonus if not capped
      screenshotsWithChanges: 10,
      screenshotsIdentical: 0,
      consecutiveIdentical: 0,
      progressScore: 0,
      seenStates: new Set<string>(),
    };

    const score = calculateProgressScore(metrics);
    expect(score).toBe(100); // Capped at 100
  });

  it("should handle 50% success rate correctly", () => {
    const metrics: ProgressMetrics = {
      inputsAttempted: 10,
      inputsSuccessful: 5,
      uniqueGameStates: 2,
      screenshotsWithChanges: 5,
      screenshotsIdentical: 5,
      consecutiveIdentical: 0,
      progressScore: 0,
      seenStates: new Set<string>(),
    };

    const score = calculateProgressScore(metrics);
    expect(score).toBe(60); // 50% + (2 * 5) = 60
  });
});

describe("utility functions", () => {
  describe("hashBuffer", () => {
    it("should produce consistent hashes", () => {
      const buffer = Buffer.from("test data");
      const hash1 = hashBuffer(buffer);
      const hash2 = hashBuffer(buffer);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex string
    });

    it("should produce different hashes for different data", () => {
      const buffer1 = Buffer.from("test data 1");
      const buffer2 = Buffer.from("test data 2");

      const hash1 = hashBuffer(buffer1);
      const hash2 = hashBuffer(buffer2);

      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty buffer", () => {
      const buffer = Buffer.from("");
      const hash = hashBuffer(buffer);

      expect(hash).toHaveLength(64);
      expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    });

    it("should handle large buffers", () => {
      const buffer = Buffer.alloc(1024 * 1024); // 1MB
      buffer.fill("x");

      const hash = hashBuffer(buffer);
      expect(hash).toHaveLength(64);
    });
  });

  describe("buffersEqual", () => {
    it("should detect equal buffers", () => {
      const buffer1 = Buffer.from("same data");
      const buffer2 = Buffer.from("same data");

      expect(buffersEqual(buffer1, buffer2)).toBe(true);
    });

    it("should detect different buffers", () => {
      const buffer1 = Buffer.from("data 1");
      const buffer2 = Buffer.from("data 2");

      expect(buffersEqual(buffer1, buffer2)).toBe(false);
    });

    it("should detect different length buffers", () => {
      const buffer1 = Buffer.from("short");
      const buffer2 = Buffer.from("much longer buffer");

      expect(buffersEqual(buffer1, buffer2)).toBe(false);
    });

    it("should handle empty buffers", () => {
      const buffer1 = Buffer.from("");
      const buffer2 = Buffer.from("");

      expect(buffersEqual(buffer1, buffer2)).toBe(true);
    });

    it("should detect subtle differences", () => {
      const buffer1 = Buffer.from("test data");
      const buffer2 = Buffer.from("test datA"); // Last char different

      expect(buffersEqual(buffer1, buffer2)).toBe(false);
    });
  });
});

describe("Integration scenarios", () => {
  it("should track a typical game session", () => {
    const detector = new ProgressDetector();

    // Load screen
    const loadScreen = Buffer.from("loading...");
    detector.recordScreenshot(loadScreen, "wait");

    // Menu appears
    const menuScreen = Buffer.from("main menu");
    detector.recordScreenshot(menuScreen, "wait");

    // Click start button - no change (still loading)
    detector.recordScreenshot(menuScreen, "click");
    detector.recordScreenshot(menuScreen, "click");

    // Game starts
    const gameScreen1 = Buffer.from("level 1 - frame 1");
    detector.recordScreenshot(gameScreen1, "click");

    // Gameplay progresses
    const gameScreen2 = Buffer.from("level 1 - frame 2");
    detector.recordScreenshot(gameScreen2, "keyboard");

    const gameScreen3 = Buffer.from("level 1 - frame 3");
    detector.recordScreenshot(gameScreen3, "keyboard");

    const metrics = detector.getMetrics();

    expect(metrics.uniqueGameStates).toBeGreaterThanOrEqual(4);
    expect(metrics.inputsAttempted).toBe(7);
    expect(metrics.inputsSuccessful).toBeGreaterThan(0);
    expect(metrics.progressScore).toBeGreaterThan(0);
    expect(detector.isStuck()).toBe(false);
  });

  it("should detect stuck game scenario", () => {
    const detector = new ProgressDetector();

    const stuckScreen = Buffer.from("frozen screen");

    // Game gets stuck
    for (let i = 0; i < 10; i++) {
      detector.recordScreenshot(stuckScreen, "click");
    }

    const metrics = detector.getMetrics();

    expect(detector.isStuck()).toBe(true);
    expect(metrics.consecutiveIdentical).toBe(9);
    expect(metrics.uniqueGameStates).toBe(1);
    expect(metrics.progressScore).toBeLessThan(30);
  });

  it("should track recovery from stuck state", () => {
    const detector = new ProgressDetector();

    const stuckScreen = Buffer.from("stuck");
    const recoveredScreen = Buffer.from("recovered");

    // Get stuck
    for (let i = 0; i < 6; i++) {
      detector.recordScreenshot(stuckScreen, "click");
    }
    expect(detector.isStuck()).toBe(true);

    // Recover
    detector.recordScreenshot(recoveredScreen, "click");
    expect(detector.isStuck()).toBe(false);

    const metrics = detector.getMetrics();
    expect(metrics.consecutiveIdentical).toBe(0);
    expect(metrics.screenshotsWithChanges).toBe(1);
  });
});
