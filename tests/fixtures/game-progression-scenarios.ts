/**
 * Test Fixtures for Game Progression Scenarios (v1.4.0)
 *
 * Provides common scenarios for testing progress detection and unstick strategies.
 * These fixtures represent typical game states and expected behaviors.
 *
 * @module gameProgressionScenarios
 */

import type { DOMAnalysis } from "@/types/qaReport";

/**
 * Scenario 1: Game Stuck on Loading Screen
 *
 * Represents a game that displays a loading spinner and never progresses.
 * Tests the progress detection system's ability to identify stuck condition
 * and trigger unstick strategies.
 *
 * Expected behavior:
 * - progressDetector should detect 5+ consecutive identical screenshots
 * - isStuck() should return true
 * - Unstick strategies should be triggered
 * - Progress score should remain 0
 */
export const stuckOnLoadingScreen = {
  url: "https://example.com/stuck-loading-game",
  gameTitle: "Infinite Loading Game",
  description: "Game displays loading spinner indefinitely",

  /**
   * DOM Analysis snapshot - minimal interactive elements
   */
  domAnalysis: {
    buttons: [], // No buttons visible
    links: [],
    inputs: [],
    canvases: [
      {
        id: "game-canvas",
        width: 800,
        height: 600,
        visible: true,
        isPrimaryGame: true,
        position: { x: 0, y: 0, width: 800, height: 600 },
      },
    ],
    headings: [
      {
        tag: "h1",
        text: "Loading...",
        visible: true,
        position: { x: 300, y: 250, width: 200, height: 50 },
      },
    ],
    clickableText: [],
    viewport: { width: 1280, height: 720 },
    interactiveCount: 0,
  } as DOMAnalysis,

  /**
   * Screenshots simulation - all identical
   */
  screenshotSequence: [
    Buffer.from("loading-spinner-1"),
    Buffer.from("loading-spinner-1"), // Identical - frame 2
    Buffer.from("loading-spinner-1"), // Identical - frame 3
    Buffer.from("loading-spinner-1"), // Identical - frame 4
    Buffer.from("loading-spinner-1"), // Identical - frame 5
    Buffer.from("loading-spinner-1"), // Identical - frame 6 (isStuck threshold)
  ],

  expectedBehavior: {
    progressScore: 0,
    uniqueGameStates: 1,
    inputsSuccessful: 0,
    inputsAttempted: 6,
    consecutiveIdentical: 6,
    isStuck: true,
    shouldTriggerUnstick: true,
  },

  /**
   * Diagnosis hints
   */
  diagnostics: {
    rootCause: "Game loading animation plays forever",
    possibleReasons: [
      "Server not responding to game initialization",
      "Infinite asset loading loop",
      "Game initialization failed silently",
      "Network timeout on asset fetch",
    ],
    recommendedFix: "Increase timeout and check server logs",
  },
};

/**
 * Scenario 2: Itch.io Embedded Game
 *
 * Represents a game hosted on itch.io and embedded in an iframe.
 * Tests iframe detection and context switching.
 *
 * Expected behavior:
 * - Iframe Detection strategy should find #game_drop or iframe
 * - Should switch to iframe content frame
 * - Should attempt interactions within iframe
 * - Progress should improve after iframe switch
 */
