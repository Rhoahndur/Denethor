/**
 * Object Registry for consistent coordinate mapping.
 *
 * Maintains a deterministic mapping between UI object names and their coordinates.
 * Combines exact DOM coordinates with vision-identified canvas coordinates for
 * hybrid game support (HTML + Canvas).
 *
 * @module objectRegistry
 *
 * @example
 * ```typescript
 * import { ObjectRegistry } from './objectRegistry';
 *
 * const registry = new ObjectRegistry();
 * await registry.buildDOMRegistry(domAnalysis);
 * await registry.buildCanvasRegistry(page, visionAnalyzer);
 *
 * const coords = registry.lookupCoordinates("Start");
 * if (coords) {
 *   await page.mouse.click(coords.x, coords.y);
 * }
 * ```
 */

import type { Page } from "@browserbasehq/stagehand";
import type { DOMAnalysis } from "@/types/qaReport";
import { logger } from "@/utils/logger";
import type { VisionAnalyzer } from "./visionAnalyzer";

const log = logger.child({ component: "ObjectRegistry" });

/**
 * DOM element entry in the registry.
 */
export interface DOMElementEntry {
  /** CSS selector for this element */
  selector: string;
  /** Absolute position on page */
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Element text content */
  text: string;
  /** Element ID if present */
  id?: string;
  /** Whether element is currently visible */
  visible: boolean;
}

/**
 * Canvas element entry in the registry.
 */
export interface CanvasElementEntry {
  /** Coordinates relative to canvas origin */
  coordinates: {
    x: number;
    y: number;
  };
  /** Confidence in this coordinate (0-100) */
  confidence: number;
  /** When this entry was last updated */
  lastUpdated: number;
  /** Type of element (button, control, etc.) */
  type: string;
}

/**
 * Canvas object identified by vision analysis.
 */
export interface CanvasObject {
  /** Object name/label */
  name: string;
  /** X coordinate relative to canvas */
  x: number;
  /** Y coordinate relative to canvas */
  y: number;
  /** Object type (button, sprite, etc.) */
  type: string;
  /** Confidence in detection (0-100) */
  confidence: number;
}

/**
 * Coordinate lookup result.
 */
export interface CoordinateLookupResult {
  /** Absolute X coordinate on page */
  x: number;
  /** Absolute Y coordinate on page */
  y: number;
  /** Source of coordinates (dom or canvas) */
  source: "dom" | "canvas";
  /** Confidence in coordinates (0-100) */
  confidence: number;
}

/**
 * Object Registry for mapping UI element names to coordinates.
 *
 * Provides deterministic coordinate lookups for both DOM-based and canvas-rendered
 * UI elements. DOM elements use exact browser coordinates, while canvas elements
 * use vision-identified coordinates (built once per session/viewport change).
 *
 * **Architecture:**
 * - DOM Registry: Built from DOM analysis (exact coordinates)
 * - Canvas Registry: Built from vision analysis (approximate coordinates)
 * - Viewport tracking: Rebuilds registry on resize
 * - Name normalization: Consistent matching between vision output and registry
 *
 * @example
 * ```typescript
 * const registry = new ObjectRegistry();
 *
 * // Build registries after page load
 * await registry.buildDOMRegistry(domAnalysis);
 * if (hasCanvas) {
 *   await registry.buildCanvasRegistry(page, visionAnalyzer);
 * }
 *
 * // Lookup coordinates during gameplay
 * const coords = registry.lookupCoordinates("Start");
 * if (coords) {
 *   await page.mouse.click(coords.x, coords.y);
 * }
 * ```
 */
export class ObjectRegistry {
  /** DOM elements mapped by normalized name */
  private domElements: Map<string, DOMElementEntry> = new Map();

  /** Canvas elements mapped by normalized name */
  private canvasElements: Map<string, CanvasElementEntry> = new Map();

  /** Canvas offset from page origin */
  private canvasOffset: { x: number; y: number } = { x: 0, y: 0 };

  /** Current viewport dimensions */
  private viewport: { width: number; height: number } | null = null;

