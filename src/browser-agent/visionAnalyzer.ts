/**
 * Vision Analyzer for screenshot analysis using GPT-5 mini (Layer 2).
 *
 * Provides intelligent action recommendations when heuristics are uncertain.
 * Uses OpenAI's vision capabilities via Vercel AI SDK for accurate
 * analysis of game screenshots.
 *
 * @module visionAnalyzer
 *
 * @example
 * ```typescript
 * import { VisionAnalyzer } from './visionAnalyzer';
 *
 * const analyzer = new VisionAnalyzer();
 * const screenshot = await page.screenshot();
 * const result = await analyzer.analyzeScreenshot(screenshot, {
 *   previousAction: 'Clicked center',
 *   attempt: 1,
 * });
 *
 * if (result.confidence > 70) {
 *   console.log(`Recommended: ${result.nextAction}`);
 * }
 * ```
 */

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { RetryableError } from "@/errors/retryableError";
import type { DOMAnalysis } from "@/types/qaReport";
import { config } from "@/utils/config";
import { logger } from "@/utils/logger";

const log = logger.child({ component: "VisionAnalyzer" });

/**
 * Registry object names available for coordinate lookups.
 */
export interface RegistryObjectNames {
  /** DOM element names (buttons, links) */
  dom: string[];
  /** Canvas element names (vision-identified) */
  canvas: string[];
}

/**
 * Context information for vision analysis.
 */
export interface VisionContext {
  /** Previous action taken (if any) */
  previousAction?: string;

  /** Current game state description (if available) */
  gameState?: string;

  /** Attempt number for this analysis */
  attempt: number;

  /**
   * Optional hint about game input controls to guide analysis.
   * Helps the AI understand what controls to look for.
   *
   * @example "Arrow keys for movement, spacebar to jump"
   */
  inputHint?: string;

  /**
   * DOM analysis data providing context about page elements.
   * Helps the AI understand available interactive elements without
   * having to visually identify everything.
   */
  domAnalysis?: DOMAnalysis;

  /**
   * Object registry names for deterministic coordinate lookups.
   * When provided, vision should use these exact names in recommendations.
   */
  registryObjects?: RegistryObjectNames;
}

/**
 * Result of vision analysis with action recommendation.
 */
export interface VisionResult {
  /** Recommended next action description */
  nextAction: string;

  /** Type of action recommended */
  actionType: "click" | "keyboard" | "wait" | "scroll" | "unknown";

  /** Description of what to interact with (for click/keyboard) */
  targetDescription?: string;

  /** Approximate click coordinates for canvas-rendered elements (visual novels, canvas games) */
  clickCoordinates?: {
    x: number;
    y: number;
  };

  /** Confidence score 0-100 in this recommendation */
  confidence: number;

  /** Reasoning explaining the recommendation */
  reasoning: string;

  /** Suggested fallback strategies when confidence is low */
  suggestedFallbacks?: string[];
}

/**
 * Zod schema for structured vision analysis output.
 */
const VisionResultSchema = z.object({
  nextAction: z.string().describe(
    "Recommended next action to take. FORMATS: " +
    "(1) For KEYBOARD actions: MUST be exact key name only (ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Space, Enter, Escape, w, a, s, d). " +
    "(2) For CLICK actions: Natural language description of what to click (e.g., 'Click the Start button', 'Click the menu icon'). " +
    "(3) For WAIT actions: Description of what to wait for."
  ),
  actionType: z
    .enum(["click", "keyboard", "wait", "scroll", "unknown"])
    .describe("Type of action recommended"),
  targetDescription: z
    .string()
    .optional()
    .describe("Additional context: For clicks, what element to click. For keyboard, WHY to press that key (e.g., 'to move player right', 'to start game')"),
  clickCoordinates: z
    .object({
      x: z.number().describe("Approximate X pixel coordinate (left edge = 0)"),
      y: z.number().describe("Approximate Y pixel coordinate (top edge = 0)"),
    })
    .optional()
    .describe(
      "ONLY for CLICK actions on canvas-rendered elements (visual novels, canvas games). " +
      "Provide approximate pixel coordinates of where to click based on visual analysis. " +
      "Estimate position by analyzing the screenshot (e.g., Start button at ~120px from left, ~110px from top). " +
      "OMIT this field if the click target is a normal DOM element (HTML button, link, etc.)."
    ),
  confidence: z
    .number()
    .min(0)
    .max(100)
    .describe("Confidence 0-100 in this recommendation"),
  reasoning: z
    .string()
    .describe("Explanation of why this action is recommended"),
  suggestedFallbacks: z
    .array(z.string())
    .optional()
    .describe(
      "Suggested fallback strategies if confidence is low (e.g., 'try random click', 'wait longer', 'try keyboard input')",
    ),
});

