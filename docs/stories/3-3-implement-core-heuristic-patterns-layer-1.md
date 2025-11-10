# Story 3-3: Implement Core Heuristic Patterns (Layer 1)

**Epic**: Epic 3 - Browser Automation & Interaction
**Status**: drafted
**Story ID**: 3-3-implement-core-heuristic-patterns-layer-1

## Story

As a Browser Agent, I want predefined heuristic patterns for common game types, so that basic interactions work without expensive LLM calls.

## Acceptance Criteria

1. ✅ Create `src/browser-agent/heuristics/coreHeuristics.ts`
2. ✅ Define PLATFORMER_HEURISTIC (click center, arrow keys, space for jump)
3. ✅ Define CLICKER_HEURISTIC (repeated clicks, wait, screenshot)
4. ✅ Define PUZZLE_HEURISTIC (click elements, observe changes)
5. ✅ Define GENERIC_HEURISTIC (try common inputs, detect response)
6. ✅ Each heuristic includes triggers, actions, confidence scoring
7. ✅ Heuristics return ActionResult with success/confidence
8. ✅ Unit tests cover all heuristic patterns

## Prerequisites

- Story 3-2: Integrate Stagehand for Browser Control (complete)

## Tasks

### Task 1: Define heuristic types and interfaces
- [ ] Create `src/browser-agent/heuristics/` directory
- [ ] Create types file for heuristic structures
- [ ] Define Action interface (type, target, value, delay)
- [ ] Define ActionResult interface (success, confidence, reasoning)
- [ ] Define Heuristic interface (name, triggers, actions, evaluate)

### Task 2: Implement PLATFORMER_HEURISTIC
- [ ] Define platformer triggers (canvas, arrow keys detected)
- [ ] Define platformer action sequence:
  - Click center of screen to focus
  - Try arrow keys (left, right, up, down)
  - Try space bar for jump
  - Wait between actions
- [ ] Implement confidence scoring based on response
- [ ] Add reasoning for action decisions

### Task 3: Implement CLICKER_HEURISTIC
- [ ] Define clicker triggers (incremental elements, upgrade buttons)
- [ ] Define clicker action sequence:
  - Repeated clicks on main clickable element
  - Wait for value changes
  - Capture screenshots between actions
  - Look for upgrade opportunities
- [ ] Implement confidence scoring
- [ ] Add reasoning

### Task 4: Implement PUZZLE_HEURISTIC
- [ ] Define puzzle triggers (grid, tiles, match elements)
- [ ] Define puzzle action sequence:
  - Click on various interactive elements
  - Observe DOM/visual changes
  - Try drag operations if applicable
  - Look for patterns in response
- [ ] Implement confidence scoring
- [ ] Add reasoning

### Task 5: Implement GENERIC_HEURISTIC
- [ ] Define generic triggers (fallback for unknown games)
- [ ] Define generic action sequence:
  - Try common keyboard inputs
  - Try mouse clicks in key areas
  - Detect any response or change
  - Adapt based on observations
- [ ] Implement confidence scoring
- [ ] Add reasoning

### Task 6: Create heuristic execution engine
- [ ] Implement executeHeuristic() function
- [ ] Takes page object and heuristic pattern
- [ ] Executes action sequence
- [ ] Collects evidence and feedback
- [ ] Returns ActionResult with confidence

### Task 7: Write comprehensive unit tests
- [ ] Test each heuristic pattern individually
- [ ] Mock Playwright page interactions
- [ ] Test confidence scoring logic
- [ ] Test action sequence execution
- [ ] Test error handling
- [ ] Achieve >90% coverage for heuristics module

## Dev Notes

### Technical Context

**Heuristic Strategy:**
- Layer 1 of the hybrid action strategy
- Fast, predefined patterns for common game types
- No LLM calls = cost-efficient and low latency
- Confidence scoring determines if escalation needed