  /** Maximum number of DOM elements to store (memory limit) */
  private readonly MAX_DOM_ELEMENTS = 30;

  /** Maximum number of canvas elements to store (memory limit) */
  private readonly MAX_CANVAS_ELEMENTS = 15;

  /**
   * Normalizes object name for consistent matching.
   *
   * Converts names to lowercase, removes quotes, normalizes whitespace,
   * and removes common button suffixes.
   *
   * @param name - Object name to normalize
   * @returns Normalized name for registry lookup
   *
   * @example
   * ```typescript
   * normalizeObjectName("Start Button") // => "start"
   * normalizeObjectName("'New Game' button") // => "new-game"
   * normalizeObjectName("  Play  Now  ") // => "play-now"
   * ```
   */
  private normalizeObjectName(name: string): string {
    return name
      .toLowerCase()
      .replace(/['"]/g, "") // Remove quotes
      .replace(/\s+/g, "-") // Convert spaces to dashes
      .replace(/-?button-?/gi, "") // Remove "button" suffix/prefix
      .replace(/-?btn-?/gi, "") // Remove "btn" suffix/prefix
      .replace(/^-+|-+$/g, ""); // Trim leading/trailing dashes
  }

  /**
   * Builds DOM registry from DOM analysis data.
   *
   * Extracts interactive elements (buttons, links) and stores their exact
   * coordinates from browser APIs. Prioritizes visible elements and limits
   * registry size for memory efficiency.
   *
   * **Note:** Download/install elements are already filtered out by DOM analysis,
   * so they will not appear in the registry.
   *
   * @param domAnalysis - DOM analysis data from BrowserAgent
   *
   * @example
   * ```typescript
   * const domAnalysis = await agent.analyzeDOMElements();
   * registry.buildDOMRegistry(domAnalysis);
   * ```
   */
  buildDOMRegistry(domAnalysis: DOMAnalysis): void {
    log.info("Building DOM registry from DOM analysis (download elements pre-filtered)");

    this.viewport = domAnalysis.viewport;
    this.domElements.clear();

    // Combine buttons and links (prioritize buttons)
    const elements = [
      ...domAnalysis.buttons.map((btn) => ({ ...btn, priority: 2 })),
      ...domAnalysis.links.map((link) => ({ ...link, priority: 1 })),
    ];

    // Filter to visible elements and sort by priority
    const visibleElements = elements
      .filter((el) => el.visible && el.text.length > 0)
      .sort((a, b) => b.priority - a.priority);

    // Take top N elements (memory limit)
    const topElements = visibleElements.slice(0, this.MAX_DOM_ELEMENTS);

    for (const element of topElements) {
      const normalizedName = this.normalizeObjectName(element.text);

      // Build CSS selector (prefer ID, fallback to position-based identifier)
      let selector: string;
      if (element.id) {
        selector = `#${element.id}`;
      } else if (element.classes.length > 0) {
        // Try class-based selector
        selector = `${element.tag}.${element.classes[0]}`;
      } else {
        // No ID or classes - selector will be unreliable
        // We rely on coordinate-based clicking for these elements
        selector = `${element.tag}[data-registry-text="${normalizedName}"]`;
      }

      const entry: DOMElementEntry = {
        selector,
        position: element.position,
        text: element.text,
        id: element.id,
        visible: element.visible,
      };

      this.domElements.set(normalizedName, entry);

      log.debug(
        {
          name: normalizedName,
          text: element.text,
          selector,
          position: element.position,
        },
        "Added DOM element to registry",
      );
    }

    log.info(
      { count: this.domElements.size, maxSize: this.MAX_DOM_ELEMENTS },
      "DOM registry built successfully",
    );
  }

  /**
   * Builds canvas registry using vision analysis.
   *
   * Uses VisionAnalyzer to identify interactive elements on canvas-rendered
   * games (visual novels, Unity games, etc.). Stores coordinates relative
   * to canvas origin for deterministic lookups.
   *
   * **Note:** This is called once per session or when viewport changes.
   * Vision analysis is expensive (~$0.00015 per call) so we cache results.
   *
   * @param page - Playwright page object
   * @param visionAnalyzer - VisionAnalyzer instance
   * @returns Promise that resolves when registry is built
   *
   * @example
   * ```typescript
   * const visionAnalyzer = new VisionAnalyzer();
   * await registry.buildCanvasRegistry(page, visionAnalyzer);
   * ```
   */
  async buildCanvasRegistry(
    page: Page,
    visionAnalyzer: VisionAnalyzer,
  ): Promise<void> {
    log.info("Building canvas registry using vision analysis");

    try {
      // Find canvas offset on page
      this.canvasOffset = await page.evaluate(() => {
        const selectors = [
          "canvas",
          'iframe[src*="html"]',
          ".game_frame canvas",
          "#game canvas",
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            const rect = element.getBoundingClientRect();
            return {
              x: rect.left + window.scrollX,
              y: rect.top + window.scrollY,
            };
          }
        }

        // No canvas found, return zero offset
        return { x: 0, y: 0 };
      });

      log.debug({ canvasOffset: this.canvasOffset }, "Found canvas offset");

      // Capture screenshot for vision analysis
      const screenshot = await page.screenshot();

      // Use vision analyzer in "registry building" mode
      const canvasObjects = await this.buildCanvasRegistryFromVision(
        screenshot,
        visionAnalyzer,
      );

      // Store canvas objects in registry
      this.canvasElements.clear();
      for (const obj of canvasObjects) {
        const normalizedName = this.normalizeObjectName(obj.name);

        const entry: CanvasElementEntry = {
          coordinates: { x: obj.x, y: obj.y },
          confidence: obj.confidence,
          lastUpdated: Date.now(),
          type: obj.type,
        };

        this.canvasElements.set(normalizedName, entry);

        log.debug(
          {
            name: normalizedName,
            originalName: obj.name,
            coordinates: obj,
            type: obj.type,
          },
          "Added canvas element to registry",
        );
      }

      log.info(
        {
          count: this.canvasElements.size,
          maxSize: this.MAX_CANVAS_ELEMENTS,
        },
        "Canvas registry built successfully",
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ error: err.message }, "Failed to build canvas registry");
      // Don't throw - canvas registry is optional fallback
    }
  }

