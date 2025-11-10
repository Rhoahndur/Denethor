/**
 * Hybrid Action Strategy Orchestrator.
 *
 * Coordinates the 3-layer action strategy with confidence-based escalation:
 * - Layer 1: Fast heuristics (free, 80% confidence threshold)
 * - Layer 2: Vision analysis (low cost, 70% confidence threshold)
 * - Layer 3: RAG (future stretch goal, not implemented in MVP)
 *
 * This novel pattern optimizes for cost efficiency while maintaining
 * intelligent action selection across diverse game types.
 *
 * @module actionStrategy
 *
 * @example
 * ```typescript
 * import { executeHybridStrategy } from './actionStrategy';
 *
 * const result = await executeHybridStrategy(page, {
 *   gameType: 'platformer',
 *   attempt: 1,
 * });
 *
 * console.log(`Layer ${result.layer} recommended: ${result.action}`);
 * console.log(`Confidence: ${result.confidence}%`);
 * ```
 */

import type { Page } from "@browserbasehq/stagehand";
import { GameCrashError } from "@/errors/gameCrashError";
import type { DOMAnalysis } from "@/types/qaReport";
import { logger } from "@/utils/logger";
import { executeHeuristic, HEURISTICS } from "./heuristics/coreHeuristics";
import type { Heuristic } from "./heuristics/types";
import type { ObjectRegistry } from "./objectRegistry";
import type { TemplateMatcher } from "./templateMatcher";
import type { BrowserAgent } from "./browserAgent";
import { VisionAnalyzer } from "./visionAnalyzer";
import { hasSignificantChange } from "./screenSimilarity";

const log = logger.child({ component: "ActionStrategy" });

/**
 * Context for strategy execution.
 */
export interface StrategyContext {
  /** Detected game type for heuristic selection */
  gameType?: string;

  /** Previous action taken (for Layer 2 context) */
  previousAction?: string;

  /** Current game state (for Layer 2 context) */
  gameState?: string;

  /** Attempt number */
  attempt: number;

  /**
   * Optional hint about game input controls to guide action selection.
   * Influences Layer 2 (Vision) analysis for more accurate control detection.
   *
   * @example "Arrow keys for movement, spacebar to jump"
   */
  inputHint?: string;

  /**
   * Optional DOM analysis data providing context about page elements.
   * Used by Layer 2 (Vision) analysis for better element identification.
   */
  domAnalysis?: DOMAnalysis;

  /**
   * Optional object registry for deterministic coordinate lookups.
   * Provides registered object names to vision for precise recommendations.
   */
  objectRegistry?: ObjectRegistry;

  /**
   * Optional template matcher for precise canvas element location.
   * Provides faster, cheaper alternative to vision API for known UI elements.
   */
  templateMatcher?: TemplateMatcher;

  /**
   * Enable fast mode for repetitive actions (post-warmup optimization).
   * When enabled, uses game-specific shortcuts before expensive vision calls.
   */
  fastMode?: boolean;

  /**
   * Previous screenshot for similarity detection (to skip vision when screen unchanged).
   */
  previousScreenshot?: Buffer;

  /**
   * Canvas element info for fast clicking (visual novels, etc).
   */
  canvasInfo?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /**
   * Browser agent for capturing game-focused screenshots.
   * Required for iframe-aware screenshot capture.
   */
  browserAgent?: BrowserAgent;
}

/**
 * Result from hybrid strategy execution.
 */
export interface StrategyResult {
  /** Which layer provided the result (1, 2, or 3) */
  layer: 1 | 2 | 3;

  /** Action description */
  action: string;

  /** Type of action */
  actionType:
    | "click"
    | "keyboard"
    | "wait"
    | "scroll"
    | "screenshot"
    | "unknown";

  /** Target for action (selector, coordinates, key) */
  target?: string;

  /** Click coordinates (for canvas-rendered elements) */
  clickCoordinates?: {
    x: number;
    y: number;
  };

  /** Final confidence score (0-100) */
  confidence: number;

  /** Reasoning for this action */
  reasoning: string;
}