**Integration Points:**
- Used by actionStrategy.ts (Story 3-5)
- Operates on Playwright Page from BrowserAgent
- Returns ActionResult for strategy decision-making

### Implementation Strategy

1. **Type Definitions:**
```typescript
// src/browser-agent/heuristics/types.ts
export interface Action {
  type: 'click' | 'keyboard' | 'wait' | 'screenshot';
  target?: string;  // Selector or coordinates
  value?: string;   // Key or text value
  delay?: number;   // Wait time in ms
}

export interface ActionResult {
  success: boolean;
  confidence: number;  // 0-100
  reasoning: string;
  actions: Action[];
}

export interface Heuristic {
  name: string;
  triggers: string[];  // Keywords/patterns that suggest this heuristic
  actions: Action[];
  evaluate: (page: Page, result: any) => Promise<ActionResult>;
}
```

2. **PLATFORMER_HEURISTIC Example:**
```typescript
export const PLATFORMER_HEURISTIC: Heuristic = {
  name: 'platformer',
  triggers: ['canvas', 'arrow keys', 'platformer', 'jump', 'run'],
  actions: [
    { type: 'click', target: 'center', delay: 500 },
    { type: 'keyboard', value: 'ArrowRight', delay: 1000 },
    { type: 'keyboard', value: 'Space', delay: 500 },
    { type: 'keyboard', value: 'ArrowLeft', delay: 1000 },
    { type: 'screenshot' },
  ],
  evaluate: async (page: Page, result: any): Promise<ActionResult> => {
    // Analyze if actions had effect
    // Check for visual changes, position updates, etc.
    // Return confidence score based on responsiveness
    return {
      success: true,
      confidence: 85,
      reasoning: 'Game responded to arrow keys and space bar',
      actions: PLATFORMER_HEURISTIC.actions,
    };
  },
};
```

3. **CLICKER_HEURISTIC Example:**
```typescript
export const CLICKER_HEURISTIC: Heuristic = {
  name: 'clicker',
  triggers: ['clicker', 'idle', 'incremental', 'upgrade', 'cookie'],
  actions: [
    { type: 'click', target: 'main-clickable', delay: 200 },
    { type: 'click', target: 'main-clickable', delay: 200 },
    { type: 'click', target: 'main-clickable', delay: 200 },
    { type: 'screenshot' },
    { type: 'wait', delay: 1000 },
    { type: 'click', target: 'upgrade-button', delay: 500 },
    { type: 'screenshot' },
  ],
  evaluate: async (page: Page, result: any): Promise<ActionResult> => {
    // Check if numbers increased
    // Look for upgrade buttons appearing
    return {
      success: true,
      confidence: 90,
      reasoning: 'Values increased with clicks, upgrades detected',
      actions: CLICKER_HEURISTIC.actions,
    };
  },
};
```

4. **PUZZLE_HEURISTIC Example:**
```typescript
export const PUZZLE_HEURISTIC: Heuristic = {
  name: 'puzzle',
  triggers: ['puzzle', 'match', 'grid', 'tile', 'swap'],
  actions: [
    { type: 'click', target: 'tile-1', delay: 500 },
    { type: 'click', target: 'tile-2', delay: 500 },
    { type: 'screenshot' },
    { type: 'wait', delay: 1000 },
    { type: 'click', target: 'tile-3', delay: 500 },
    { type: 'screenshot' },
  ],
  evaluate: async (page: Page, result: any): Promise<ActionResult> => {
    // Check if tiles moved or matched
    // Look for score changes
    return {
      success: true,
      confidence: 75,
      reasoning: 'Grid elements responded to clicks',
      actions: PUZZLE_HEURISTIC.actions,
    };
  },
};
```