/**
 * Vision Analyzer for screenshot-based action recommendations.
 *
 * Uses GPT-5 mini vision capabilities to analyze game screenshots
 * and recommend next actions when heuristics are uncertain (Layer 2
 * of the hybrid action strategy).
 *
 * **Cost:** ~$0.00015 per analysis with GPT-5 mini (10x cheaper than GPT-4o)
 * **Use Case:** Escalation from Layer 1 when confidence < 80%
 *
 * @example
 * ```typescript
 * const analyzer = new VisionAnalyzer();
 *
 * const result = await analyzer.analyzeScreenshot(screenshot, {
 *   previousAction: 'Tried arrow keys',
 *   attempt: 2,
 * });
 *
 * console.log(result.nextAction); // "Click the start button"
 * console.log(result.confidence); // 85
 * ```
 */
export class VisionAnalyzer {
  /** OpenAI provider instance configured with API key */
  private readonly openai;

  /**
   * Creates a new Vision Analyzer instance.
   *
   * Validates that OpenAI API key is configured and initializes
   * the OpenAI provider.
   *
   * @throws {Error} If OPENAI_API_KEY not configured
   */
  constructor() {
    if (!config.openai.apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    // Initialize OpenAI provider with API key from config
    this.openai = createOpenAI({
      apiKey: config.openai.apiKey,
    });

    log.debug("VisionAnalyzer initialized with GPT-5 mini");
  }

  /**
   * Analyzes a screenshot and recommends next action.
   *
   * Uses GPT-5 mini vision model to understand game state and
   * recommend appropriate next action. Returns structured result
   * with action type, confidence, and reasoning.
   *
   * @param screenshot - PNG screenshot as Buffer
   * @param context - Context about previous actions and game state
   * @returns Vision result with action recommendation
   *
   * @throws {RetryableError} On rate limits (retryable)
   * @throws {Error} On invalid API key (non-retryable)
   *
   * @example
   * ```typescript
   * const result = await analyzer.analyzeScreenshot(screenshot, {
   *   previousAction: 'Clicked center',
   *   attempt: 1,
   * });
   *
   * if (result.confidence > 70) {
   *   // Use recommended action
   * }
   * ```
   */
  async analyzeScreenshot(
    screenshot: Buffer,
    context: VisionContext,
  ): Promise<VisionResult> {
    try {
      log.info(
        { attempt: context.attempt },
        "Analyzing screenshot for next action",
      );

      // Convert screenshot to base64 data URL
      const imageDataUrl = this.imageToDataUrl(screenshot);

      // Call OpenAI vision API with structured output
      const result = await generateObject({
        model: this.openai("gpt-5-mini"),
        schema: VisionResultSchema,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: this.buildPrompt(context),
              },
              {
                type: "image",
                image: imageDataUrl,
              },
            ],
          },
        ],
        // Note: temperature not supported by reasoning models like GPT-5 mini
      });

      // Validate the result has all required fields
      const object = result.object;
      if (
        !object ||
        typeof object.confidence !== "number" ||
        !object.actionType
      ) {
        log.warn(
          {
            object,
            attempt: context.attempt,
            hasObject: !!object,
            confidenceType: typeof object?.confidence,
            actionType: object?.actionType,
          },
          "Vision response missing required fields, using fallback",
        );
        return {
          nextAction: object?.nextAction || "Wait for game to load",
          actionType: object?.actionType || "wait",
          confidence:
            typeof object?.confidence === "number" ? object.confidence : 50,
          reasoning:
            object?.reasoning ||
            "Response was incomplete, defaulting to wait action",
          targetDescription: object?.targetDescription,
          suggestedFallbacks: object?.suggestedFallbacks || [
            "wait longer for loading",
            "try random click on center",
          ],
        };
      }

      log.info(
        {
          confidence: object.confidence,
          actionType: object.actionType,
          attempt: context.attempt,
        },
        "Vision analysis complete",
      );

      return object as VisionResult;
    } catch (error) {
      return this.handleAnalysisError(error, context);
    }
  }

  /**
   * Builds prompt for vision analysis based on context.
   *
   * @param context - Context about previous actions
   * @returns Formatted prompt string
   * @private
   */
  private buildPrompt(context: VisionContext): string {
    let prompt = `Analyze this game screenshot and recommend the next action.

Game Context:
- Attempt: ${context.attempt}`;

    if (context.previousAction) {
      prompt += `\n- Previous Action: ${context.previousAction}`;
    }

    if (context.gameState) {
      prompt += `\n- Game State: ${context.gameState}`;
    }

    if (context.inputHint) {
      prompt += `\n\n**GAME OBJECTIVE & CONTROLS:**\n${context.inputHint}`;
      prompt += `\n\nIMPORTANT: Use these controls to achieve the game objective. If stuck or repeating the same action, try different keys to explore and progress.`;
    }

    // Add object registry context if available
    if (context.registryObjects) {
      const { dom, canvas } = context.registryObjects;
      if (dom.length > 0 || canvas.length > 0) {
        prompt += `\n\n**REGISTERED UI OBJECTS (use these exact names for clicks):**`;

        if (dom.length > 0) {
          prompt += `\n- DOM Elements: ${dom.slice(0, 10).join(", ")}`;
          if (dom.length > 10) {
            prompt += ` (and ${dom.length - 10} more)`;
          }
        }

        if (canvas.length > 0) {
          prompt += `\n- Canvas Elements: ${canvas.join(", ")}`;
        }

        prompt += `\n\n**CRITICAL - USE REGISTRY NAMES:**`;
        prompt += `\nWhen recommending clicks, use the EXACT object names from the registry above.`;
        prompt += `\nExample: If registry has "start", recommend: nextAction: "Click 'start'"`;
        prompt += `\nThis ensures precise coordinate lookup without re-analyzing the screen.`;
      }
    }

    // Add DOM analysis context if available
    if (context.domAnalysis) {
      const dom = context.domAnalysis;
      prompt += `\n\nDOM Analysis (Page Structure):`;
      prompt += `\n- Interactive Elements Found: ${dom.interactiveCount}`;

      // Add button information
      if (dom.buttons.length > 0) {
        prompt += `\n- Buttons Detected (${dom.buttons.length}):`;
        dom.buttons.slice(0, 5).forEach((btn) => {
          const text = btn.text.substring(0, 50);
          const visible = btn.visible ? "visible" : "hidden";
          const pos = `(${Math.round(btn.position.x)},${Math.round(btn.position.y)})`;
          prompt += `\n  * "${text}" [${visible}] at ${pos}`;
        });
        if (dom.buttons.length > 5) {
          prompt += `\n  * ...and ${dom.buttons.length - 5} more buttons`;
        }
      }

      // Add canvas information (important for games)
      if (dom.canvases.length > 0) {
        prompt += `\n- Canvas Elements (${dom.canvases.length}):`;
        dom.canvases.forEach((canvas) => {
          const size = `${canvas.width}x${canvas.height}`;
          const pos = `(${Math.round(canvas.position.x)},${Math.round(canvas.position.y)})`;
          const primary = canvas.isPrimaryGame ? " [PRIMARY GAME]" : "";
          prompt += `\n  * Canvas ${canvas.id || "unnamed"} ${size} at ${pos}${primary}`;
        });
      }

      // Add input fields if any
      if (dom.inputs.length > 0) {
        prompt += `\n- Input Fields: ${dom.inputs.length} found`;
      }

      // Add viewport dimensions
      prompt += `\n- Viewport: ${dom.viewport.width}x${dom.viewport.height}`;
    }

    prompt += `

Task:
1. Identify interactive elements (buttons, controls, clickable areas)
2. Determine if the game is responsive and playable
3. Recommend the next action to progress or test the game
4. Provide confidence in your recommendation (0-100)
5. If confidence is low (<70), suggest fallback strategies to try

Focus on:
- Game responsiveness (does it respond to input?)
- Interactive elements that should be tested (use DOM analysis above for guidance)
- **Progression opportunities** - Look for collectibles, objectives, obstacles, enemies
- **Exploration** - If previous actions show the player is stuck (hitting wall, repeating same movement), try DIFFERENT keys
- Any visible errors or issues
- Whether game canvas or UI is partially cut off (check viewport vs canvas position)${context.inputHint ? `\n- **Follow the game objective and controls from the input hint above**` : ""}${context.domAnalysis ? `\n- Leverage the DOM analysis data to identify specific buttons/elements to interact with` : ""}

**CRITICAL - IGNORE DOWNLOAD/INSTALL ELEMENTS:**
NEVER click or interact with download/install links or buttons. These are OUT OF SCOPE:
- Any button/link with text: "Download", "Install", "Get it on", "Available on"
- Any link pointing to .zip, .exe, .dmg, .apk, .ipa, .pkg files
- Platform-specific download buttons (Windows, macOS, Linux, Android, iOS)
- App store badges or links
- "Download now", "Free download", "Get the app" buttons
Focus ONLY on in-browser game functionality - the game runs in the browser, no downloads needed.

**CRITICAL - AVOID GETTING STUCK:**
If previous action shows:
- Player hit a wall or obstacle → Try a DIFFERENT direction (ArrowLeft if was going right, ArrowUp/ArrowDown to explore)
- Player is stationary and repeating same key → Try OTHER movement keys or Space to jump
- Keep clicking "Run game" button → Game is already running! Use keyboard controls instead
- Same screen state for 2+ actions → Change strategy - try unexplored keys or different directions
- Only using ArrowLeft/ArrowRight → Try ArrowUp/ArrowDown for vertical movement or Space to jump
- Collectibles visible but not being collected → Move TOWARD them using appropriate direction keys

**MOVEMENT EXPLORATION PRIORITY:**
Many games require exploring in MULTIPLE dimensions:
1. If collectibles (coins, sprites, items) are ABOVE the player → Try ArrowUp or Space to jump
2. If collectibles are BELOW the player → Try ArrowDown to move down
3. If collectibles are to the LEFT or RIGHT → Use ArrowLeft or ArrowRight
4. If stuck at wall/obstacle → Try Space to jump OVER it, or try vertical movement (ArrowUp/ArrowDown)
5. ALWAYS try different movement directions - don't just go left/right repeatedly

**COLLECTION GAME STRATEGY (when goal is to collect items/sprites):**
For games where you need to collect multiple small objects scattered across the play area:
1. **Use systematic sweep pattern** - Move in a consistent pattern to cover the entire area
   - Example: Right → Right → Down → Left → Left → Down → Right (zigzag pattern)
   - Example: Move along edges first (Right until wall, Down, Left until wall, Down, repeat)
2. **Continue moving in same direction until hitting obstacle** - Don't change direction randomly
3. **When hitting wall/boundary** - Turn 90 degrees and continue systematic sweep
4. **Track progress** - If score increases, you collected something! Keep exploring that region
5. **Avoid random wandering** - Systematic patterns ensure you don't miss collectibles

KEYBOARD ACTIONS - CRITICAL REQUIREMENTS:
When recommending keyboard input (actionType: "keyboard"), you MUST follow this format:
- **nextAction field**: MUST contain ONLY the exact key name (ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Space, Enter, Escape, w, a, s, d)
- **targetDescription field**: Explain WHY to press that key (e.g., "to move the player right", "to jump over obstacle")

CORRECT examples:
- nextAction: "ArrowRight", targetDescription: "to move the player right"
- nextAction: "Space", targetDescription: "to jump over the obstacle"
- nextAction: "Enter", targetDescription: "to start the game"
- nextAction: "ArrowDown", targetDescription: "to navigate menu down"

INCORRECT examples (DO NOT USE):
- nextAction: "Press ArrowRight to move" ❌ (nextAction should be just "ArrowRight")
- nextAction: "Use arrow keys" ❌ (must specify exact key)
- nextAction: "Move right" ❌ (must be the key name, not the action)
- nextAction: "ArrowRight key" ❌ (just "ArrowRight", no "key" suffix)

Supported keys (use exact capitalization): ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Space, Enter, Escape, w, a, s, d

**MENU NAVIGATION DETECTION:**
Some games use KEYBOARD NAVIGATION for menus, but many use MOUSE CLICKS - check the input hint!

**For POINT-AND-CLICK / VISUAL NOVEL games** (when input hint mentions "click", "mouse", "point and click"):
- Menu items → Use CLICK actions, NOT keyboard
- Example: actionType: "click", nextAction: "Click the Start button", targetDescription: "Start button to begin game"
- These games typically require mouse clicks even for menus
- **CRITICAL for canvas-rendered buttons**: Provide clickCoordinates with PRECISE pixel position
  - Analyze the screenshot VERY carefully to estimate button position
  - For visual novel games: Start button is typically at the TOP-LEFT of menu area
  - Example: Start button usually around x=115-125, y=105-115 (measure from canvas edge, not page)
  - Menu buttons stacked vertically: Start ~110px, Load ~155px, Options ~200px, Quit ~245px from canvas top
  - BE PRECISE - off by even 50px can miss the button entirely
  - This helps when DOM elements are not available (canvas-rendered games)

**For ACTION/PLATFORMER games** (when input hint mentions "arrow keys", "WASD", "keyboard controls"):
- Menu items with highlight/selection indicators → nextAction: "ArrowDown", targetDescription: "to navigate menu down"
- "Press Enter to Start" text → nextAction: "Enter", targetDescription: "to start game"
- Menu options stacked vertically → Navigation is likely ArrowUp/ArrowDown + Enter
- Selected/highlighted menu item visible → nextAction: "Enter", targetDescription: "to activate selected item"

If you see movement controls, specify WHICH key (e.g., nextAction: "ArrowRight", targetDescription: "to move right").
If you see obstacles ahead, specify the exact key (e.g., nextAction: "Space", targetDescription: "to jump over obstacle").

Be specific about what to click, what keys to press, or which direction to scroll.
${context.domAnalysis?.buttons && context.domAnalysis.buttons.length > 0 ? `When recommending clicks, prefer using button text from the DOM analysis above.` : ""}

**Fallback Suggestions (when uncertain):**
If your confidence is below 70%, provide suggestions for what to try:
- "try random click on center" - if game might need initial interaction
- "wait longer for loading" - if game appears to still be loading
- "try keyboard input" - if game might respond to keys
- "try clicking visible UI elements" - if there are buttons/menus
- "scroll down to see full game" - if game canvas appears cut off at bottom
- "game may be stuck on prompt" - if awaiting specific user action`;

    return prompt;
  }

  /**
   * Converts screenshot buffer to base64 data URL.
   *
   * @param screenshot - Screenshot buffer
   * @returns Data URL string for image
   * @private
   */
  private imageToDataUrl(screenshot: Buffer): string {
    return `data:image/png;base64,${screenshot.toString("base64")}`;
  }

  /**
   * Handles errors during vision analysis.
   *
   * Distinguishes between retryable errors (rate limits) and
   * fatal errors (invalid API key). Returns low confidence
   * result for unexpected errors.
   *
   * @param error - Error from vision API
   * @param context - Context for logging
   * @returns Low confidence result or throws error
   * @throws {RetryableError} For rate limits
   * @throws {Error} For invalid API key
   * @private
   */
  private handleAnalysisError(
    error: unknown,
    context: VisionContext,
  ): VisionResult {
    const err = error instanceof Error ? error : new Error(String(error));
    const lowerMessage = err.message.toLowerCase();

    // Check for schema validation errors (OpenAI returned something that doesn't match)
    if (
      lowerMessage.includes("schema") ||
      lowerMessage.includes("no object generated")
    ) {
      log.warn(
        {
          error: err.message,
          attempt: context.attempt,
          stack: err.stack,
        },
        "Vision API response did not match schema - using fallback action",
      );
      return {
        nextAction: "Wait for game to load",
        actionType: "wait",
        confidence: 30,
        reasoning:
          "Vision analysis returned invalid format, defaulting to wait action",
        suggestedFallbacks: [
          "wait longer for loading",
          "try random click on center",
          "try keyboard input",
        ],
      };
    }

    // Check for rate limiting (retryable)
    if (
      lowerMessage.includes("rate limit") ||
      lowerMessage.includes("429") ||
      lowerMessage.includes("quota")
    ) {
      log.warn(
        { error: err.message, attempt: context.attempt },
        "Rate limit hit, will retry",
      );
      throw new RetryableError(`Vision API rate limit: ${err.message}`);
    }

    // Check for invalid API key (non-retryable)
    if (
      (lowerMessage.includes("invalid") ||
        lowerMessage.includes("401") ||
        lowerMessage.includes("unauthorized")) &&
      lowerMessage.includes("api")
    ) {
      log.error({ error: err.message }, "Invalid API key");
      throw new Error("Invalid OpenAI API key - check configuration");
    }

    // Other errors - return low confidence result
    log.error(
      { error: err.message, stack: err.stack, attempt: context.attempt },
      "Vision analysis failed",
    );

    return {
      nextAction: "Unable to analyze - error occurred",
      actionType: "unknown",
      confidence: 0,
      reasoning: `Vision analysis failed: ${err.message}`,
      suggestedFallbacks: [
        "wait longer for loading",
        "try random click on center",
      ],
    };
  }

  /**
   * Detects game type from screenshot using vision analysis.
   *
   * This is a specialized method for game type detection that provides
   * the AI with an explicit list of valid game types to choose from.
   * This prevents hallucinations and ensures the result is one of our
   * supported types.
   *
   * @param screenshot - Screenshot buffer to analyze
   * @returns Vision analysis result with game type reasoning
   * @throws {Error} When vision analysis fails
   *
   * @example
   * ```typescript
   * const analyzer = new VisionAnalyzer();
   * const screenshot = await page.screenshot();
   * const result = await analyzer.detectGameType(screenshot);
   * // result.reasoning will contain game type keywords
   * ```
   */
  async detectGameType(screenshot: Buffer): Promise<VisionResult> {
    log.info("Analyzing screenshot for game type detection");

    const openai = createOpenAI({
      apiKey: config.openai.apiKey,
    });

    try {
      const { object } = await generateObject({
        model: openai("gpt-4o-mini"),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                image: screenshot,
              },
              {
                type: "text",
                text: `You are a game classification expert. Analyze this screenshot and identify what TYPE of game this is.

**IMPORTANT - You MUST choose from this EXACT list of valid game types:**

1. **platformer** - Side-scrolling games with jumping, physics, gravity (e.g., Mario, Sonic)
2. **clicker** - Idle/incremental games with clicking and upgrades (e.g., Cookie Clicker)
3. **puzzle** - Match-3, tile-based, grid puzzles (e.g., Tetris, Candy Crush)
4. **visual-novel** - Story-driven narrative games with choices
5. **shooter** - Action games with shooting/aiming mechanics (FPS, bullet hell)
6. **racing** - Driving/racing games with vehicles and tracks
7. **rpg** - Role-playing games with characters, quests, inventory
8. **strategy** - Strategy, tower defense, RTS games
9. **arcade** - Classic arcade-style games (retro, fast-paced)
10. **card** - Card games with decks, hands, playing cards
11. **sports** - Sports games (soccer, basketball, tennis, etc.)
12. **simulation** - Simulation games, management games
13. **generic** - If none of the above fit, use this

**Instructions:**
1. Examine the screenshot carefully
2. Identify visual clues (UI, graphics, gameplay elements)
3. Choose the MOST APPROPRIATE type from the list above
4. Include the exact game type name in your reasoning
5. Explain WHY you chose that type (cite specific visual evidence)

**Your reasoning MUST include the exact game type name from the list above!**

Example: "This appears to be a **platformer** game because I can see a character with jumping mechanics, platforms at different heights, and physics-based movement."`,
              },
            ],
          },
        ],
        schema: z.object({
          nextAction: z.string().describe("Summary of game type identified"),
          actionType: z
            .enum(["wait", "unknown"])
            .describe("Always use 'wait' for game type detection"),
          confidence: z
            .number()
            .min(0)
            .max(100)
            .describe(
              "Confidence in game type identification (0-100). Be honest - if unsure, use lower confidence.",
            ),
          reasoning: z
            .string()
            .describe(
              "Detailed explanation of game type classification with specific visual evidence. MUST include the exact game type name from the provided list.",
            ),
        }),
        maxRetries: 2,
      });

      log.info(
        {
          confidence: object.confidence,
          reasoning: object.reasoning.substring(0, 150),
        },
        "Game type detection complete",
      );

      return {
        nextAction: object.nextAction,
        actionType: object.actionType,
        confidence: object.confidence,
        reasoning: object.reasoning,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        { error: err.message, stack: err.stack },
        "Game type detection failed",
      );

      // Return low confidence result
      return {
        nextAction: "Unable to detect game type",
        actionType: "unknown",
        confidence: 0,
        reasoning: `Game type detection failed: ${err.message}`,
      };
    }
  }

  /**
   * Analyzes a screenshot to detect if it's a start/title/menu screen
   * and provides instructions on how to start the game.
   *
   * @param screenshot - Screenshot buffer
   * @param domAnalysis - DOM analysis data with interactive elements
   * @returns Start screen detection result with click instructions
   */
  async detectStartScreen(
    screenshot: Buffer,
    domAnalysis?: DOMAnalysis,
  ): Promise<{
    isStartScreen: boolean;
    confidence: number;
    reasoning: string;
    startAction?: VisionResult;
  }> {
    const base64Screenshot = screenshot.toString("base64");

    const openai = createOpenAI({
      apiKey: config.openai.apiKey,
    });

    try {
      log.info("Analyzing screenshot for start/title/menu screen detection");

      // Build DOM context string for the prompt
      let domContext = "";
      if (domAnalysis) {
        const buttons = domAnalysis.buttons
          .slice(0, 10)
          .map((b) => `- ${b.text || "Unlabeled button"}`)
          .join("\n");
        const links = domAnalysis.links
          .slice(0, 10)
          .map((l) => l.text)
          .filter((t) => t)
          .join(", ");

        domContext = `\n\nDOM Elements Found:\nButtons:\n${buttons || "(none)"}\nLinks: ${links || "(none)"}`;
      }

      const { object } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: z.object({
          isStartScreen: z
            .boolean()
            .describe(
              "Is this a start/title/menu screen that requires clicking a button to begin the game? " +
              "Examples: Title screen with 'New Game' button, main menu with 'Play' button, splash screen with 'Start' button. " +
              "NOT a start screen: in-game dialogue, gameplay screen, settings menu, loading screen with no interaction needed."
            ),
          confidence: z
            .number()
            .min(0)
            .max(100)
            .describe("Confidence level 0-100 in this detection"),
          reasoning: z
            .string()
            .describe(
              "Detailed explanation of why this is or is not a start screen, with specific visual evidence"
            ),
          startButtonText: z
            .string()
            .optional()
            .describe(
              "If isStartScreen=true, the exact text on the start button (e.g., 'New Game', 'Play', 'Start', 'Continue')"
            ),
          startButtonType: z
            .enum(["dom", "canvas"])
            .optional()
            .describe(
              "If isStartScreen=true, is the start button a DOM element (HTML button/link) or canvas-rendered?"
            ),
          clickCoordinates: z
            .object({
              x: z.number(),
              y: z.number(),
            })
            .optional()
            .describe(
              "If isStartScreen=true AND startButtonType=canvas, provide approximate pixel coordinates of the start button"
            ),
        }),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `You are analyzing a game screenshot to determine if this is a start/title/menu screen that requires user interaction to begin the game.

TASK:
1. Analyze the screenshot
2. Check if this is a start screen (title screen, main menu) with a "start game" button
3. If yes, identify HOW to start the game (DOM button vs canvas-rendered button)
4. Provide click coordinates if it's a canvas-rendered button

${domContext}

Common start screen indicators:
- Game title/logo prominently displayed
- Buttons with text like "New Game", "Start", "Play", "Begin", "Continue"
- Main menu options
- Copyright/credits on screen

NOT start screens:
- In-game dialogue/conversation
- Gameplay with controls
- Loading screens (no interaction needed)
- Settings/options menus
- Pause screens

If this IS a start screen:
- Look for the start button in both the screenshot AND the DOM elements list
- If the button text appears in the DOM list, it's a DOM element (startButtonType='dom')
- If the button is only visible in the screenshot but NOT in DOM, it's canvas-rendered (startButtonType='canvas')
- For canvas-rendered buttons, estimate pixel coordinates`,
              },
              {
                type: "image",
                image: base64Screenshot,
              },
            ],
          },
        ],
        maxRetries: 2,
      });

      log.info(
        {
          isStartScreen: object.isStartScreen,
          confidence: object.confidence,
          buttonText: object.startButtonText,
          buttonType: object.startButtonType,
        },
        "Start screen detection complete"
      );

      // If it's a start screen, format the start action
      let startAction: VisionResult | undefined;
      if (object.isStartScreen && object.startButtonText) {
        startAction = {
          nextAction: `Click the '${object.startButtonText}' button to start the game`,
          actionType: "click",
          targetDescription: object.startButtonText,
          clickCoordinates: object.clickCoordinates,
          confidence: object.confidence,
          reasoning: object.reasoning,
        };
      }

      return {
        isStartScreen: object.isStartScreen,
        confidence: object.confidence,
        reasoning: object.reasoning,
        startAction,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(
        { error: err.message, stack: err.stack },
        "Start screen detection failed"
      );

      return {
        isStartScreen: false,
        confidence: 0,
        reasoning: `Start screen detection failed: ${err.message}`,
      };
    }
  }
}
