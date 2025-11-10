/**
 * Gameplay Controller for autonomous game testing.
 *
 * Orchestrates continuous gameplay by coordinating state detection,
 * vision analysis, and keyboard input to test games end-to-end.
 *
 * @module gameplayController
 */

import type { Page } from "@browserbasehq/stagehand";
import { logger } from "@/utils/logger";
import type { DOMAnalysis } from "@/types/qaReport";
import type { EvidenceStore } from "@/evidence-store/evidenceStore";
import { VisionAnalyzer } from "./visionAnalyzer";

const log = logger.child({ component: "GameplayController" });

// TYPE STUBS for dependencies that Agent A will implement
// These ensure type-safety without requiring the actual implementations

/**
 * Game state enumeration (stub - Agent A will implement actual class)
 */
export enum GameState {
  LOADING = "loading",
  MENU = "menu",
  PLAYING = "playing",
  PAUSED = "paused",
  COMPLETE = "complete",
  CRASHED = "crashed",
  UNKNOWN = "unknown",
}

/**
 * State detection result (stub - Agent A will implement)
 */
export interface StateDetectionResult {
  state: GameState;
  confidence: number;
  method: string;
}

/**
 * State transition record (stub - Agent A will implement)
 */
export interface StateTransition {
  from: GameState;
  to: GameState;
  timestamp: number;
}

/**
 * State history (stub - Agent A will implement)
 */
export interface StateHistory {
  currentState: GameState;
  transitions: StateTransition[];
}

/**
 * Game State Detector stub class (Agent A will implement actual version)
 */
export class GameStateDetector {
  private currentState: GameState = GameState.UNKNOWN;
  private stateStartTime: number = Date.now();
  private transitions: StateTransition[] = [];

  constructor(_page: Page) {}

  async detectState(
    _screenshot: Buffer,
    _domAnalysis: DOMAnalysis,
    _previousState: GameState,
  ): Promise<StateDetectionResult> {
    return {
      state: this.currentState,
      confidence: 50,
      method: "stub",
    };
  }

  getCurrentState(): GameState {
    return this.currentState;
  }

  getTimeInCurrentState(): number {
    return Date.now() - this.stateStartTime;
  }

  isStuckInState(maxDuration: number): boolean {
    return this.getTimeInCurrentState() > maxDuration;
  }

  getHistory(): StateHistory {
    return {
      currentState: this.currentState,
      transitions: this.transitions,
    };
  }
}

/**
 * Keyboard action types (stub - Agent A will implement)
 */
export type KeyboardAction =
  | { type: "press"; key: string }
  | { type: "hold"; key: string; duration: number }
  | { type: "sequence"; sequence: Array<{ key: string; delay: number }> };

/**
 * Keyboard Controller stub class (Agent A will implement actual version)
 */
export class KeyboardController {
  constructor(private page: Page) {}

  async execute(
    _action: KeyboardAction,
  ): Promise<{ success: boolean; action: string }> {
    return {
      success: true,
      action: "stub executed",
    };
  }

  abort(): void {
    // Stub - Agent A will implement
  }
}

// END OF STUBS - ACTUAL IMPLEMENTATION BEGINS

/**
 * Gameplay configuration options.
 */
export interface GameplayConfig {
  /** Maximum number of actions to execute */
  maxActions: number;
  /** Maximum duration in milliseconds */
  maxDuration: number;
  /** Delay between actions in milliseconds */
  actionInterval: number;
  /** Optional hint about game input controls */
  inputHint?: string;
}

/**
 * Result of a gameplay session.
 */
export interface GameplayResult {
  /** Number of actions successfully executed */
  actionsExecuted: number;
  /** Time spent in each game state (milliseconds) */
  timeByState: Map<GameState, number>;
  /** Number of state transitions that occurred */
  stateTransitions: number;
  /** Whether gameplay was successful */
  success: boolean;
  /** Reason gameplay ended */
  endReason: string;
  /** Final game state when gameplay ended */
  finalState: GameState;
}