export const itchIoGame = {
  url: "https://meiri.itch.io/doce-fim",
  gameTitle: "Doce Fim (itch.io)",
  description: "Game hosted on itch.io in iframe",
  platform: "itch.io",

  /**
   * DOM Analysis snapshot - typical itch.io page structure
   */
  domAnalysis: {
    buttons: [
      {
        tag: "button",
        text: "Run game",
        id: "run-button",
        classes: ["run-btn"],
        position: { x: 100, y: 50, width: 120, height: 40 },
        visible: true,
        clickable: true,
      },
    ],
    links: [
      {
        tag: "a",
        text: "Project Page",
        href: "https://meiri.itch.io/doce-fim",
        position: { x: 10, y: 10, width: 100, height: 30 },
        visible: true,
      },
    ],
    inputs: [],
    canvases: [], // Canvas is in iframe, not visible in main DOM
    headings: [
      {
        tag: "h1",
        text: "Doce Fim",
        visible: true,
        position: { x: 200, y: 20, width: 200, height: 40 },
      },
    ],
    clickableText: [],
    viewport: { width: 1280, height: 720 },
    interactiveCount: 1,
  } as DOMAnalysis,

  /**
   * Iframe selectors that should be detected
   */
  iframeSelectors: [
    "#game_drop", // Standard itch.io selector
    "iframe[src*='itch.io']",
    "iframe[src*='game']",
    ".game-frame",
  ],

  /**
   * Expected game content inside iframe
   */
  iframeContent: {
    canvasId: "unityCanvas", // Common for itch.io Unity games
    width: 800,
    height: 600,
  },

  /**
   * Screenshots simulation - main page then game in iframe
   */
  screenshotSequence: [
    Buffer.from("itch-main-page"), // Screenshot of itch.io page
    Buffer.from("game-loading-in-iframe"), // Game starts loading
    Buffer.from("game-start-screen"), // Game shows start screen
    Buffer.from("game-in-progress"), // Game progressing
  ],

  expectedBehavior: {
    progressScore: 65, // Game is progressing
    uniqueGameStates: 4,
    inputsSuccessful: 3,
    inputsAttempted: 4,
    iframeDetected: true,
    iframeContextSwitched: true,
  },

  /**
   * Diagnosis hints
   */
  diagnostics: {
    rootCause: "Game is embedded in itch.io iframe",
    possibleIssues: [
      "Iframe selector changed",
      "Game fails to load in sandbox context",
      "Cross-origin restrictions",
    ],
    recommendedFix: "Verify iframe selector in unstick strategies",
  },
};

/**
 * Scenario 3: Keyboard-Only Game
 *
 * Represents a game that only responds to keyboard input.
 * Tests keyboard mash strategy and input hint handling.
 *
 * Expected behavior:
 * - Click actions should not change screen
 * - Keyboard actions (Space, Enter, WASD) should work
 * - Keyboard Mash strategy should find working key
 * - Progress should improve after first keyboard press
 */
export const keyboardOnlyGame = {
  url: "https://example.com/keyboard-only-platformer",
  gameTitle: "Keyboard Only Platformer",
  description: "Game responds only to keyboard input, not mouse clicks",
  controlScheme: "keyboard",

  /**
   * DOM Analysis snapshot - game canvas with no interactive buttons
   */
  domAnalysis: {
    buttons: [], // No buttons - keyboard only
    links: [],
    inputs: [],
    canvases: [
      {
        id: "game",
        width: 640,
        height: 480,
        visible: true,
        isPrimaryGame: true,
        position: { x: 320, y: 120, width: 640, height: 480 },
      },
    ],
    headings: [
      {
        tag: "h2",
        text: "Press SPACE to Start",
        visible: true,
        position: { x: 250, y: 200, width: 380, height: 40 },
      },
    ],
    clickableText: [], // Text not clickable
    viewport: { width: 1280, height: 720 },
    interactiveCount: 0, // No clickable elements
  } as DOMAnalysis,

  /**
   * Screenshots simulation - keyboard-driven progression
   */
  screenshotSequence: [
    Buffer.from("start-screen-keyboard"), // "Press Space to Start"
    Buffer.from("start-screen-keyboard"), // Click doesn't work (frame 2, identical)
    Buffer.from("start-screen-keyboard"), // Another click (frame 3, still identical)
    Buffer.from("game-level-1"), // Space key works! (frame 4, changed)
    Buffer.from("game-level-1-progressing"), // Continue with arrow keys (frame 5)
    Buffer.from("game-level-2"), // Progressed to level 2 (frame 6)
  ],

  /**
   * Key effectiveness sequence for Keyboard Mash strategy
   * Which keys work and when
   */
  keyResponses: {
    Space: { works: true, action: "Start game" },
    Enter: { works: false, action: "N/A" },
    ArrowUp: { works: false, action: "N/A" },
    ArrowLeft: { works: true, action: "Move left" },
    ArrowRight: { works: true, action: "Move right" },
    w: { works: true, action: "Jump" },
    a: { works: true, action: "Move left" },
    s: { works: false, action: "N/A" },
    d: { works: true, action: "Move right" },
  },

  expectedBehavior: {
    progressScore: 75, // Good progress with keyboard
    uniqueGameStates: 4, // Start screen + 3 game screens
    inputsSuccessful: 4, // Space + arrow keys work
    inputsAttempted: 6,
    keyboardStrategyNeeded: true,
    firstKeyThatWorks: "Space",
    clickStrategyFailed: true, // Clicks should fail
  },

  /**
   * Diagnosis hints
   */
  diagnostics: {
    rootCause: "Game ignores mouse clicks, responds to keyboard",
    symptoms: [
      "progressScore = 0 initially (clicks don't work)",
      "After Space key pressed, progressScore jumps to 50%+",
      "DOM analysis shows no clickable elements",
    ],
    recommendedFix:
      "Input hint: 'Keyboard only - Space to start, arrows to play'",
  },
};