/**
 * Try game-specific fast mode strategies before expensive layers.
 * Returns null if fast mode not applicable, otherwise returns immediate action.
 *
 * @param gameType - Detected game type
 * @param currentScreenshot - Current screenshot buffer
 * @param previousScreenshot - Previous screenshot for similarity check
 * @param canvasInfo - Canvas/iframe position info
 * @returns Fast mode result or null
 */
async function tryFastModeStrategy(
  gameType: string,
  currentScreenshot: Buffer,
  previousScreenshot: Buffer | undefined,
  canvasInfo: { x: number; y: number; width: number; height: number } | undefined,
): Promise<StrategyResult | null> {
  // Visual Novel Fast Mode
  // Visual novels are click-to-advance, so just click canvas center unless screen significantly changed
  if (gameType === "visual-novel") {
    log.debug("Trying visual-novel fast mode");

    // If we have previous screenshot, check if screen changed significantly
    if (previousScreenshot) {
      const screenChanged = await hasSignificantChange(
        previousScreenshot,
        currentScreenshot,
        85, // 85% similarity threshold - allows for text changes but not layout changes
      );

      if (!screenChanged) {
        log.info(
          "Visual novel: Screen hasn't changed significantly, likely stuck - aborting fast mode",
        );
        return null; // Let normal layers handle stuck state
      }
    }

    // Click center of canvas/iframe to advance dialogue
    if (canvasInfo) {
      const centerX = Math.round(canvasInfo.x + canvasInfo.width / 2);
      const centerY = Math.round(canvasInfo.y + canvasInfo.height / 2);

      log.info(
        { x: centerX, y: centerY },
        "Visual novel fast mode: Clicking canvas center to advance dialogue",
      );

      return {
        layer: 1, // Report as layer 1 (fast path)
        action: "Click to advance visual novel dialogue",
        actionType: "click",
        target: "canvas-center",
        clickCoordinates: { x: centerX, y: centerY },
        confidence: 85,
        reasoning: "Visual novel fast mode: Click-to-advance game pattern detected. Clicking canvas center to progress dialogue without expensive vision analysis.",
      };
    }

    log.debug("Visual novel fast mode: No canvas info available");
    return null;
  }

  // Point-and-Click Adventure Fast Mode
  // Similar to visual novels, but may need more caution with clickable objects
  if (gameType === "point-and-click") {
    log.debug("Point-and-click fast mode not yet implemented");
    // TODO: Could implement smart random clicking or hotspot detection
    return null;
  }

  // Idle/Clicker Fast Mode
  // Repetitive clicking on same spots
  if (gameType === "idle" || gameType === "clicker") {
    log.debug("Idle/clicker fast mode not yet implemented");
    // TODO: Could implement repeated clicks on known upgrade buttons
    return null;
  }

  // No fast mode strategy for this game type
  return null;
}

/**
 * Selects appropriate heuristic based on game type.
 *
 * Maps game types to existing heuristic patterns. Some game types share
 * similar control schemes and thus use the same heuristic.
 *
 * @param gameType - Detected game type (optional)
 * @returns Heuristic pattern to use
 * @private
 */
function selectHeuristic(gameType?: string): Heuristic {
  const normalizedType = gameType?.toLowerCase();

  switch (normalizedType) {
    // Movement-focused games (arrow keys, WASD, jumping)
    case "platformer":
    case "shooter":
    case "arcade":
      log.debug(`Selected PLATFORMER heuristic for ${normalizedType}`);
      return HEURISTICS.PLATFORMER;

    // Click-intensive games
    case "clicker":
    case "idle":
    case "incremental":
    case "strategy":
    case "card":
    case "simulation":
      log.debug(`Selected CLICKER heuristic for ${normalizedType}`);
      return HEURISTICS.CLICKER;

    // Puzzle/matching games
    case "puzzle":
    case "match":
      log.debug("Selected PUZZLE heuristic");
      return HEURISTICS.PUZZLE;

    // Narrative/story games, RPGs, sports, racing (generic exploration)
    case "visual-novel":
    case "rpg":
    case "sports":
    case "racing":
    case "generic":
    default:
      log.debug(`Selected GENERIC heuristic for ${normalizedType || "unknown"}`);
      return HEURISTICS.GENERIC;
  }
}