/**
 * Gameplay Controller for autonomous game testing.
 *
 * Orchestrates continuous gameplay by:
 * 1. Detecting game state (loading, menu, playing, etc.)
 * 2. Using vision AI to determine next action
 * 3. Executing keyboard/mouse actions
 * 4. Collecting evidence (screenshots, logs)
 * 5. Tracking progress and state transitions
 *
 * **Critical Fix:** Maps generic vision recommendations (e.g., "use arrows")
 * to specific keyboard keys (e.g., "ArrowRight") to prevent action failures.
 *
 * @example
 * ```typescript
 * const controller = new GameplayController(page, evidenceStore, {
 *   maxActions: 20,
 *   maxDuration: 60000,
 *   actionInterval: 500,
 *   inputHint: "Arrow keys for movement, spacebar to jump"
 * });
 *
 * const result = await controller.play();
 * console.log(`Executed ${result.actionsExecuted} actions`);
 * ```
 */
export class GameplayController {
  private stateDetector: GameStateDetector;
  private keyboardController: KeyboardController;
  private visionAnalyzer: VisionAnalyzer;

  private isPlaying: boolean = false;
  private actionsExecuted: number = 0;
  private startTime: number = 0;

  /**
   * Creates a new Gameplay Controller.
   *
   * @param page - Stagehand page instance for browser interaction
   * @param evidenceStore - Evidence store for capturing screenshots
   * @param config - Gameplay configuration
   */
  constructor(
    private page: Page,
    private evidenceStore: EvidenceStore,
    private config: GameplayConfig,
  ) {
    this.stateDetector = new GameStateDetector(page);
    this.keyboardController = new KeyboardController(page);
    this.visionAnalyzer = new VisionAnalyzer();
  }