/**
 * Scenario 4: Multi-State Game with Visual Changes
 *
 * Represents a well-designed game that progresses through distinct states.
 * Tests normal happy-path progression.
 *
 * Expected behavior:
 * - Each action should change screen (good hit rate)
 * - Many unique states should be detected
 * - Progress score should be high
 * - No unstick needed
 */
export const wellDesignedGame = {
  url: "https://example.com/well-designed-game",
  gameTitle: "Well-Designed Game",
  description: "Game with clear progression and responsive controls",

  /**
   * DOM Analysis snapshot - good UX with obvious buttons
   */
  domAnalysis: {
    buttons: [
      {
        tag: "button",
        text: "Start Game",
        id: "start-btn",
        classes: ["btn", "btn-primary"],
        position: { x: 100, y: 100, width: 200, height: 50 },
        visible: true,
        clickable: true,
      },
      {
        tag: "button",
        text: "Settings",
        id: "settings-btn",
        classes: ["btn"],
        position: { x: 100, y: 160, width: 200, height: 50 },
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
        visible: true,
        isPrimaryGame: true,
        position: { x: 240, y: 60, width: 800, height: 600 },
      },
    ],
    headings: [
      {
        tag: "h1",
        text: "Game Title",
        visible: true,
        position: { x: 300, y: 20, width: 400, height: 40 },
      },
    ],
    clickableText: [
      {
        text: "Click for more",
        position: { x: 350, y: 300, width: 100, height: 20 },
        visible: true,
      },
    ],
    viewport: { width: 1280, height: 720 },
    interactiveCount: 3, // Start button + settings + clickable text
  } as DOMAnalysis,

  /**
   * Screenshots simulation - distinct game states
   */
  screenshotSequence: [
    Buffer.from("main-menu"),
    Buffer.from("level-select"),
    Buffer.from("level-1-intro"),
    Buffer.from("level-1-gameplay"),
    Buffer.from("level-1-progressing"),
    Buffer.from("level-1-complete"),
    Buffer.from("level-2-intro"),
    Buffer.from("level-2-gameplay"),
  ],

  expectedBehavior: {
    progressScore: 85, // High - 7/8 actions changed screen
    uniqueGameStates: 8, // All unique
    inputsSuccessful: 7,
    inputsAttempted: 8,
    consecutiveIdentical: 0, // No stuck periods
    unstickNeeded: false,
    avgTimePerAction: 2000, // 2 seconds per action
  },

  /**
   * Diagnosis hints
   */
  diagnostics: {
    rootCause: "Game is well-designed with clear progression",
    strengths: [
      "High progress score (75%+)",
      "Many unique states detected",
      "Obvious interactive elements",
      "Fast state transitions",
    ],
    recommendation: "Use as reference for well-designed game metrics",
  },
};

/**
 * Scenario 5: Game Stuck in Loop
 *
 * Represents a game that enters an infinite loop or repeating state.
 * Tests detection of repetitive patterns.
 *
 * Expected behavior:
 * - Same few states repeat continuously
 * - Progress score stays flat
 * - inputSuccessful = 0 (actions don't progress)
 * - Unique states = 2-3 (limited variety)
 */
