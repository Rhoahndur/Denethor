# Story 3-5: Create Hybrid Action Strategy Orchestrator

**Epic**: Epic 3 - Browser Automation & Interaction
**Status**: drafted
**Story ID**: 3-5-create-hybrid-action-strategy-orchestrator

## Story

As a Browser Agent, I want to orchestrate the 3-layer action strategy, so that actions escalate from fast heuristics to intelligent vision analysis.

## Acceptance Criteria

1. ✅ Create `src/browser-agent/actionStrategy.ts`
2. ✅ Implement executeHybridStrategy(page, context) method
3. ✅ Layer 1: Try heuristics first, return if confidence > 80%
4. ✅ Layer 2: Use vision analysis if heuristic uncertain, return if confidence > 70%
5. ✅ Layer 3: Placeholder for RAG (stretch goal - not implemented in MVP)
6. ✅ Throw GameCrashError if all layers uncertain
7. ✅ Log strategy decisions (which layer used, confidence)
8. ✅ Unit tests cover escalation logic and confidence thresholds

## Prerequisites

- Story 3-3: Implement Core Heuristic Patterns (Layer 1) (complete)
- Story 3-4: Build Vision Analyzer for Screenshot Analysis (Layer 2) (complete)

## Tasks

### Task 1: Create action strategy module structure
- [ ] Create `src/browser-agent/actionStrategy.ts`
- [ ] Import heuristics from Layer 1
- [ ] Import VisionAnalyzer from Layer 2
- [ ] Define StrategyContext interface
- [ ] Define StrategyResult interface

### Task 2: Implement Layer 1 - Heuristic Execution
- [ ] Define selectHeuristic() to choose appropriate pattern
- [ ] Execute selected heuristic
- [ ] Check confidence threshold (> 80%)
- [ ] Return result if confident
- [ ] Escalate to Layer 2 if uncertain

### Task 3: Implement Layer 2 - Vision Analysis
- [ ] Capture screenshot if escalated from Layer 1
- [ ] Call VisionAnalyzer.analyzeScreenshot()
- [ ] Check confidence threshold (> 70%)
- [ ] Return result if confident
- [ ] Escalate to Layer 3 if uncertain

### Task 4: Implement Layer 3 Placeholder
- [ ] Add placeholder for RAG layer (future)
- [ ] Document RAG strategy for stretch goal
- [ ] Throw GameCrashError if Layer 2 fails

### Task 5: Implement executeHybridStrategy() orchestration
- [ ] Accept page and strategy context
- [ ] Execute layers in sequence: 1 → 2 → 3
- [ ] Track which layer succeeded
- [ ] Log strategy decisions and confidence
- [ ] Return StrategyResult with action and metadata

### Task 6: Add error handling
- [ ] Handle heuristic failures gracefully
- [ ] Handle vision API failures (retry via RetryableError)
- [ ] Throw GameCrashError when all layers fail
- [ ] Log all escalation decisions

### Task 7: Write comprehensive unit tests
- [ ] Mock heuristics execution
- [ ] Mock vision analyzer
- [ ] Test Layer 1 success (no escalation)
- [ ] Test Layer 1 → Layer 2 escalation
- [ ] Test Layer 2 → Layer 3 escalation (throws GameCrashError)
- [ ] Test confidence thresholds (80%, 70%)
- [ ] Test error handling
- [ ] Achieve >90% coverage for action strategy

## Dev Notes

### Technical Context

**Hybrid Strategy:**
- 3-layer approach to action selection
- Each layer more intelligent but more expensive
- Confidence-based escalation between layers
- Novel pattern for cost-efficient automation

**Integration Points:**
- Uses executeHeuristic() from coreHeuristics.ts
- Uses analyzeScreenshot() from visionAnalyzer.ts
- Used by BrowserAgent for action decisions (Story 3-6)

### Implementation Strategy

1. **Type Definitions:**
```typescript
export interface StrategyContext {
  gameType?: string;        // Detected game type for heuristic selection
  previousAction?: string;  // Previous action taken
  gameState?: string;       // Current game state
  attempt: number;          // Attempt number
}

export interface StrategyResult {
  layer: 1 | 2 | 3;          // Which layer provided the result
  action: string;            // Action description
  actionType: 'click' | 'keyboard' | 'wait' | 'unknown';
  target?: string;           // Target for action (selector, coordinates, key)
  confidence: number;        // Final confidence score (0-100)
  reasoning: string;         // Why this action was chosen
}
```

2. **Heuristic Selection:**
```typescript
function selectHeuristic(gameType?: string): Heuristic {
  switch (gameType?.toLowerCase()) {
    case 'platformer':
      return HEURISTICS.PLATFORMER;
    case 'clicker':
      return HEURISTICS.CLICKER;
    case 'puzzle':
      return HEURISTICS.PUZZLE;
    default:
      return HEURISTICS.GENERIC;
  }
}
```