/**
 * Executes hybrid action strategy with confidence-based escalation.
 *
 * Tries each layer in sequence, escalating when confidence is too low:
 * 1. **Layer 1 (Heuristics)**: Fast, free. Returns if confidence > 80%.
 * 2. **Layer 2 (Vision)**: Intelligent, low cost. Returns if confidence > 70%.
 * 3. **Layer 3 (RAG)**: Future stretch goal. Currently throws GameCrashError.
 *
 * @param page - Playwright page object
 * @param context - Strategy context (game type, previous action, etc.)
 * @returns Strategy result with action recommendation
 *
 * @throws {GameCrashError} When all layers fail or have low confidence
 *
 * @example
 * ```typescript
 * const result = await executeHybridStrategy(page, {
 *   gameType: 'platformer',
 *   attempt: 1,
 * });
 *
 * if (result.layer === 1) {
 *   console.log('Fast heuristic succeeded!');
 * } else if (result.layer === 2) {
 *   console.log('Vision analysis provided guidance');
 * }
 * ```
 */
export async function executeHybridStrategy(
  page: Page,
  context: StrategyContext,
): Promise<StrategyResult> {
  log.info(
    { attempt: context.attempt, gameType: context.gameType, fastMode: context.fastMode },
    "Starting hybrid action strategy",
  );

  // Layer 0: Game-Specific Fast Paths (when fast mode enabled)
  // Skip expensive vision calls for repetitive, predictable actions
  if (context.fastMode && context.gameType) {
    // Use game-focused screenshot (iframe if available)
    let screenshotData;
    try {
      screenshotData = context.browserAgent
        ? await context.browserAgent.captureGameScreenshot()
        : { screenshot: await page.screenshot(), isIframe: false };
    } catch (error) {
      log.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to capture game screenshot, falling back to page screenshot");
      screenshotData = { screenshot: await page.screenshot(), isIframe: false };
    }
    const currentScreenshot = screenshotData.screenshot;

    const fastResult = await tryFastModeStrategy(
      context.gameType,
      currentScreenshot,
      context.previousScreenshot,
      context.canvasInfo,
    );

    if (fastResult) {
      log.info(
        { layer: 0, gameType: context.gameType, confidence: fastResult.confidence },
        "Layer 0 fast mode succeeded - skipping expensive layers",
      );
      return fastResult;
    }

    log.debug(
      { gameType: context.gameType },
      "Fast mode strategy not applicable, proceeding to standard layers",
    );
  }

  // Layer 1: Heuristics (fast, free)
  log.info({ layer: 1 }, "Executing Layer 1: Heuristics");

  try {
    const heuristic = selectHeuristic(context.gameType);
    const heuristicResult = await executeHeuristic(page, heuristic);

    log.info(
      {
        heuristic: heuristic.name,
        confidence: heuristicResult.confidence,
        threshold: 80,
      },
      "Layer 1 heuristic result",
    );

    if (heuristicResult.confidence > 80) {
      log.info(
        { layer: 1, confidence: heuristicResult.confidence },
        "Layer 1 succeeded with high confidence",
      );

      // Extract action from heuristic result
      const firstAction = heuristicResult.actions[0];

      return {
        layer: 1,
        action: firstAction
          ? `${firstAction.type}${firstAction.target ? ` ${firstAction.target}` : ""}`
          : "heuristic sequence",
        actionType: firstAction?.type || "unknown",
        target: firstAction?.target,
        confidence: heuristicResult.confidence,
        reasoning: heuristicResult.reasoning,
      };
    }

    log.info(
      { confidence: heuristicResult.confidence, threshold: 80 },
      "Layer 1 confidence below threshold, escalating to Layer 2",
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.warn(
      { error: err.message },
      "Layer 1 execution failed, escalating to Layer 2",
    );
  }

  // Layer 2: Vision Analysis (intelligent, low cost)
  // Now includes template matching as a fast-path before expensive vision API
  log.info({ layer: 2 }, "Executing Layer 2: Template Matching + Vision Analysis");

  try {
    // Capture screenshot for analysis - use game-focused screenshot (iframe if available)
    const screenshotData = context.browserAgent
      ? await context.browserAgent.captureGameScreenshot()
      : { screenshot: await page.screenshot(), isIframe: false };
    const screenshot = screenshotData.screenshot;

    // Log if we're using iframe screenshot
    if (screenshotData.isIframe) {
      log.info(
        { bounds: screenshotData.bounds },
        "Using iframe-focused screenshot for Vision analysis (clean game content only)",
      );
    }

    // Layer 2a: Try template matching first (if available)
    if (context.templateMatcher) {
      log.debug("Attempting template matching for known UI elements");

      // Get all available templates
      const templates = context.templateMatcher.getTemplates();

      if (templates.length > 0) {
        log.info(
          { templateCount: templates.length },
          "Searching for known templates in screenshot",
        );

        // Try to find any known template in the screenshot
        for (const template of templates) {
          const match = await context.templateMatcher.findTemplate(
            screenshot,
            template.name,
            0.85, // High confidence threshold for template matching
          );

          if (match) {
            log.info(
              {
                layer: 2,
                sublayer: "template",
                templateName: template.name,
                x: match.centerX,
                y: match.centerY,
                confidence: Math.round(match.confidence * 100),
              },
              "Template match found - skipping expensive vision API",
            );

            // Return successful template match
            return {
              layer: 2,
              action: `Click ${template.name}`,
              actionType: "click",
              target: template.name,
              clickCoordinates: {
                x: match.centerX,
                y: match.centerY,
              },
              confidence: Math.round(match.confidence * 100),
              reasoning: `Template matching found '${template.name}' at (${match.centerX}, ${match.centerY}) with ${Math.round(match.confidence * 100)}% confidence. Using cached template for precise, fast click.`,
            };
          }
        }

        log.debug(
          { templatesSearched: templates.length },
          "No template matches found, falling back to vision API",
        );
      } else {
        log.debug("No templates registered yet, skipping template matching");
      }
    }

    // Layer 2b: Fall back to vision API (learning mode)
    log.info({ sublayer: "vision" }, "Using vision API for analysis");

    // Initialize vision analyzer and analyze screenshot
    const visionAnalyzer = new VisionAnalyzer();

    // Prepare registry object names if available
    const registryObjects = context.objectRegistry
      ? context.objectRegistry.getAllObjectNames()
      : undefined;

    const visionResult = await visionAnalyzer.analyzeScreenshot(screenshot, {
      previousAction: context.previousAction,
      gameState: context.gameState,
      attempt: context.attempt,
      inputHint: context.inputHint,
      domAnalysis: context.domAnalysis, // Pass DOM analysis for better context
      registryObjects, // Pass registry object names for deterministic lookups
    });

    log.info(
      {
        confidence: visionResult.confidence,
        threshold: 70,
        actionType: visionResult.actionType,
        suggestedFallbacks: visionResult.suggestedFallbacks,
      },
      "Layer 2 vision analysis result",
    );

    // Log suggested fallbacks if confidence is low
    if (
      visionResult.suggestedFallbacks &&
      visionResult.suggestedFallbacks.length > 0
    ) {
      log.info(
        {
          suggestedFallbacks: visionResult.suggestedFallbacks,
          confidence: visionResult.confidence,
        },
        "Vision analyzer suggests fallback strategies",
      );
    }

    if (visionResult.confidence > 70) {
      log.info(
        { layer: 2, confidence: visionResult.confidence },
        "Layer 2 succeeded with sufficient confidence",
      );

      return {
        layer: 2,
        action: visionResult.nextAction,
        actionType: visionResult.actionType,
        target: visionResult.targetDescription,
        clickCoordinates: visionResult.clickCoordinates,
        confidence: visionResult.confidence,
        reasoning: visionResult.reasoning,
      };
    }

    log.warn(
      { confidence: visionResult.confidence, threshold: 70 },
      "Layer 2 confidence below threshold",
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error({ error: err.message }, "Layer 2 execution failed");
  }

  // Layer 3: RAG (future stretch goal - not implemented in MVP)
  log.error(
    { attempt: context.attempt },
    "All layers failed or had insufficient confidence - game may be unresponsive",
  );

  throw new GameCrashError(
    "Unable to determine next action after trying all available layers. Game may have crashed or become unresponsive.",
  );
}
