import type { QAReport } from "@/types/qaReport";

/**
 * Sample evidence data for testing
 */
export const sampleEvidence = {
  screenshots: [
    "/test-123-456/screenshots/00-initial-load.png",
    "/test-123-456/screenshots/01-start-button-detected.png",
    "/test-123-456/screenshots/02-gameplay-action-1.png",
    "/test-123-456/screenshots/03-final-state.png",
  ],
  logs: {
    console: "/test-123-456/logs/console.log",
    actions: "/test-123-456/logs/actions.log",
    errors: "/test-123-456/logs/errors.log",
  },
};

/**
 * Sample console logs
 */
export const sampleConsoleLogs = `2025-11-04T12:00:00.000Z [INFO] Game loaded successfully
2025-11-04T12:00:01.000Z [INFO] Start button detected
2025-11-04T12:00:02.000Z [INFO] Game started
2025-11-04T12:00:03.000Z [INFO] Player action completed`;

/**
 * Sample action logs
 */
export const sampleActionLogs = `2025-11-04T12:00:00.000Z [ACTION] Navigate to game URL
2025-11-04T12:00:01.000Z [ACTION] Click start button at (640, 360)
2025-11-04T12:00:02.000Z [ACTION] Press arrow key: ArrowRight
2025-11-04T12:00:03.000Z [ACTION] Press key: Space`;

/**
 * Sample error logs (empty for success case)
 */
export const sampleErrorLogs = "";

/**
 * Sample QA Report with high scores
 */
export const sampleQAReport: QAReport = {
  meta: {
    testId: "test-123-456",
    gameUrl: "https://example.com/game.html",
    timestamp: "2025-11-04T12:00:00.000Z",
    duration: 120,
    agentVersion: "1.0.0",
    browserSettings: {
      browser: "chrome",
      viewport: { width: 1280, height: 720 },
      arguments: ["--enable-webgl", "--use-gl=angle"],
      device: "desktop",
      locale: "en-US",
    },
  },
  status: "success",
  scores: {
    loadSuccess: 95,
    responsiveness: 90,
    stability: 92,
    overallPlayability: 92,
  },
  evaluation: {
    reasoning:
      "Game loaded successfully with all assets. Controls were responsive and gameplay was smooth. No critical errors detected.",
    confidence: 90,
  },
  issues: [
    {
      severity: "minor",
      category: "performance",
      description: "Slight delay in initial load time",
      screenshot: "/test-123-456/screenshots/00-initial-load.png",
    },
  ],
  evidence: sampleEvidence,
  actions: [
    {
      type: "navigate",
      timestamp: "2025-11-04T12:00:00.000Z",
      success: true,
      details: "Navigated to game URL",
    },
    {
      type: "click",
      timestamp: "2025-11-04T12:00:01.000Z",
      success: true,
      details: "Clicked start button",
    },
    {
      type: "keyboard",
      timestamp: "2025-11-04T12:00:02.000Z",
      success: true,
      details: "Pressed ArrowRight",
    },
    {
      type: "keyboard",
      timestamp: "2025-11-04T12:00:03.000Z",
      success: true,
      details: "Pressed Space",
    },
  ],
};

/**
 * Sample QA Report with failures
 */
export const sampleFailedQAReport: QAReport = {
  meta: {
    testId: "test-789-012",
    gameUrl: "https://example.com/broken-game.html",
    timestamp: "2025-11-04T12:00:00.000Z",
    duration: 60,
    agentVersion: "1.0.0",
    browserSettings: {
      browser: "chrome",
      viewport: { width: 1280, height: 720 },
      arguments: ["--enable-webgl", "--use-gl=angle"],
      device: "desktop",
      locale: "en-US",
    },
  },
  status: "failure",
  scores: {
    loadSuccess: 30,
    responsiveness: 20,
    stability: 25,
    overallPlayability: 25,
  },
  evaluation: {
    reasoning:
      "Game failed to load properly. Multiple JavaScript errors detected. Controls did not respond to input.",
    confidence: 95,
  },
  issues: [
    {
      severity: "critical",
      category: "stability",
      description: "JavaScript error: Cannot read property 'x' of undefined",
      screenshot: "/test-789-012/screenshots/00-initial-load.png",
    },
    {
      severity: "critical",
      category: "usability",
      description: "Controls not responding to keyboard input",
      screenshot: "/test-789-012/screenshots/02-gameplay-action-1.png",
    },
    {
      severity: "major",
      category: "performance",
      description: "Game froze after 10 seconds",
    },
  ],
  evidence: {
    screenshots: [
      "/test-789-012/screenshots/00-initial-load.png",
      "/test-789-012/screenshots/01-error-state.png",
      "/test-789-012/screenshots/02-gameplay-action-1.png",
    ],
    logs: {
      console: "/test-789-012/logs/console.log",
      actions: "/test-789-012/logs/actions.log",
      errors: "/test-789-012/logs/errors.log",
    },
  },
  actions: [
    {
      type: "navigate",
      timestamp: "2025-11-04T12:00:00.000Z",
      success: true,
      details: "Navigated to game URL",
    },
    {
      type: "click",
      timestamp: "2025-11-04T12:00:01.000Z",
      success: false,
      details: "Failed to click start button - element not found",
    },
    {
      type: "keyboard",
      timestamp: "2025-11-04T12:00:02.000Z",
      success: false,
      details: "Keyboard input did not trigger any response",
    },
  ],
};

/**
 * Sample error console logs
 */
export const sampleErrorConsoleLogs = `2025-11-04T12:00:00.000Z [ERROR] Uncaught TypeError: Cannot read property 'x' of undefined
    at game.js:42:15
2025-11-04T12:00:01.000Z [ERROR] Failed to load resource: net::ERR_FILE_NOT_FOUND
2025-11-04T12:00:05.000Z [ERROR] Game loop stopped responding`;