3. **executeHybridStrategy Implementation:**
```typescript
export async function executeHybridStrategy(
  page: Page,
  context: StrategyContext
): Promise<StrategyResult> {
  const log = logger.child({ component: 'ActionStrategy' });

  // Layer 1: Heuristics (fast, free)
  log.info({ attempt: context.attempt }, 'Starting Layer 1: Heuristics');

  try {
    const heuristic = selectHeuristic(context.gameType);
    const heuristicResult = await executeHeuristic(page, heuristic);

    if (heuristicResult.confidence > 80) {
      log.info(
        { confidence: heuristicResult.confidence, layer: 1 },
        'Layer 1 succeeded with high confidence'
      );

      return {
        layer: 1,
        action: heuristicResult.actions[0]?.type || 'unknown',
        actionType: heuristicResult.actions[0]?.type || 'unknown',
        target: heuristicResult.actions[0]?.target,
        confidence: heuristicResult.confidence,
        reasoning: heuristicResult.reasoning,
      };
    }

    log.info(
      { confidence: heuristicResult.confidence },
      'Layer 1 uncertain, escalating to Layer 2'
    );
  } catch (error) {
    log.warn({ error }, 'Layer 1 failed, escalating to Layer 2');
  }

  // Layer 2: Vision Analysis (intelligent, low cost)
  log.info({ attempt: context.attempt }, 'Starting Layer 2: Vision Analysis');

  try {
    const screenshot = await page.screenshot();
    const visionAnalyzer = new VisionAnalyzer();

    const visionResult = await visionAnalyzer.analyzeScreenshot(screenshot, {
      previousAction: context.previousAction,
      gameState: context.gameState,
      attempt: context.attempt,
    });

    if (visionResult.confidence > 70) {
      log.info(
        { confidence: visionResult.confidence, layer: 2 },
        'Layer 2 succeeded with high confidence'
      );

      return {
        layer: 2,
        action: visionResult.nextAction,
        actionType: visionResult.actionType,
        target: visionResult.targetDescription,
        confidence: visionResult.confidence,
        reasoning: visionResult.reasoning,
      };
    }

    log.warn(
      { confidence: visionResult.confidence },
      'Layer 2 uncertain, no Layer 3 available'
    );
  } catch (error) {
    log.error({ error }, 'Layer 2 failed');
  }

  // Layer 3: RAG (future stretch goal)
  log.error('All layers failed or uncertain, game may have crashed');
  throw new GameCrashError(
    'Unable to determine next action - game may be unresponsive'
  );
}
```

4. **Logging Strategy:**
```typescript
// Log each layer attempt
log.info({ layer: 1 }, 'Trying Layer 1: Heuristics');
log.info({ layer: 2 }, 'Trying Layer 2: Vision Analysis');

// Log confidence decisions
log.info({ confidence, threshold: 80 }, 'Layer 1 confidence check');
log.info({ confidence, threshold: 70 }, 'Layer 2 confidence check');

// Log escalation decisions
log.info('Escalating from Layer 1 to Layer 2');
log.warn('Layer 2 failed, no fallback available');

// Log final result
log.info({ layer, confidence }, 'Strategy completed successfully');
```

### Testing Strategy

**Mock Layer Dependencies:**
```typescript
import { vi } from 'vitest';

// Mock heuristics
vi.mock('./heuristics/coreHeuristics', () => ({
  executeHeuristic: vi.fn(),
  HEURISTICS: {
    PLATFORMER: { name: 'platformer' },
    CLICKER: { name: 'clicker' },
    PUZZLE: { name: 'puzzle' },
    GENERIC: { name: 'generic' },
  },
}));

// Mock vision analyzer
vi.mock('./visionAnalyzer', () => ({
  VisionAnalyzer: vi.fn().mockImplementation(() => ({
    analyzeScreenshot: vi.fn(),
  })),
}));

// Mock GameCrashError
vi.mock('@/errors/gameCrashError');
```

**Test Cases:**
1. Layer 1 high confidence (> 80%) - returns immediately
2. Layer 1 medium confidence (< 80%) - escalates to Layer 2
3. Layer 1 fails - escalates to Layer 2
4. Layer 2 high confidence (> 70%) - returns
5. Layer 2 low confidence (< 70%) - throws GameCrashError
6. Layer 2 fails - throws GameCrashError
7. Heuristic selection based on game type
8. Confidence thresholds exactly at boundaries (80, 70)
9. Context passed correctly to each layer
10. Logging includes layer and confidence info

### Confidence Threshold Rationale

**Layer 1 → Layer 2 Threshold: 80%**
- Heuristics are fast and free
- Only escalate when genuinely uncertain
- 80% confidence means heuristic pattern matched well

**Layer 2 → Layer 3 Threshold: 70%**
- Vision analysis is more expensive
- Lower bar for acceptance
- 70% confidence from AI is reasonably reliable
- Layer 3 (RAG) would be even more expensive

**Why Different Thresholds:**
- Lower thresholds as cost increases
- Balances accuracy vs. cost
- Prevents unnecessary escalation
- Aligns with cost target (NFR-3: <$0.10/test)

### Dependencies

**Existing:**
- `@/browser-agent/heuristics/coreHeuristics` - Layer 1
- `@/browser-agent/visionAnalyzer` - Layer 2
- `@/errors/gameCrashError` - Error signaling
- `@/utils/logger` - Logging
- `@browserbasehq/stagehand/lib/types` - Page type

**New:**
- None - uses existing dependencies

## Definition of Done

- [ ] actionStrategy.ts created with executeHybridStrategy()
- [ ] Layer 1 execution with 80% confidence threshold
- [ ] Layer 2 escalation with 70% confidence threshold
- [ ] Layer 3 placeholder (throws GameCrashError)
- [ ] Heuristic selection based on game type
- [ ] Comprehensive logging of decisions
- [ ] Error handling for all layers
- [ ] Comprehensive unit tests (>90% coverage)
- [ ] All tests passing (no regressions)
- [ ] Code follows existing patterns

## Test Results

### Initial Tests
```
# To be filled during implementation
```

## Implementation Notes

```
# Notes added during implementation
```
