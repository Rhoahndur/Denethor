/**
 * Game State Detector for identifying game states (Layer 1).
 *
 * Detects game states (loading, menu, playing, complete, crashed) using
 * DOM analysis and vision fallback. Essential for gameplay dynamics.
 *
 * @module gameStateDetector
 *
 * @example
 * ```typescript
 * import { GameStateDetector, GameState } from './gameStateDetector';
 *
 * const detector = new GameStateDetector(page);
 * const result = await detector.detectState(screenshot, domAnalysis);
 *
 * if (result.state === GameState.PLAYING) {
 *   // Start gameplay actions
 * }
 * ```
 */

import type { Page } from "@browserbasehq/stagehand";
import type { DOMAnalysis } from "@/types/qaReport";
import { logger } from "@/utils/logger";
import { VisionAnalyzer } from "./visionAnalyzer";

const log = logger.child({ component: "GameStateDetector" });

/**
 * Possible game states.
 */
export enum GameState {
  LOADING = "loading",
  MENU = "menu",
  PLAYING = "playing",
  COMPLETE = "complete",
  CRASHED = "crashed",
  UNKNOWN = "unknown",
}

/**
 * Result of game state detection.
 */
export interface GameStateResult {
  /** Detected game state */
  state: GameState;
  /** Confidence in detection (0-100) */
  confidence: number;
  /** Detection method used */
  method: "dom" | "vision";
  /** Evidence supporting the detection */
  evidence: string;
  /** Recommended action based on state */
  recommendedAction?: string;
}

/**
 * Record of a state transition.
 */
export interface StateTransition {
  /** Previous state */
  from: GameState;
  /** New state */
  to: GameState;
  /** Timestamp of transition */
  timestamp: number;
  /** Confidence in transition */
  confidence: number;
}

/**
 * Game State Detector for identifying game states.
 *
 * Uses DOM-based detection (fast, free) with vision fallback
 * for uncertain cases. Tracks state history and transitions.
 *
 * **Detection Methods:**
 * 1. DOM analysis (Layer 1) - 75%+ confidence
 * 2. Vision analysis (Layer 2) - fallback for uncertain cases
 *
 * @example
 * ```typescript
 * const detector = new GameStateDetector(page);
 *
 * const result = await detector.detectState(screenshot, domAnalysis);
 *
 * if (result.state === GameState.PLAYING) {
 *   console.log("Game is ready for input");
 * }
 * ```
 */
export class GameStateDetector {
  private currentState: GameState = GameState.UNKNOWN;
  private stateHistory: StateTransition[] = [];
  private stateStartTime: number = Date.now();

  constructor(private page: Page) {}

  /**
   * Detects current game state from screenshot and DOM analysis.
   *
   * Tries DOM-based detection first. If confidence is low (<75%),
   * uses vision analysis for more accurate detection.
   *
   * @param screenshot - Screenshot buffer
   * @param domAnalysis - DOM analysis data
   * @param previousState - Optional previous state for context
   * @returns Game state result with confidence and evidence
   *
   * @example
   * ```typescript
   * const result = await detector.detectState(screenshot, domAnalysis);
   * console.log(`State: ${result.state}, Confidence: ${result.confidence}%`);
   * ```
   */
  async detectState(
    screenshot: Buffer,
    domAnalysis: DOMAnalysis,
    previousState?: GameState,
  ): Promise<GameStateResult> {
    // Step 1: Try DOM-based detection (fast, free)
    const domResult = this.detectStateFromDOM(domAnalysis);
    if (domResult.confidence >= 75) {
      this.recordTransition(domResult.state, domResult.confidence);
      return domResult;
    }

    // Step 2: Vision fallback for uncertain cases
    log.info("DOM detection uncertain, using vision fallback");
    const visionAnalyzer = new VisionAnalyzer();
    const visionResult = await visionAnalyzer.analyzeScreenshot(screenshot, {
      previousAction: `Detecting game state (previous: ${previousState || "unknown"})`,
      gameState: previousState,
      attempt: this.stateHistory.length + 1,
    });

    const state = this.extractStateFromVisionReasoning(visionResult.reasoning);
    const confidence = visionResult.confidence;

    this.recordTransition(state, confidence);

    return {
      state,
      confidence,
      method: "vision",
      evidence: visionResult.reasoning,
      recommendedAction: visionResult.nextAction,
    };
  }