  /**
   * Uses vision analyzer to identify canvas objects.
   *
   * Calls VisionAnalyzer with a special prompt to enumerate all interactive
   * UI elements visible on the canvas with their coordinates.
   *
   * @param screenshot - Screenshot buffer
   * @param visionAnalyzer - VisionAnalyzer instance
   * @returns Promise resolving to array of canvas objects
   * @private
   */
  private async buildCanvasRegistryFromVision(
    screenshot: Buffer,
    visionAnalyzer: VisionAnalyzer,
  ): Promise<CanvasObject[]> {
    // Use the vision analyzer's internal method to analyze
    // For now, we'll use the existing analyzeScreenshot and extract info
    // In a real implementation, you'd add a dedicated method to VisionAnalyzer

    log.debug("Analyzing canvas screenshot for interactive elements");

    try {
      // This is a simplified approach - in production you'd add a dedicated
      // schema and method to VisionAnalyzer for registry building
      const result = await visionAnalyzer.analyzeScreenshot(screenshot, {
        previousAction: "Building object registry",
        gameState: "Identifying interactive UI elements",
        attempt: 1,
      });

      // Extract coordinates if provided
      const objects: CanvasObject[] = [];

      if (result.clickCoordinates && result.targetDescription) {
        // Vision provided a click target with coordinates
        objects.push({
          name: result.targetDescription,
          x: result.clickCoordinates.x,
          y: result.clickCoordinates.y,
          type: "button",
          confidence: result.confidence,
        });
      }

      log.debug(
        { objectsFound: objects.length },
        "Extracted canvas objects from vision analysis",
      );

      return objects;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.warn(
        { error: err.message },
        "Vision analysis failed during registry building",
      );
      return [];
    }
  }

