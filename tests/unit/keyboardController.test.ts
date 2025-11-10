/**
 * Tests for KeyboardController.
 *
 * Verifies keyboard action execution including press, hold,
 * sequence, combo, and error handling.
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { KeyboardController } from "@/browser-agent/keyboardController";

// Mock logger
const mockLogger = {
  child: () => ({
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
  }),
};

// Mock modules
mock.module("@/utils/logger", () => ({
  logger: mockLogger,
}));

describe("KeyboardController", () => {
  let controller: KeyboardController;
  let mockPage: any;
  let keyboardActions: any[];

  beforeEach(() => {
    keyboardActions = [];

    mockPage = {
      keyboard: {
        press: mock((key: string) => {
          keyboardActions.push({ type: "press", key });
          return Promise.resolve();
        }),
        down: mock((key: string) => {
          keyboardActions.push({ type: "down", key });
          return Promise.resolve();
        }),
        up: mock((key: string) => {
          keyboardActions.push({ type: "up", key });
          return Promise.resolve();
        }),
      },
    };

    controller = new KeyboardController(mockPage);
  });

  describe("press()", () => {
    test("executes single key press", async () => {
      const result = await controller.press("Space");

      expect(result.success).toBe(true);
      expect(result.action).toContain("Space");
      expect(keyboardActions.length).toBe(1);
      expect(keyboardActions[0]).toEqual({ type: "press", key: "Space" });
    });

    test("handles different key types", async () => {
      await controller.press("ArrowRight");
      await controller.press("Enter");
      await controller.press("a");

      expect(keyboardActions.length).toBe(3);
      expect(keyboardActions[0].key).toBe("ArrowRight");
      expect(keyboardActions[1].key).toBe("Enter");
      expect(keyboardActions[2].key).toBe("a");
    });

    test("handles press failure", async () => {
      mockPage.keyboard.press = mock(() =>
        Promise.reject(new Error("Key not found")),
      );

      const result = await controller.press("InvalidKey");

      expect(result.success).toBe(false);
      expect(result.action).toContain("Failed");
      expect(result.action).toContain("Key not found");
    });

    test("measures execution duration", async () => {
      const result = await controller.press("Space");

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe("number");
    });
  });

  describe("hold()", () => {
    test("simulates holding key via repeated presses", async () => {
      const result = await controller.hold("ArrowRight", 300, 100);

      expect(result.success).toBe(true);
      expect(result.action).toContain("Held ArrowRight");
      expect(keyboardActions.length).toBeGreaterThanOrEqual(3); // Initial + 2-3 repeats
      expect(
        keyboardActions.every((a) => a.type === "press" && a.key === "ArrowRight"),
      ).toBe(true);
    });

    test("respects hold duration", async () => {
      const startTime = Date.now();
      const result = await controller.hold("ArrowRight", 250, 100);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeGreaterThanOrEqual(250);
      expect(duration).toBeLessThan(400); // Some tolerance
    });

    test("can be aborted mid-hold", async () => {
      const holdPromise = controller.hold("ArrowRight", 1000, 100);

      setTimeout(() => controller.abort(), 200);

      const result = await holdPromise;

      expect(result.success).toBe(true);
      expect(result.duration).toBeLessThan(500); // Aborted early
      expect(keyboardActions.length).toBeLessThan(10); // Fewer presses than full duration
    });

    test("handles hold failure", async () => {
      mockPage.keyboard.press = mock(() =>
        Promise.reject(new Error("Keyboard locked")),
      );

      const result = await controller.hold("ArrowRight", 100, 50);

      expect(result.success).toBe(false);
      expect(result.action).toContain("Failed");
    });

    test("uses custom interval", async () => {
      const result = await controller.hold("ArrowRight", 500, 200);

      expect(result.success).toBe(true);
      // With 200ms interval and 500ms duration, should have ~2-3 presses
      expect(keyboardActions.length).toBeGreaterThanOrEqual(2);
      expect(keyboardActions.length).toBeLessThanOrEqual(4);
    });
  });

  describe("sequence()", () => {
    test("executes timed key sequence", async () => {
      const result = await controller.sequence([
        { key: "ArrowRight", delay: 50 },
        { key: "ArrowRight", delay: 50 },
        { key: "Space", delay: 100 },
      ]);

      expect(result.success).toBe(true);
      expect(result.action).toContain("Sequence");
      expect(keyboardActions.length).toBe(3);
      expect(keyboardActions[0].key).toBe("ArrowRight");
      expect(keyboardActions[1].key).toBe("ArrowRight");
      expect(keyboardActions[2].key).toBe("Space");
    });

    test("respects sequence delays", async () => {
      const startTime = Date.now();
      await controller.sequence([
        { key: "a", delay: 100 },
        { key: "b", delay: 100 },
      ]);
      const duration = Date.now() - startTime;

      // Total delay should be ~200ms
      expect(duration).toBeGreaterThanOrEqual(200);
      expect(duration).toBeLessThan(300);
    });

    test("handles sequence with zero delays", async () => {
      const result = await controller.sequence([
        { key: "a", delay: 0 },
        { key: "b", delay: 0 },
        { key: "c", delay: 0 },
      ]);

      expect(result.success).toBe(true);
      expect(keyboardActions.length).toBe(3);
      expect(result.duration).toBeLessThan(100); // Should be very fast
    });

    test("handles sequence failure", async () => {
      let pressCount = 0;
      mockPage.keyboard.press = mock(() => {
        pressCount++;
        if (pressCount === 2) {
          return Promise.reject(new Error("Press failed"));
        }
        keyboardActions.push({ type: "press", key: "test" });
        return Promise.resolve();
      });

      const result = await controller.sequence([
        { key: "a", delay: 10 },
        { key: "b", delay: 10 },
        { key: "c", delay: 10 },
      ]);

      expect(result.success).toBe(false);
      expect(result.action).toContain("Failed sequence");
    });

    test("includes executed keys in action description", async () => {
      const result = await controller.sequence([
        { key: "ArrowDown", delay: 20 },
        { key: "ArrowRight", delay: 20 },
        { key: "Space", delay: 20 },
      ]);

      expect(result.action).toContain("ArrowDown");
      expect(result.action).toContain("ArrowRight");
      expect(result.action).toContain("Space");
      expect(result.action).toContain("→"); // Sequence arrow
    });
  });

  describe("combo()", () => {
    test("presses multiple keys simultaneously", async () => {
      const result = await controller.combo(["Control", "c"], 200);

      expect(result.success).toBe(true);
      expect(result.action).toContain("Combo");

      // Should have 2 down, then 2 up
      expect(keyboardActions.filter((a) => a.type === "down").length).toBe(2);
      expect(keyboardActions.filter((a) => a.type === "up").length).toBe(2);
    });

    test("down actions come before up actions", async () => {
      await controller.combo(["Shift", "a"], 100);

      const firstDown = keyboardActions.findIndex((a) => a.type === "down");
      const firstUp = keyboardActions.findIndex((a) => a.type === "up");

      expect(firstDown).toBeGreaterThanOrEqual(0);
      expect(firstUp).toBeGreaterThan(firstDown);
    });

    test("releases keys in reverse order", async () => {
      await controller.combo(["Control", "Shift", "c"], 100);

      const upActions = keyboardActions.filter((a) => a.type === "up");

      expect(upActions.length).toBe(3);
      expect(upActions[0].key).toBe("c");
      expect(upActions[1].key).toBe("Shift");
      expect(upActions[2].key).toBe("Control");
    });

    test("respects combo duration", async () => {
      const startTime = Date.now();
      await controller.combo(["Control", "c"], 300);
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(300);
      expect(duration).toBeLessThan(400);
    });

    test("uses default duration", async () => {
      const startTime = Date.now();
      await controller.combo(["Control", "c"]);
      const duration = Date.now() - startTime;

      // Default duration is 500ms
      expect(duration).toBeGreaterThanOrEqual(500);
      expect(duration).toBeLessThan(600);
    });

    test("handles combo failure", async () => {
      mockPage.keyboard.down = mock(() =>
        Promise.reject(new Error("Key stuck")),
      );

      const result = await controller.combo(["Control", "c"]);

      expect(result.success).toBe(false);
      expect(result.action).toContain("Failed combo");
    });

    test("works with single key", async () => {
      const result = await controller.combo(["Space"], 100);

      expect(result.success).toBe(true);
      expect(keyboardActions.length).toBe(2); // 1 down, 1 up
    });
  });

  describe("abort()", () => {
    test("aborts in-progress hold", async () => {
      const holdPromise = controller.hold("ArrowRight", 2000, 100);

      // Abort after 300ms
      setTimeout(() => controller.abort(), 300);

      const result = await holdPromise;

      expect(result.success).toBe(true);
      expect(result.duration).toBeLessThan(1000); // Much less than 2000ms
    });

    test("does nothing when no action in progress", () => {
      // Should not throw
      expect(() => controller.abort()).not.toThrow();
    });

    test("only affects current hold", async () => {
      const hold1 = await controller.hold("a", 100, 50);
      expect(hold1.success).toBe(true);

      const pressCountBefore = keyboardActions.length;

      // Abort should do nothing for already-completed hold
      controller.abort();

      expect(keyboardActions.length).toBe(pressCountBefore);
    });
  });

  describe("execute()", () => {
    test("routes press action", async () => {
      const result = await controller.execute({ type: "press", key: "Space" });

      expect(result.success).toBe(true);
      expect(result.action).toContain("Pressed Space");
    });

    test("routes hold action", async () => {
      const result = await controller.execute({
        type: "hold",
        key: "ArrowRight",
        duration: 100,
      });

      expect(result.success).toBe(true);
      expect(result.action).toContain("Held ArrowRight");
    });

    test("routes sequence action", async () => {
      const result = await controller.execute({
        type: "sequence",
        sequence: [{ key: "w", delay: 50 }],
      });

      expect(result.success).toBe(true);
      expect(result.action).toContain("Sequence");
    });

    test("routes combo action", async () => {
      const result = await controller.execute({
        type: "combo",
        keys: ["Shift", "a"],
      });

      expect(result.success).toBe(true);
      expect(result.action).toContain("Combo");
    });

    test("throws for invalid action type", async () => {
      await expect(
        controller.execute({ type: "invalid" } as any),
      ).rejects.toThrow("Unknown keyboard action type");
    });

    test("throws for press without key", async () => {
      await expect(controller.execute({ type: "press" } as any)).rejects.toThrow(
        "requires 'key'",
      );
    });

    test("throws for hold without key", async () => {
      await expect(
        controller.execute({ type: "hold", duration: 100 } as any),
      ).rejects.toThrow("requires 'key' and 'duration'");
    });

    test("throws for hold without duration", async () => {
      await expect(
        controller.execute({ type: "hold", key: "a" } as any),
      ).rejects.toThrow("requires 'key' and 'duration'");
    });

    test("throws for sequence without sequence", async () => {
      await expect(
        controller.execute({ type: "sequence" } as any),
      ).rejects.toThrow("requires 'sequence'");
    });

    test("throws for combo without keys", async () => {
      await expect(
        controller.execute({ type: "combo" } as any),
      ).rejects.toThrow("requires 'keys'");
    });
  });

  describe("Edge cases", () => {
    test("handles empty sequence", async () => {
      const result = await controller.sequence([]);

      expect(result.success).toBe(true);
      expect(keyboardActions.length).toBe(0);
    });

    test("handles empty combo", async () => {
      const result = await controller.combo([]);

      expect(result.success).toBe(true);
      expect(keyboardActions.length).toBe(0);
    });

    test("handles rapid sequential presses", async () => {
      await controller.press("a");
      await controller.press("b");
      await controller.press("c");

      expect(keyboardActions.length).toBe(3);
      expect(keyboardActions[0].key).toBe("a");
      expect(keyboardActions[1].key).toBe("b");
      expect(keyboardActions[2].key).toBe("c");
    });

    test("handles very short hold duration", async () => {
      const result = await controller.hold("Space", 50, 100);

      expect(result.success).toBe(true);
      // Should have at least 1 press (initial)
      expect(keyboardActions.length).toBeGreaterThanOrEqual(1);
    });
  });
});