5. **GENERIC_HEURISTIC Example:**
```typescript
export const GENERIC_HEURISTIC: Heuristic = {
  name: 'generic',
  triggers: ['*'],  // Matches any game
  actions: [
    { type: 'click', target: 'center', delay: 500 },
    { type: 'keyboard', value: 'Space', delay: 500 },
    { type: 'keyboard', value: 'Enter', delay: 500 },
    { type: 'screenshot' },
    { type: 'click', target: 'top-left', delay: 500 },
    { type: 'click', target: 'bottom-right', delay: 500 },
    { type: 'screenshot' },
  ],
  evaluate: async (page: Page, result: any): Promise<ActionResult> => {
    // Generic evaluation - look for any response
    return {
      success: true,
      confidence: 50,  // Lower confidence for generic
      reasoning: 'Attempted common interactions, observed response',
      actions: GENERIC_HEURISTIC.actions,
    };
  },
};
```

6. **Heuristic Execution Engine:**
```typescript
// src/browser-agent/heuristics/coreHeuristics.ts
import type { Page } from '@browserbasehq/stagehand/lib/types';
import { logger } from '@/utils/logger';

const log = logger.child({ component: 'CoreHeuristics' });

export async function executeHeuristic(
  page: Page,
  heuristic: Heuristic
): Promise<ActionResult> {
  log.info({ heuristic: heuristic.name }, 'Executing heuristic pattern');

  try {
    const results: any[] = [];

    for (const action of heuristic.actions) {
      switch (action.type) {
        case 'click':
          // Execute click action
          await executeClick(page, action);
          break;
        case 'keyboard':
          // Execute keyboard action
          await executeKeyboard(page, action);
          break;
        case 'wait':
          // Execute wait
          await new Promise(resolve => setTimeout(resolve, action.delay || 0));
          break;
        case 'screenshot':
          // Capture screenshot
          const screenshot = await page.screenshot();
          results.push({ type: 'screenshot', data: screenshot });
          break;
      }

      // Add delay between actions
      if (action.delay) {
        await new Promise(resolve => setTimeout(resolve, action.delay));
      }
    }

    // Evaluate results
    const result = await heuristic.evaluate(page, results);

    log.info(
      {
        heuristic: heuristic.name,
        confidence: result.confidence,
        success: result.success,
      },
      'Heuristic execution complete'
    );

    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error(
      { error: err.message, heuristic: heuristic.name },
      'Heuristic execution failed'
    );

    return {
      success: false,
      confidence: 0,
      reasoning: `Heuristic failed: ${err.message}`,
      actions: heuristic.actions,
    };
  }
}

async function executeClick(page: Page, action: Action): Promise<void> {
  if (action.target === 'center') {
    // Click center of viewport
    const viewport = page.viewportSize();
    await page.mouse.click(viewport.width / 2, viewport.height / 2);
  } else if (action.target) {
    // Click element by selector
    await page.click(action.target);
  }
}

async function executeKeyboard(page: Page, action: Action): Promise<void> {
  if (action.value) {
    await page.keyboard.press(action.value);
  }
}

// Export all heuristics
export const HEURISTICS = {
  PLATFORMER: PLATFORMER_HEURISTIC,
  CLICKER: CLICKER_HEURISTIC,
  PUZZLE: PUZZLE_HEURISTIC,
  GENERIC: GENERIC_HEURISTIC,
};
```

### Testing Strategy

**Mock Playwright Page:**
```typescript
const mockPage = {
  mouse: {
    click: vi.fn(),
  },
  keyboard: {
    press: vi.fn(),
  },
  click: vi.fn(),
  screenshot: vi.fn(),
  viewportSize: vi.fn().mockReturnValue({ width: 1024, height: 768 }),
};
```

**Test Cases:**
1. Each heuristic pattern executes correct action sequence
2. Confidence scoring logic for each pattern
3. Error handling during action execution
4. executeHeuristic() coordinates actions correctly
5. Click targeting (center, selector)
6. Keyboard input execution
7. Screenshot capture in sequence
8. Timing and delays between actions

### Dependencies