  /**
   * Looks up coordinates for a named object.
   *
   * Searches both DOM and canvas registries for the object. Returns exact
   * DOM coordinates if available, otherwise falls back to canvas coordinates.
   *
   * @param objectName - Name of object to look up (e.g., "Start", "New Game")
   * @returns Coordinate lookup result, or null if not found
   *
   * @example
   * ```typescript
   * // Vision recommends: "Click the 'Start' button"
   * const coords = registry.lookupCoordinates("Start");
   * if (coords) {
   *   await page.mouse.click(coords.x, coords.y);
   *   console.log(`Clicked at ${coords.x},${coords.y} (source: ${coords.source})`);
   * }
   * ```
   */
  lookupCoordinates(objectName: string): CoordinateLookupResult | null {
    const normalizedName = this.normalizeObjectName(objectName);

    log.debug({ objectName, normalizedName }, "Looking up coordinates");

    // Priority 1: Check DOM registry (exact coordinates)
    const domEntry = this.domElements.get(normalizedName);
    if (domEntry) {
      const centerX = domEntry.position.x + domEntry.position.width / 2;
      const centerY = domEntry.position.y + domEntry.position.height / 2;

      log.info(
        {
          objectName,
          normalizedName,
          x: centerX,
          y: centerY,
          source: "dom",
        },
        "Found coordinates in DOM registry",
      );

      return {
        x: centerX,
        y: centerY,
        source: "dom",
        confidence: 100, // DOM coordinates are exact
      };
    }

    // Priority 2: Check canvas registry (vision-identified)
    const canvasEntry = this.canvasElements.get(normalizedName);
    if (canvasEntry) {
      // Convert canvas-relative coordinates to page coordinates
      const pageX = this.canvasOffset.x + canvasEntry.coordinates.x;
      const pageY = this.canvasOffset.y + canvasEntry.coordinates.y;

      log.info(
        {
          objectName,
          normalizedName,
          x: pageX,
          y: pageY,
          source: "canvas",
          confidence: canvasEntry.confidence,
        },
        "Found coordinates in canvas registry",
      );

      return {
        x: pageX,
        y: pageY,
        source: "canvas",
        confidence: canvasEntry.confidence,
      };
    }

    log.debug(
      { objectName, normalizedName },
      "Object not found in registry",
    );

    return null;
  }

  /**
   * Checks if registry needs to be refreshed due to viewport change.
   *
   * @param currentViewport - Current viewport dimensions
   * @returns True if registry should be rebuilt
   *
   * @example
   * ```typescript
   * const currentViewport = { width: 1280, height: 720 };
   * if (registry.needsRefresh(currentViewport)) {
   *   await registry.buildDOMRegistry(domAnalysis);
   *   await registry.buildCanvasRegistry(page, visionAnalyzer);
   * }
   * ```
   */
  needsRefresh(currentViewport: { width: number; height: number }): boolean {
    if (!this.viewport) {
      return true;
    }

    const changed =
      this.viewport.width !== currentViewport.width ||
      this.viewport.height !== currentViewport.height;

    if (changed) {
      log.info(
        {
          old: this.viewport,
          new: currentViewport,
        },
        "Viewport changed, registry needs refresh",
      );
    }

    return changed;
  }

  /**
   * Gets registry statistics for debugging.
   *
   * @returns Object containing registry stats
   */
  getStats(): {
    domElements: number;
    canvasElements: number;
    viewport: { width: number; height: number } | null;
  } {
    return {
      domElements: this.domElements.size,
      canvasElements: this.canvasElements.size,
      viewport: this.viewport,
    };
  }

  /**
   * Clears all registry data.
   *
   * Useful for starting fresh between test runs.
   */
  clear(): void {
    log.info("Clearing object registry");
    this.domElements.clear();
    this.canvasElements.clear();
    this.viewport = null;
    this.canvasOffset = { x: 0, y: 0 };
  }

  /**
   * Gets all registered object names for debugging.
   *
   * @returns Object containing all registered names by source
   */
  getAllObjectNames(): {
    dom: string[];
    canvas: string[];
  } {
    return {
      dom: Array.from(this.domElements.keys()),
      canvas: Array.from(this.canvasElements.keys()),
    };
  }
}