  /**
   * Starts continuous gameplay loop.
   *
   * Executes actions until one of the exit conditions is met:
   * - Max actions reached
   * - Max duration reached
   * - Game completed
   * - Game crashed
   * - Stuck in same state for >30s
   *
   * @returns Gameplay result with metrics and final state
   */
  async play(): Promise<GameplayResult> {
    this.isPlaying = true;
    this.startTime = Date.now();
    this.actionsExecuted = 0;

    log.info(
      {
        maxActions: this.config.maxActions,
        maxDuration: this.config.maxDuration,
      },
      "Starting continuous gameplay loop",
    );

    while (this.isPlaying) {
      // Check exit conditions
      if (this.actionsExecuted >= this.config.maxActions) {
        log.info("Max actions reached");
        break;
      }

      const elapsed = Date.now() - this.startTime;
      if (elapsed > this.config.maxDuration) {
        log.info({ elapsed }, "Max duration reached");
        break;
      }

      // Execute one gameplay cycle
      const continuePlay = await this.executeGameplayCycle();
      if (!continuePlay) {
        break;
      }

      // Check if game completed or crashed
      const currentState = this.stateDetector.getCurrentState();
      if (currentState === GameState.COMPLETE) {
        log.info("Game completed");
        break;
      }
      if (currentState === GameState.CRASHED) {
        log.error("Game crashed");
        break;
      }

      // Check if stuck in same state
      if (this.stateDetector.isStuckInState(30000)) {
        log.warn(
          {
            state: currentState,
            duration: this.stateDetector.getTimeInCurrentState(),
          },
          "Stuck in same state for 30+ seconds",
        );
        break;
      }

      // Wait before next action
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.actionInterval),
      );
    }

    return this.buildResult();
  }

  /**
   * Executes one gameplay cycle: detect state, select action, execute.
   *
   * @returns True to continue gameplay, false to stop
   * @private
   */
  private async executeGameplayCycle(): Promise<boolean> {
    try {
      // Capture current state
      const screenshot = await this.page.screenshot();
      await this.evidenceStore.captureScreenshot(
        screenshot,
        `gameplay-action-${this.actionsExecuted}`,
      );

      // Get DOM analysis for context
      const domAnalysis = await this.getDOMAnalysis();

      // Detect game state
      const stateResult = await this.stateDetector.detectState(
        screenshot,
        domAnalysis,
        this.stateDetector.getCurrentState(),
      );

      log.info(
        {
          state: stateResult.state,
          confidence: stateResult.confidence,
          method: stateResult.method,
        },
        "Game state detected",
      );

      // Select action based on state
      const action = await this.selectAction(
        stateResult.state,
        screenshot,
        domAnalysis,
      );

      if (!action) {
        log.warn("No action selected, ending gameplay");
        return false;
      }

      // Execute action
      const result =
        action.type === "keyboard"
          ? await this.keyboardController.execute(action.keyboardAction)
          : await this.executeClickAction(action.clickAction);

      this.actionsExecuted++;

      log.info(
        {
          action: result.action,
          success: result.success,
          actionsExecuted: this.actionsExecuted,
        },
        "Gameplay action executed",
      );

      return result.success;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ error: err.message }, "Gameplay cycle failed");
      return false;
    }
  }

  /**
   * Selects next action based on current game state.
   *
   * @param state - Current game state
   * @param screenshot - Current screenshot
   * @param domAnalysis - Current DOM analysis
   * @returns Selected action or null to end gameplay
   * @private
   */
  private async selectAction(
    state: GameState,
    screenshot: Buffer,
    domAnalysis: DOMAnalysis,
  ): Promise<
    | { type: "keyboard"; keyboardAction: KeyboardAction }
    | { type: "click"; clickAction: { x: number; y: number } }
    | null
  > {
    switch (state) {
      case GameState.LOADING:
        log.info("Game loading, waiting...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return null;

      case GameState.MENU:
        return this.selectMenuAction(domAnalysis);

      case GameState.PLAYING:
        return this.selectPlayingAction(screenshot, domAnalysis);

      case GameState.COMPLETE:
        log.info("Game complete, ending gameplay");
        return null;

      default:
        log.warn({ state }, "Unknown state, using vision");
        return this.selectPlayingAction(screenshot, domAnalysis);
    }
  }

  /**
   * Selects action for menu state (look for start/play button).
   *
   * @param domAnalysis - Current DOM analysis
   * @returns Menu action or null
   * @private
   */
  private async selectMenuAction(
    domAnalysis: DOMAnalysis,
  ): Promise<
    | { type: "keyboard"; keyboardAction: KeyboardAction }
    | { type: "click"; clickAction: { x: number; y: number } }
    | null
  > {
    // Look for start/play button
    const startButton = domAnalysis.buttons.find((btn) =>
      /start|play|begin|new game/i.test(btn.text),
    );

    if (startButton && startButton.visible) {
      log.info({ button: startButton.text }, "Found start button in menu");
      return {
        type: "click",
        clickAction: {
          x: startButton.position.x + startButton.position.width / 2,
          y: startButton.position.y + startButton.position.height / 2,
        },
      };
    }

    // Try Enter key
    log.info("No start button found, trying Enter key");
    return {
      type: "keyboard",
      keyboardAction: { type: "press", key: "Enter" },
    };
  }

  /**
   * Selects action for playing state (use vision AI).
   *
   * @param screenshot - Current screenshot
   * @param domAnalysis - Current DOM analysis
   * @returns Playing action or null
   * @private
   */
  private async selectPlayingAction(
    screenshot: Buffer,
    domAnalysis: DOMAnalysis,
  ): Promise<
    | { type: "keyboard"; keyboardAction: KeyboardAction }
    | { type: "click"; clickAction: { x: number; y: number } }
    | null
  > {
    // Use vision to determine next action
    const visionResult = await this.visionAnalyzer.analyzeScreenshot(
      screenshot,
      {
        previousAction:
          this.actionsExecuted > 0 ? "playing game" : undefined,
        gameState: "playing",
        attempt: this.actionsExecuted + 1,
        inputHint: this.config.inputHint,
        domAnalysis,
      },
    );

    log.info(
      {
        actionType: visionResult.actionType,
        confidence: visionResult.confidence,
        target: visionResult.targetDescription,
      },
      "Vision analysis complete",
    );

    // Map vision recommendation to specific keyboard action
    if (visionResult.actionType === "keyboard") {
      const keyboardAction = this.mapVisionToKeyboard(
        visionResult,
        GameState.PLAYING,
      );

      if (keyboardAction) {
        log.info({ keyboardAction }, "Mapped vision to keyboard action");
        return { type: "keyboard", keyboardAction };
      }

      log.warn(
        { visionResult: visionResult.nextAction },
        "Could not map vision to specific keyboard action",
      );
    }

    return null;
  }

  /**
   * Maps vision analysis result to specific keyboard action.
   *
   * **Critical Fix:** This method solves the "Keyboard action requires a value" error
   * by mapping generic descriptions like "Use arrow keys" to specific keys like "ArrowRight".
   *
   * Handles:
   * - Arrow keys (ArrowUp, ArrowDown, ArrowLeft, ArrowRight)
   * - WASD movement (w, a, s, d)
   * - Jump (Space)
   * - Action keys (Enter, Escape)
   * - Sequences (e.g., "move right and jump")
   * - Generic hints (uses inputHint to choose default)
   *
   * @param visionResult - Vision analysis result
   * @param gameState - Current game state
   * @returns Specific keyboard action or null if unmappable
   */
  mapVisionToKeyboard(
    visionResult: {
      nextAction?: string;
      targetDescription?: string;
      reasoning?: string;
    },
    gameState: GameState,
  ): KeyboardAction | null {
    const action = visionResult.nextAction?.toLowerCase() || "";
    const target = visionResult.targetDescription?.toLowerCase() || "";
    const reasoning = visionResult.reasoning?.toLowerCase() || "";
    const combined = `${action} ${target} ${reasoning}`;

    log.debug({ combined }, "Mapping vision to keyboard");

    // Menu navigation (highest priority for menu state)
    if (gameState === GameState.MENU) {
      // Menu navigation keywords
      if (/navigate.*down|menu.*down|select.*down|arrow.*down|press.*down/i.test(combined)) {
        return { type: "press", key: "ArrowDown" };
      }
      if (/navigate.*up|menu.*up|select.*up|arrow.*up|press.*up/i.test(combined)) {
        return { type: "press", key: "ArrowUp" };
      }
      if (/activate|select option|choose|start|press enter/i.test(combined)) {
        return { type: "press", key: "Enter" };
      }
    }

    // Sequences (high priority to avoid being caught by simple movement patterns)
    if (/right.*jump|jump.*right/i.test(combined)) {
      return {
        type: "sequence",
        sequence: [
          { key: "ArrowRight", delay: 500 },
          { key: "Space", delay: 100 },
        ],
      };
    }
    if (/left.*jump|jump.*left/i.test(combined)) {
      return {
        type: "sequence",
        sequence: [
          { key: "ArrowLeft", delay: 500 },
          { key: "Space", delay: 100 },
        ],
      };
    }

    // Jump (check before movement to avoid "jump" being caught by other patterns)
    if (/\bjump\b|spacebar|press space|hit space/i.test(combined)) {
      return { type: "press", key: "Space" };
    }

    // WASD movement (check before arrow keys to prioritize WASD when mentioned)
    if (/press w\b|move forward/i.test(combined)) {
      return { type: "hold", key: "w", duration: 2000 };
    }
    if (/press a\b|strafe left/i.test(combined)) {
      return { type: "hold", key: "a", duration: 2000 };
    }
    if (/press s\b|move backward/i.test(combined)) {
      return { type: "hold", key: "s", duration: 2000 };
    }
    if (/press d\b|strafe right/i.test(combined)) {
      return { type: "hold", key: "d", duration: 2000 };
    }

    // Arrow keys
    if (/move right|go right|right arrow|press right/i.test(combined)) {
      return { type: "hold", key: "ArrowRight", duration: 2000 };
    }
    if (/move left|go left|left arrow|press left/i.test(combined)) {
      return { type: "hold", key: "ArrowLeft", duration: 2000 };
    }
    if (/move up|go up|up arrow|press up/i.test(combined)) {
      return { type: "hold", key: "ArrowUp", duration: 2000 };
    }
    if (/move down|go down|down arrow|press down/i.test(combined)) {
      return { type: "hold", key: "ArrowDown", duration: 2000 };
    }

    // Action keys
    if (/\benter\b|confirm/i.test(combined) && !/center/i.test(combined)) {
      return { type: "press", key: "Enter" };
    }
    if (/escape|esc|pause|menu/i.test(combined)) {
      return { type: "press", key: "Escape" };
    }

    // Generic keyboard mention with hint
    if (this.config.inputHint) {
      const hint = this.config.inputHint.toLowerCase();

      if (/arrow/i.test(combined) && /arrow/i.test(hint)) {
        // Default to right arrow if arrows mentioned
        return { type: "hold", key: "ArrowRight", duration: 2000 };
      }
      if (/wasd/i.test(combined) && /wasd/i.test(hint)) {
        // Default to 'd' (right) if WASD mentioned
        return { type: "hold", key: "d", duration: 2000 };
      }
    }

    log.warn({ combined }, "No keyboard mapping found");
    return null;
  }

  /**
   * Executes a click action at specified coordinates.
   *
   * @param action - Click action with x, y coordinates
   * @returns Action result
   * @private
   */
  private async executeClickAction(action: {
    x: number;
    y: number;
  }): Promise<{ success: boolean; action: string }> {
    try {
      await this.page.mouse.click(action.x, action.y);
      return {
        success: true,
        action: `Clicked at (${action.x}, ${action.y})`,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        action: `Click failed: ${err.message}`,
      };
    }
  }

  /**
   * Extracts simplified DOM analysis from page.
   *
   * @returns DOM analysis with buttons, canvases, and text content
   * @private
   */
  private async getDOMAnalysis(): Promise<DOMAnalysis> {
    // Simplified DOM extraction - can enhance later
    return (await this.page.evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll("button, [role='button']"))
          .map(el => {
            const rect = el.getBoundingClientRect();
            return {
              tag: el.tagName.toLowerCase(),
              text: (el.textContent || "").trim().substring(0, 100),
              id: el.id || undefined,
              classes: Array.from(el.classList),
              position: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
              visible: rect.width > 0 && rect.height > 0,
              clickable: true
            };
          });

        const canvases = Array.from(document.querySelectorAll("canvas"))
          .map(el => {
            const rect = el.getBoundingClientRect();
            return {
              id: el.id || undefined,
              width: el.width,
              height: el.height,
              tag: 'canvas',
              text: '',
              position: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
              visible: rect.width > 0 && rect.height > 0,
              clickable: false,
              isPrimaryGame: rect.width > 400 && rect.height > 300
            };
          });

        return {
          buttons,
          canvases,
          links: [],
          inputs: [],
          headings: [],
          clickableText: [],
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          },
          interactiveCount: buttons.length
        };
      })()
    `)) as DOMAnalysis;
  }

  /**
   * Builds final gameplay result with metrics.
   *
   * @returns Complete gameplay result
   * @private
   */
  private buildResult(): GameplayResult {
    const history = this.stateDetector.getHistory();
    const timeByState = new Map<GameState, number>();

    // Calculate time spent in each state
    for (let i = 0; i < history.transitions.length; i++) {
      const transition = history.transitions[i];
      if (!transition) continue;

      const nextTransition = history.transitions[i + 1];
      const duration = nextTransition
        ? nextTransition.timestamp - transition.timestamp
        : Date.now() - transition.timestamp;

      const currentTime = timeByState.get(transition.to) || 0;
      timeByState.set(transition.to, currentTime + duration);
    }

    return {
      actionsExecuted: this.actionsExecuted,
      timeByState,
      stateTransitions: history.transitions.length,
      success: this.actionsExecuted >= Math.min(5, this.config.maxActions),
      endReason: this.determineEndReason(),
      finalState: history.currentState,
    };
  }

  /**
   * Determines why gameplay ended.
   *
   * @returns Human-readable end reason
   * @private
   */
  private determineEndReason(): string {
    if (this.actionsExecuted >= this.config.maxActions) {
      return "Max actions reached";
    }
    if (Date.now() - this.startTime > this.config.maxDuration) {
      return "Max duration reached";
    }

    const currentState = this.stateDetector.getCurrentState();
    if (currentState === GameState.COMPLETE) {
      return "Game completed successfully";
    }
    if (currentState === GameState.CRASHED) {
      return "Game crashed";
    }
    if (this.stateDetector.isStuckInState(30000)) {
      return "Stuck in same state";
    }

    return "Unknown reason";
  }

  /**
   * Stops the gameplay loop immediately.
   *
   * Aborts any ongoing keyboard actions and halts the gameplay loop.
   */
  stop(): void {
    this.isPlaying = false;
    this.keyboardController.abort();
  }
}