**Existing:**
- `@browserbasehq/stagehand/lib/types` - Page type
- `@/utils/logger` - Logging
- Story 3-2 - BrowserAgent with Stagehand integration

**New:**
- None - uses existing dependencies

## Definition of Done

- [ ] All heuristic types defined (Action, ActionResult, Heuristic)
- [ ] PLATFORMER_HEURISTIC implemented and tested
- [ ] CLICKER_HEURISTIC implemented and tested
- [ ] PUZZLE_HEURISTIC implemented and tested
- [ ] GENERIC_HEURISTIC implemented and tested
- [ ] executeHeuristic() function implemented
- [ ] Comprehensive unit tests (>90% coverage)
- [ ] All tests passing (no regressions)
- [ ] Code follows existing patterns

## Test Results

### Initial Tests
```
✓ All 30 tests passing
✓ 30 tests in coreHeuristics.test.ts
✓ Zero test failures in heuristics module
✓ Zero regressions in existing tests (255 total tests pass)

New Tests Added:
- PLATFORMER_HEURISTIC: 3 tests
  ✓ Correct name and triggers
  ✓ Action sequence with keyboard inputs
  ✓ High confidence scoring on success

- CLICKER_HEURISTIC: 4 tests
  ✓ Correct name and triggers
  ✓ Action sequence with repeated clicks
  ✓ High confidence with multiple screenshots
  ✓ Lower confidence with fewer screenshots

- PUZZLE_HEURISTIC: 3 tests
  ✓ Correct name and triggers
  ✓ Action sequence with varied clicks
  ✓ Moderate confidence scoring

- GENERIC_HEURISTIC: 3 tests
  ✓ Correct name and wildcard trigger
  ✓ Action sequence with mixed inputs
  ✓ Lower confidence than specific patterns

- executeHeuristic(): 13 tests
  ✓ Execute all actions in sequence
  ✓ Handle click with center target
  ✓ Handle click with offset target
  ✓ Handle click with negative offset
  ✓ Handle click with selector
  ✓ Fall back to center if selector fails
  ✓ Handle keyboard actions
  ✓ Handle wait actions
  ✓ Capture screenshots
  ✓ Respect action delays
  ✓ Continue execution if individual action fails
  ✓ Return low confidence on complete failure
  ✓ Call evaluate with collected results

- HEURISTICS collection: 4 tests
  ✓ Export all heuristic patterns
  ✓ Distinct names for all heuristics
  ✓ At least one action per heuristic
  ✓ At least one trigger per heuristic
```

## Implementation Notes

### Implementation Summary
Successfully implemented core heuristic patterns for Layer 1 of the hybrid action strategy:

**Key Features:**
1. **Type System**: Comprehensive type definitions for actions, results, and heuristics
2. **Four Heuristic Patterns**: Platformer, Clicker, Puzzle, and Generic fallback
3. **Execution Engine**: executeHeuristic() function with error handling and evidence collection
4. **Click Targeting**: Supports center, offset, and selector-based clicks with fallback
5. **Confidence Scoring**: Each heuristic evaluates success and returns 0-100 confidence
6. **Action Variety**: Click, keyboard, wait, and screenshot actions

**File Structure:**
```typescript
src/browser-agent/heuristics/
  types.ts            - Type definitions (Action, ActionResult, Heuristic)
  coreHeuristics.ts   - Implementation (230 lines, 4 heuristics)
  coreHeuristics.test.ts - Tests (30 tests, comprehensive coverage)
```

### Technical Decisions

1. **Heuristic Design Pattern**:
   - Each heuristic is self-contained with name, triggers, actions, evaluate
   - Evaluate function receives page and results for context-aware scoring
   - Actions are declarative - execution engine handles all interaction

2. **Click Targeting Strategy**:
   - `target: "center"` - Click viewport center (512, 384 for 1024x768)
   - `target: "offset:x,y"` - Click offset from center (e.g., "offset:100,-50")
   - `target: "#selector"` - Click element by CSS selector
   - Fallback to center if selector fails (graceful degradation)