export const gameStuckInLoop = {
  url: "https://example.com/looping-game",
  gameTitle: "Infinite Loop Game",
  description: "Game gets stuck in repeating animation loop",

  /**
   * DOM Analysis snapshot
   */
  domAnalysis: {
    buttons: [
      {
        tag: "button",
        text: "Play",
        id: "play",
        classes: [],
        position: { x: 100, y: 100, width: 200, height: 50 },
        visible: true,
        clickable: true,
      },
    ],
    links: [],
    inputs: [],
    canvases: [
      {
        id: "game",
        width: 800,
        height: 600,
        visible: true,
        isPrimaryGame: true,
        position: { x: 240, y: 60, width: 800, height: 600 },
      },
    ],
    headings: [],
    clickableText: [],
    viewport: { width: 1280, height: 720 },
    interactiveCount: 1,
  } as DOMAnalysis,

  /**
   * Screenshots simulation - repeating 2-state loop
   */
  screenshotSequence: [
    Buffer.from("menu-state"),
    Buffer.from("menu-state"), // Click play
    Buffer.from("loading-loop-frame-1"), // Game starts loading
    Buffer.from("loading-loop-frame-2"), // Loading animation frame 2
    Buffer.from("loading-loop-frame-1"), // Back to frame 1 (loop detected!)
    Buffer.from("loading-loop-frame-2"), // Frame 2 again
    Buffer.from("loading-loop-frame-1"), // Repeating...
    Buffer.from("loading-loop-frame-2"),
  ],

  expectedBehavior: {
    progressScore: 10, // Very low - stuck in loop
    uniqueGameStates: 3, // Menu + 2 animation frames
    inputsSuccessful: 1, // Play button worked once
    inputsAttempted: 8,
    consecutiveIdentical: 0, // Frames change but in loop
    repeatingStates: [
      "loading-loop-frame-1",
      "loading-loop-frame-2",
      "loading-loop-frame-1",
      "loading-loop-frame-2",
    ],
    diagnosis: "Game stuck in animation loop after play pressed",
  },

  /**
   * Diagnosis hints
   */
  diagnostics: {
    rootCause: "Game initialization incomplete, stuck in loop animation",
    symptoms: [
      "Only 2-3 unique states detected",
      "Progress score < 20%",
      "Same states repeat in pattern",
      "inputsSuccessful = 1 (play), then 0",
    ],
    possibleReasons: [
      "Game assets failed to load",
      "JavaScript initialization failed",
      "Game waiting for undefined event",
      "Memory leak causing slowdown",
    ],
    recommendedAction: "Increase timeout, check server logs, refresh page",
  },
};

/**
 * Collection of all scenarios
 * Useful for parameterized testing
 */
export const allScenarios = [
  {
    name: "stuckOnLoadingScreen",
    fixture: stuckOnLoadingScreen,
  },
  {
    name: "itchIoGame",
    fixture: itchIoGame,
  },
  {
    name: "keyboardOnlyGame",
    fixture: keyboardOnlyGame,
  },
  {
    name: "wellDesignedGame",
    fixture: wellDesignedGame,
  },
  {
    name: "gameStuckInLoop",
    fixture: gameStuckInLoop,
  },
] as const;

/**
 * Helper function to get scenario by name
 */
export function getScenario(name: string) {
  const scenario = allScenarios.find((s) => s.name === name);
  if (!scenario) {
    throw new Error(`Unknown scenario: ${name}`);
  }
  return scenario.fixture;
}

/**
 * Helper function to test progress detection with scenario
 *
 * @example
 * ```typescript
 * import { testProgressDetection, stuckOnLoadingScreen } from './game-progression-scenarios'
 *
 * test('progress detection detects stuck game', async () => {
 *   const detector = new ProgressDetector()
 *   const results = await testProgressDetection(detector, stuckOnLoadingScreen)
 *
 *   expect(results.isStuck).toBe(true)
 *   expect(results.progressScore).toBe(0)
 * })
 * ```
 */
export async function testProgressDetection(
  detector: any,
  scenario: (typeof allScenarios)[number]["fixture"],
) {
  // Record all screenshots in sequence
  for (const screenshot of scenario.screenshotSequence) {
    detector.recordScreenshot(screenshot, "test-action");
  }

  const metrics = detector.getMetrics();

  return {
    isStuck: detector.isStuck(),
    progressScore: metrics.progressScore,
    uniqueGameStates: metrics.uniqueGameStates,
    consecutiveIdentical: metrics.consecutiveIdentical,
    inputSuccessRate: metrics.inputsSuccessful / metrics.inputsAttempted,
  };
}
