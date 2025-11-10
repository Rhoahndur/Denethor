/**
 * Unit tests for GameplayController.
 *
 * Tests the critical mapVisionToKeyboard() method that fixes the
 * "Keyboard action requires a value" error by mapping generic
 * vision descriptions to specific keyboard keys.
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import {
  GameplayController,
  GameState,
} from "@/browser-agent/gameplayController";

describe("GameplayController", () => {
  let controller: GameplayController;
  let mockPage: any;
  let mockEvidenceStore: any;
  let mockConfig: any;

  beforeEach(() => {
    mockPage = {
      screenshot: mock(() => Promise.resolve(Buffer.from("fake-screenshot"))),
      mouse: {
        click: mock(() => Promise.resolve()),
      },
      keyboard: {
        press: mock(() => Promise.resolve()),
        down: mock(() => Promise.resolve()),
        up: mock(() => Promise.resolve()),
      },
      evaluate: mock(() =>
        Promise.resolve({
          buttons: [],
          canvases: [
            {
              tag: "canvas",
              text: "",
              position: { x: 0, y: 0, width: 800, height: 600 },
              visible: true,
              clickable: false,
              isPrimaryGame: true,
              id: "game-canvas",
              width: 800,
              height: 600,
            },
          ],
          links: [],
          inputs: [],
          headings: [],
          clickableText: [],
          viewport: {
            width: 1280,
            height: 720,
          },
          interactiveCount: 0,
        }),
      ),
    };

    mockEvidenceStore = {
      captureScreenshot: mock(() => Promise.resolve()),
    };

    mockConfig = {
      maxActions: 5,
      maxDuration: 10000,
      actionInterval: 100,
      inputHint: "Arrow keys for movement, spacebar to jump",
    };

    controller = new GameplayController(
      mockPage,
      mockEvidenceStore,
      mockConfig,
    );
  });

  describe("mapVisionToKeyboard()", () => {
    test("maps 'move right' to ArrowRight hold", () => {
      const visionResult = {
        nextAction: "Move right to collect items",
        targetDescription: "Use arrow keys",
        reasoning: "Character should move right",
      };

      const action = controller.mapVisionToKeyboard(
        visionResult,
        GameState.PLAYING,
      );

      expect(action).not.toBeNull();
      expect(action?.type).toBe("hold");
      if (action?.type === "hold") {
        expect(action.key).toBe("ArrowRight");
        expect(action.duration).toBe(2000);
      }
    });

    test("maps 'jump' to Space press", () => {
      const visionResult = {
        nextAction: "Jump over obstacle",
        targetDescription: "Press spacebar",
        reasoning: "Obstacle ahead, jump required",
      };

      const action = controller.mapVisionToKeyboard(
        visionResult,
        GameState.PLAYING,
      );

      expect(action).not.toBeNull();
      expect(action?.type).toBe("press");
      if (action?.type === "press") {
        expect(action.key).toBe("Space");
      }
    });

    test("maps 'move left' to ArrowLeft hold", () => {
      const visionResult = {
        nextAction: "Move left to avoid enemy",
        targetDescription: "Arrow keys",
        reasoning: "Enemy on right, go left",
      };

      const action = controller.mapVisionToKeyboard(
        visionResult,
        GameState.PLAYING,
      );

      expect(action).not.toBeNull();
      expect(action?.type).toBe("hold");
      if (action?.type === "hold") {
        expect(action.key).toBe("ArrowLeft");
        expect(action.duration).toBe(2000);
      }
    });

    test("maps 'move up' to ArrowUp hold", () => {
      const visionResult = {
        nextAction: "Go up the ladder",
        targetDescription: "Press up arrow",
        reasoning: "Ladder ahead, climb up",
      };

      const action = controller.mapVisionToKeyboard(
        visionResult,
        GameState.PLAYING,
      );

      expect(action).not.toBeNull();
      expect(action?.type).toBe("hold");
      if (action?.type === "hold") {
        expect(action.key).toBe("ArrowUp");
        expect(action.duration).toBe(2000);
      }
    });

    test("maps 'move down' to ArrowDown hold", () => {
      const visionResult = {
        nextAction: "Move down to lower platform",
        targetDescription: "Down arrow key",
        reasoning: "Lower platform visible",
      };

      const action = controller.mapVisionToKeyboard(
        visionResult,
        GameState.PLAYING,
      );

      expect(action).not.toBeNull();
      expect(action?.type).toBe("hold");
      if (action?.type === "hold") {
        expect(action.key).toBe("ArrowDown");
        expect(action.duration).toBe(2000);
      }
    });

    test("maps WASD - 'press w' to w key", () => {
      const wResult = {
        nextAction: "Press w to move forward",
        targetDescription: "WASD controls",
        reasoning: "Move forward",
      };

      const action = controller.mapVisionToKeyboard(wResult, GameState.PLAYING);

      expect(action).not.toBeNull();
      expect(action?.type).toBe("hold");
      if (action?.type === "hold") {
        expect(action.key).toBe("w");
      }
    });

    test("maps WASD - 'press a' to a key", () => {
      const aResult = {
        nextAction: "Press a to move left",
        targetDescription: "WASD controls",
        reasoning: "Move left",
      };

      const action = controller.mapVisionToKeyboard(aResult, GameState.PLAYING);

      expect(action).not.toBeNull();
      if (action?.type === "hold") {
        expect(action.key).toBe("a");
      }
    });

    test("maps WASD - 'press s' to s key", () => {
      const sResult = {
        nextAction: "Press s to move backward",
        targetDescription: "WASD controls",
        reasoning: "Move back",
      };

      const action = controller.mapVisionToKeyboard(sResult, GameState.PLAYING);

      expect(action).not.toBeNull();
      if (action?.type === "hold") {
        expect(action.key).toBe("s");
      }
    });

    test("maps WASD - 'press d' to d key", () => {
      const dResult = {
        nextAction: "Press d to move right",
        targetDescription: "WASD controls",
        reasoning: "Move right",
      };

      const action = controller.mapVisionToKeyboard(dResult, GameState.PLAYING);

      expect(action).not.toBeNull();
      if (action?.type === "hold") {
        expect(action.key).toBe("d");
      }
    });

    test("maps 'enter' to Enter press", () => {
      const visionResult = {
        nextAction: "Press enter to confirm",
        targetDescription: "Enter key",
        reasoning: "Confirm selection",
      };

      const action = controller.mapVisionToKeyboard(
        visionResult,
        GameState.PLAYING,
      );

      expect(action).not.toBeNull();
      if (action?.type === "press") {
        expect(action.key).toBe("Enter");
      }
    });

    test("maps 'escape' to Escape press", () => {
      const visionResult = {
        nextAction: "Press escape to pause",
        targetDescription: "Escape key",
        reasoning: "Open pause menu",
      };

      const action = controller.mapVisionToKeyboard(
        visionResult,
        GameState.PLAYING,
      );

      expect(action).not.toBeNull();
      if (action?.type === "press") {
        expect(action.key).toBe("Escape");
      }
    });

    test("creates sequence for 'move right and jump'", () => {
      const visionResult = {
        nextAction: "Move right and jump over gap",
        targetDescription: "Arrow keys and space",
        reasoning: "Gap ahead, need to run and jump",
      };

      const action = controller.mapVisionToKeyboard(
        visionResult,
        GameState.PLAYING,
      );

      expect(action).not.toBeNull();
      expect(action?.type).toBe("sequence");
      if (action?.type === "sequence") {
        expect(action.sequence).toBeDefined();
        expect(action.sequence.length).toBe(2);
        expect(action.sequence[0]?.key).toBe("ArrowRight");
        expect(action.sequence[1]?.key).toBe("Space");
      }
    });

    test("creates sequence for 'jump and move left'", () => {
      const visionResult = {
        nextAction: "Jump left over obstacle",
        targetDescription: "Jump and move left",
        reasoning: "Obstacle requires jump to left",
      };

      const action = controller.mapVisionToKeyboard(
        visionResult,
        GameState.PLAYING,
      );

      expect(action).not.toBeNull();
      expect(action?.type).toBe("sequence");
      if (action?.type === "sequence") {
        expect(action.sequence.length).toBe(2);
        expect(action.sequence[0]?.key).toBe("ArrowLeft");
        expect(action.sequence[1]?.key).toBe("Space");
      }
    });

    test("uses inputHint for generic 'arrow' mention with arrow hint", () => {
      const visionResult = {
        nextAction: "Use arrow keys",
        targetDescription: "Keyboard controls",
        reasoning: "Navigate the level",
      };

      const action = controller.mapVisionToKeyboard(
        visionResult,
        GameState.PLAYING,
      );

      // Should default to ArrowRight when arrows mentioned and hint has arrows
      expect(action).not.toBeNull();
      if (action?.type === "hold") {
        expect(action.key).toBe("ArrowRight");
      }
    });

    test("uses inputHint for generic 'wasd' mention with wasd hint", () => {
      // Create controller with WASD hint
      const wasdConfig = {
        ...mockConfig,
        inputHint: "WASD for movement",
      };
      const wasdController = new GameplayController(
        mockPage,
        mockEvidenceStore,
        wasdConfig,
      );

      const visionResult = {
        nextAction: "Use wasd keys",
        targetDescription: "Keyboard controls",
        reasoning: "Navigate with WASD",
      };

      const action = wasdController.mapVisionToKeyboard(
        visionResult,
        GameState.PLAYING,
      );

      // Should default to 'd' (right) when WASD mentioned and hint has wasd
      expect(action).not.toBeNull();
      if (action?.type === "hold") {
        expect(action.key).toBe("d");
      }
    });

    test("returns null for unmappable actions", () => {
      const visionResult = {
        nextAction: "Do something unclear",
        targetDescription: "Unknown control",
        reasoning: "Uncertain what to do",
      };

      const action = controller.mapVisionToKeyboard(
        visionResult,
        GameState.PLAYING,
      );

      expect(action).toBeNull();
    });

    test("handles missing fields gracefully", () => {
      const visionResult = {
        nextAction: undefined,
        targetDescription: undefined,
        reasoning: undefined,
      };

      const action = controller.mapVisionToKeyboard(
        visionResult,
        GameState.PLAYING,
      );

      expect(action).toBeNull();
    });

    test("is case-insensitive for matching", () => {
      const visionResult = {
        nextAction: "MOVE RIGHT",
        targetDescription: "USE ARROW KEYS",
        reasoning: "CHARACTER SHOULD MOVE RIGHT",
      };

      const action = controller.mapVisionToKeyboard(
        visionResult,
        GameState.PLAYING,
      );

      expect(action).not.toBeNull();
      if (action?.type === "hold") {
        expect(action.key).toBe("ArrowRight");
      }
    });

    test("maps variations of jump commands", () => {
      const testCases = [
        { nextAction: "Jump", expected: "Space" },
        { nextAction: "Press space", expected: "Space" },
        { nextAction: "Hit spacebar", expected: "Space" },
        { nextAction: "Use space to jump", expected: "Space" },
      ];

      for (const testCase of testCases) {
        const action = controller.mapVisionToKeyboard(
          {
            nextAction: testCase.nextAction,
            targetDescription: "",
            reasoning: "",
          },
          GameState.PLAYING,
        );

        expect(action).not.toBeNull();
        if (action?.type === "press") {
          expect(action.key).toBe(testCase.expected);
        }
      }
    });

    test("prioritizes specific direction over generic arrow mention", () => {
      const visionResult = {
        nextAction: "Press right arrow",
        targetDescription: "Use arrow keys for movement",
        reasoning: "Move to the right side",
      };

      const action = controller.mapVisionToKeyboard(
        visionResult,
        GameState.PLAYING,
      );

      expect(action).not.toBeNull();
      // Should map to ArrowRight specifically, not generic arrow
      if (action?.type === "hold") {
        expect(action.key).toBe("ArrowRight");
      }
    });
  });

  describe("constructor", () => {
    test("initializes with provided config", () => {
      expect(controller).toBeDefined();
      expect((controller as any).config).toEqual(mockConfig);
    });

    test("creates state detector", () => {
      expect((controller as any).stateDetector).toBeDefined();
    });

    test("creates keyboard controller", () => {
      expect((controller as any).keyboardController).toBeDefined();
    });

    test("creates vision analyzer", () => {
      expect((controller as any).visionAnalyzer).toBeDefined();
    });
  });

  describe("stop()", () => {
    test("sets isPlaying to false", () => {
      (controller as any).isPlaying = true;
      controller.stop();
      expect((controller as any).isPlaying).toBe(false);
    });

    test("calls keyboard controller abort", () => {
      const abortMock = mock(() => {});
      (controller as any).keyboardController.abort = abortMock;

      controller.stop();

      expect(abortMock).toHaveBeenCalled();
    });
  });
});