3. **Confidence Scoring Philosophy**:
   - PLATFORMER: 85% (keyboard controls work for most platformers)
   - CLICKER: 90% (clicks always work for clickers)
   - PUZZLE: 75% (element interaction may need visual validation)
   - GENERIC: 50% (fallback pattern, recommend escalation)
   - Lower confidence triggers Layer 2 (vision analysis)

4. **Error Handling Strategy**:
   - Individual action failures don't stop execution
   - Collect all results even if some actions fail
   - Return low confidence (0) on complete failure
   - Never throw - always return ActionResult

5. **Action Delays**:
   - Each action can specify delay after execution
   - Wait actions default to 1000ms if not specified
   - Delays allow game state to update before next action

### Heuristic Patterns Detail

**PLATFORMER_HEURISTIC:**
- Triggers: "canvas", "platformer", "jump", "run", "side-scroll"
- Actions: Center click → ArrowRight → Space → ArrowLeft → ArrowUp → Screenshot
- Use case: Side-scrolling games, platform games, runner games
- Confidence: 85% (keyboard input reliable for this genre)

**CLICKER_HEURISTIC:**
- Triggers: "clicker", "idle", "incremental", "upgrade", "cookie", "tap"
- Actions: 3 clicks → Screenshot → Wait → 2 clicks → Screenshot
- Use case: Idle games, clicker games, incremental games
- Confidence: 90% (clicks produce visible changes)

**PUZZLE_HEURISTIC:**
- Triggers: "puzzle", "match", "grid", "tile", "swap", "candy", "jewel"
- Actions: Various clicks at different positions → Screenshots between
- Use case: Match-3, tile puzzles, grid-based games
- Confidence: 75% (moderate - visual analysis may be needed)

**GENERIC_HEURISTIC:**
- Triggers: "*" (wildcard - matches any game)
- Actions: Mix of clicks, keyboard (Space, Enter, Arrow), screenshots
- Use case: Unknown games, fallback pattern
- Confidence: 50% (lower - escalation recommended)

### Integration Points

**Used by (Story 3-5):**
- actionStrategy.ts will call executeHeuristic() as Layer 1
- If confidence > 80%, strategy considers heuristic sufficient
- If confidence < 80%, strategy escalates to Layer 2 (vision analysis)

**Operates on:**
- Playwright Page object from BrowserAgent (Story 3-2)
- No external API calls - fast and cost-free
- Evidence captured via screenshot action type

### Testing Strategy

**Mock Approach:**
- Mock Playwright Page with mouse, keyboard, click, screenshot, viewportSize
- All mocks return resolved promises for deterministic tests
- Test both success and failure scenarios

**Test Coverage:**
- Each heuristic pattern validated individually
- Execution engine tested with all action types
- Click targeting (center, offset, selector) verified
- Error handling and graceful degradation confirmed
- Confidence scoring logic validated
- Collection integrity (all 4 heuristics exported)

### Performance Characteristics

**Execution Time:**
- Platformer: ~4s (keyboard actions with delays)
- Clicker: ~3s (multiple clicks with pauses)
- Puzzle: ~3s (varied click positions)
- Generic: ~3s (mixed interactions)

**Cost:**
- $0.00 (no API calls)
- Pure browser automation via Playwright

**Scalability:**
- Heuristics are stateless and reusable
- Can execute multiple times without degradation
- No rate limits or quotas

### Files Created
- `src/browser-agent/heuristics/types.ts` - Type definitions (62 lines)
- `src/browser-agent/heuristics/coreHeuristics.ts` - Implementation (430 lines)
- `src/browser-agent/heuristics/coreHeuristics.test.ts` - Tests (545 lines, 30 tests)

### Next Steps
Story 3-4 will build Vision Analyzer for screenshot analysis (Layer 2), providing intelligent guidance when heuristics are uncertain.
