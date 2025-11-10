/**
 * Tests for GameStateDetector.
 *
 * Verifies game state detection from DOM analysis and vision,
 * state transitions, and stuck state detection.
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import {
  GameStateDetector,
  GameState,
} from "@/browser-agent/gameStateDetector";
import type { DOMAnalysis } from "@/types/qaReport";

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

describe("GameStateDetector", () => {
  let detector: GameStateDetector;
  let mockPage: any;

  beforeEach(() => {
    mockPage = {
      screenshot: mock(() => Promise.resolve(Buffer.from("fake-screenshot"))),
    };
    detector = new GameStateDetector(mockPage);
  });

  describe("DOM-based detection", () => {
    test("detects LOADING state from loading text", async () => {
      const domAnalysis: DOMAnalysis = {
        buttons: [],
        links: [],
        inputs: [],
        canvases: [],
        headings: [
          {
            tag: "h1",
            text: "Loading game assets, please wait...",
            classes: [],
            position: { x: 0, y: 0, width: 100, height: 50 },
            visible: true,
            clickable: false,
          },
        ],
        clickableText: [],
        viewport: { width: 800, height: 600 },
        interactiveCount: 0,
      };

      const result = await detector.detectState(
        Buffer.from("screenshot"),
        domAnalysis,
      );

      expect(result.state).toBe(GameState.LOADING);
      expect(result.confidence).toBeGreaterThan(80);
      expect(result.method).toBe("dom");
    });

    test("detects MENU state from start button", async () => {
      const domAnalysis: DOMAnalysis = {
        buttons: [
          {
            tag: "button",
            text: "Start Game",
            classes: ["btn-start"],
            position: { x: 100, y: 100, width: 50, height: 30 },
            visible: true,
            clickable: true,
          },
        ],
        links: [],
        inputs: [],
        canvases: [
          {
            id: "game-canvas",
            width: 800,
            height: 600,
            position: { x: 0, y: 0, width: 800, height: 600 },
            visible: true,
            isPrimaryGame: true,
          },
        ],
        headings: [],
        clickableText: [],
        viewport: { width: 800, height: 600 },
        interactiveCount: 1,
      };

      const result = await detector.detectState(
        Buffer.from("screenshot"),
        domAnalysis,
      );

      expect(result.state).toBe(GameState.MENU);
      expect(result.confidence).toBeGreaterThan(75);
      expect(result.evidence).toContain("Start Game");
    });

    test("detects PLAYING state from canvas without menu", async () => {
      const domAnalysis: DOMAnalysis = {
        buttons: [],
        links: [],
        inputs: [],
        canvases: [
          {
            id: "game-canvas",
            width: 800,
            height: 600,
            position: { x: 0, y: 0, width: 800, height: 600 },
            visible: true,
            isPrimaryGame: true,
          },
        ],
        headings: [
          {
            tag: "div",
            text: "Level 1",
            classes: [],
            position: { x: 10, y: 10, width: 80, height: 20 },
            visible: true,
            clickable: false,
          },
        ],
        clickableText: [],
        viewport: { width: 800, height: 600 },
        interactiveCount: 0,
      };

      const result = await detector.detectState(
        Buffer.from("screenshot"),
        domAnalysis,
      );

      expect(result.state).toBe(GameState.PLAYING);
      expect(result.confidence).toBeGreaterThan(70);
    });

    test("detects COMPLETE state from game over text", async () => {
      const domAnalysis: DOMAnalysis = {
        buttons: [
          {
            tag: "button",
            text: "Try Again",
            classes: [],
            position: { x: 100, y: 100, width: 50, height: 30 },
            visible: true,
            clickable: true,
          },
        ],
        links: [],
        inputs: [],
        canvases: [
          {
            width: 800,
            height: 600,
            position: { x: 0, y: 0, width: 800, height: 600 },
            visible: true,
            isPrimaryGame: true,
          },
        ],
        headings: [
          {
            tag: "h1",
            text: "Game Over! Your score: 1500",
            classes: [],
            position: { x: 200, y: 200, width: 400, height: 50 },
            visible: true,
            clickable: false,
          },
        ],
        clickableText: [],
        viewport: { width: 800, height: 600 },
        interactiveCount: 1,
      };

      const result = await detector.detectState(
        Buffer.from("screenshot"),
        domAnalysis,
      );

      expect(result.state).toBe(GameState.COMPLETE);
      expect(result.confidence).toBeGreaterThan(75);
    });

    test("returns UNKNOWN for ambiguous DOM", async () => {
      const domAnalysis: DOMAnalysis = {
        buttons: [],
        links: [],
        inputs: [],
        canvases: [],
        headings: [],
        clickableText: [],
        viewport: { width: 800, height: 600 },
        interactiveCount: 0,
      };

      const result = await detector.detectState(
        Buffer.from("screenshot"),
        domAnalysis,
      );

      expect(result.state).toBe(GameState.UNKNOWN);
      expect(result.confidence).toBeLessThan(50);
    });
  });

  describe("State transitions", () => {
    test("records state transition from LOADING to PLAYING", async () => {
      const loadingDOM: DOMAnalysis = {
        buttons: [],
        links: [],
        inputs: [],
        canvases: [],
        headings: [
          {
            tag: "div",
            text: "Loading...",
            classes: [],
            position: { x: 0, y: 0, width: 100, height: 50 },
            visible: true,
            clickable: false,
          },
        ],
        clickableText: [],
        viewport: { width: 800, height: 600 },
        interactiveCount: 0,
      };

      await detector.detectState(Buffer.from("screenshot"), loadingDOM);
      expect(detector.getCurrentState()).toBe(GameState.LOADING);

      const playingDOM: DOMAnalysis = {
        buttons: [],
        links: [],
        inputs: [],
        canvases: [
          {
            width: 800,
            height: 600,
            position: { x: 0, y: 0, width: 800, height: 600 },
            visible: true,
            isPrimaryGame: true,
          },
        ],
        headings: [
          {
            tag: "div",
            text: "Level 1",
            classes: [],
            position: { x: 10, y: 10, width: 80, height: 20 },
            visible: true,
            clickable: false,
          },
        ],
        clickableText: [],
        viewport: { width: 800, height: 600 },
        interactiveCount: 0,
      };

      await detector.detectState(Buffer.from("screenshot2"), playingDOM);
      expect(detector.getCurrentState()).toBe(GameState.PLAYING);

      const history = detector.getHistory();
      expect(history.transitions.length).toBe(2);
      expect(history.transitions[1].from).toBe(GameState.LOADING);
      expect(history.transitions[1].to).toBe(GameState.PLAYING);
    });

    test("does not record duplicate transitions", async () => {
      const playingDOM: DOMAnalysis = {
        buttons: [],
        links: [],
        inputs: [],
        canvases: [
          {
            width: 800,
            height: 600,
            position: { x: 0, y: 0, width: 800, height: 600 },
            visible: true,
            isPrimaryGame: true,
          },
        ],
        headings: [],
        clickableText: [],
        viewport: { width: 800, height: 600 },
        interactiveCount: 0,
      };

      await detector.detectState(Buffer.from("screenshot1"), playingDOM);
      const initialHistoryLength = detector.getHistory().transitions.length;

      await detector.detectState(Buffer.from("screenshot2"), playingDOM);
      const newHistoryLength = detector.getHistory().transitions.length;

      expect(newHistoryLength).toBe(initialHistoryLength);
    });
  });

  describe("Stuck state detection", () => {
    test("detects stuck in state", async () => {
      const domAnalysis: DOMAnalysis = {
        buttons: [],
        links: [],
        inputs: [],
        canvases: [],
        headings: [
          {
            tag: "div",
            text: "Loading...",
            classes: [],
            position: { x: 0, y: 0, width: 100, height: 50 },
            visible: true,
            clickable: false,
          },
        ],
        clickableText: [],
        viewport: { width: 800, height: 600 },
        interactiveCount: 0,
      };

      await detector.detectState(Buffer.from("screenshot"), domAnalysis);

      expect(detector.isStuckInState(100)).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(detector.isStuckInState(100)).toBe(true);
    });

    test("getTimeInCurrentState returns accurate duration", async () => {
      const domAnalysis: DOMAnalysis = {
        buttons: [],
        links: [],
        inputs: [],
        canvases: [],
        headings: [],
        clickableText: [],
        viewport: { width: 800, height: 600 },
        interactiveCount: 0,
      };

      await detector.detectState(Buffer.from("screenshot"), domAnalysis);

      const time1 = detector.getTimeInCurrentState();
      expect(time1).toBeGreaterThanOrEqual(0);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const time2 = detector.getTimeInCurrentState();
      expect(time2).toBeGreaterThan(time1);
      expect(time2).toBeGreaterThanOrEqual(100);
    });
  });

  describe("Vision reasoning extraction", () => {
    test("extracts LOADING from vision reasoning", async () => {
      const domAnalysis: DOMAnalysis = {
        buttons: [],
        links: [],
        inputs: [],
        canvases: [],
        headings: [],
        clickableText: [],
        viewport: { width: 800, height: 600 },
        interactiveCount: 0,
      };

      // Mock VisionAnalyzer to return loading reasoning
      mock.module("@/browser-agent/visionAnalyzer", () => ({
        VisionAnalyzer: class {
          async analyzeScreenshot() {
            return {
              reasoning: "The game is currently loading assets, please wait.",
              confidence: 85,
              nextAction: "Wait for loading to complete",
              actionType: "wait",
            };
          }
        },
      }));

      const result = await detector.detectState(
        Buffer.from("screenshot"),
        domAnalysis,
      );

      expect(result.state).toBe(GameState.LOADING);
      expect(result.method).toBe("vision");
    });
  });

  describe("History tracking", () => {
    test("getHistory returns all transitions", async () => {
      const loadingDOM: DOMAnalysis = {
        buttons: [],
        links: [],
        inputs: [],
        canvases: [],
        headings: [
          {
            tag: "div",
            text: "Loading...",
            classes: [],
            position: { x: 0, y: 0, width: 100, height: 50 },
            visible: true,
            clickable: false,
          },
        ],
        clickableText: [],
        viewport: { width: 800, height: 600 },
        interactiveCount: 0,
      };

      const menuDOM: DOMAnalysis = {
        buttons: [
          {
            tag: "button",
            text: "Play",
            classes: [],
            position: { x: 100, y: 100, width: 50, height: 30 },
            visible: true,
            clickable: true,
          },
        ],
        links: [],
        inputs: [],
        canvases: [
          {
            width: 800,
            height: 600,
            position: { x: 0, y: 0, width: 800, height: 600 },
            visible: true,
            isPrimaryGame: true,
          },
        ],
        headings: [],
        clickableText: [],
        viewport: { width: 800, height: 600 },
        interactiveCount: 1,
      };

      const playingDOM: DOMAnalysis = {
        buttons: [],
        links: [],
        inputs: [],
        canvases: [
          {
            width: 800,
            height: 600,
            position: { x: 0, y: 0, width: 800, height: 600 },
            visible: true,
            isPrimaryGame: true,
          },
        ],
        headings: [],
        clickableText: [],
        viewport: { width: 800, height: 600 },
        interactiveCount: 0,
      };

      await detector.detectState(Buffer.from("s1"), loadingDOM);
      await detector.detectState(Buffer.from("s2"), menuDOM);
      await detector.detectState(Buffer.from("s3"), playingDOM);

      const history = detector.getHistory();

      expect(history.transitions.length).toBe(3);
      expect(history.currentState).toBe(GameState.PLAYING);
      expect(history.transitions[0].from).toBe(GameState.UNKNOWN);
      expect(history.transitions[0].to).toBe(GameState.LOADING);
      expect(history.transitions[1].from).toBe(GameState.LOADING);
      expect(history.transitions[1].to).toBe(GameState.MENU);
      expect(history.transitions[2].from).toBe(GameState.MENU);
      expect(history.transitions[2].to).toBe(GameState.PLAYING);
    });
  });
});