  /**
   * Detects state from DOM analysis using heuristics.
   *
   * @param domAnalysis - DOM analysis data
   * @returns State result with confidence
   * @private
   */
  private detectStateFromDOM(domAnalysis: DOMAnalysis): GameStateResult {
    const { buttons, canvases } = domAnalysis;
    const textContent = this.extractTextContent(domAnalysis);

    // COMPLETE detection (check first - highest priority)
    const completeKeywords = [
      "game over",
      "you win",
      "you lose",
      "score:",
      "replay",
      "try again",
    ];
    const hasCompleteText = completeKeywords.some((keyword) =>
      textContent.toLowerCase().includes(keyword),
    );
    if (hasCompleteText) {
      return {
        state: GameState.COMPLETE,
        confidence: 80,
        method: "dom",
        evidence: "Game completion text detected",
      };
    }

    // LOADING detection
    const loadingKeywords = ["loading", "please wait", "initializing"];
    const hasLoadingText = loadingKeywords.some((keyword) =>
      textContent.toLowerCase().includes(keyword),
    );
    if (hasLoadingText && canvases.length === 0) {
      return {
        state: GameState.LOADING,
        confidence: 85,
        method: "dom",
        evidence: "Loading text detected, no canvas present",
      };
    }

    // MENU detection
    const menuButtons = ["start", "play", "begin", "new game", "continue"];
    const hasMenuButton = buttons.some((btn) =>
      menuButtons.some((keyword) => btn.text.toLowerCase().includes(keyword)),
    );
    if (hasMenuButton && canvases.length > 0) {
      return {
        state: GameState.MENU,
        confidence: 80,
        method: "dom",
        evidence: `Menu buttons found: ${buttons.map((b) => b.text).join(", ")}`,
      };
    }

    // PLAYING detection
    if (canvases.length > 0 && !hasMenuButton && !hasLoadingText) {
      return {
        state: GameState.PLAYING,
        confidence: 75,
        method: "dom",
        evidence: `Canvas present (${canvases.length}), no menu/loading indicators`,
      };
    }

    return {
      state: GameState.UNKNOWN,
      confidence: 40,
      method: "dom",
      evidence: "Unable to determine state from DOM",
    };
  }

  /**
   * Extracts text content from DOM analysis.
   *
   * @param domAnalysis - DOM analysis data
   * @returns Combined text content
   * @private
   */
  private extractTextContent(domAnalysis: DOMAnalysis): string {
    const texts: string[] = [];

    // Collect text from buttons
    domAnalysis.buttons.forEach((btn) => texts.push(btn.text));

    // Collect text from headings
    domAnalysis.headings.forEach((h) => texts.push(h.text));

    // Collect text from clickable text
    domAnalysis.clickableText?.forEach((el) => texts.push(el.text));

    return texts.join(" ");
  }

  /**
   * Extracts game state from vision analysis reasoning.
   *
   * @param reasoning - Vision reasoning text
   * @returns Detected game state
   * @private
   */
  private extractStateFromVisionReasoning(reasoning: string): GameState {
    const lower = reasoning.toLowerCase();

    if (lower.includes("loading") || lower.includes("please wait")) {
      return GameState.LOADING;
    }
    if (
      lower.includes("menu") ||
      lower.includes("start screen") ||
      lower.includes("press start")
    ) {
      return GameState.MENU;
    }
    if (
      lower.includes("gameplay") ||
      lower.includes("playing") ||
      lower.includes("character")
    ) {
      return GameState.PLAYING;
    }
    if (
      lower.includes("game over") ||
      lower.includes("complete") ||
      lower.includes("win") ||
      lower.includes("lose")
    ) {
      return GameState.COMPLETE;
    }
    if (
      lower.includes("crash") ||
      lower.includes("error") ||
      lower.includes("frozen")
    ) {
      return GameState.CRASHED;
    }

    return GameState.UNKNOWN;
  }

  /**
   * Records a state transition.
   *
   * @param newState - New state
   * @param confidence - Confidence in transition
   * @private
   */
  private recordTransition(newState: GameState, confidence: number): void {
    if (newState !== this.currentState) {
      this.stateHistory.push({
        from: this.currentState,
        to: newState,
        timestamp: Date.now(),
        confidence,
      });

      log.info(
        { from: this.currentState, to: newState, confidence },
        "Game state transition detected",
      );

      this.currentState = newState;
      this.stateStartTime = Date.now();
    }
  }

  /**
   * Gets the current game state.
   *
   * @returns Current state
   */
  getCurrentState(): GameState {
    return this.currentState;
  }

  /**
   * Gets state transition history.
   *
   * @returns History with transitions and current state
   */
  getHistory(): { transitions: StateTransition[]; currentState: GameState } {
    return {
      transitions: this.stateHistory,
      currentState: this.currentState,
    };
  }

  /**
   * Checks if stuck in current state for too long.
   *
   * @param durationMs - Duration threshold in milliseconds
   * @returns True if stuck
   */
  isStuckInState(durationMs: number): boolean {
    return Date.now() - this.stateStartTime > durationMs;
  }

  /**
   * Gets time spent in current state.
   *
   * @returns Time in milliseconds
   */
  getTimeInCurrentState(): number {
    return Date.now() - this.stateStartTime;
  }
}
