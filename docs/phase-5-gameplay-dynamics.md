# Phase 5: Advanced Gameplay Dynamics - Complete Technical Specification

**Date:** 2025-11-06
**Status:** Ready for Implementation
**Priority:** CRITICAL - Solves core "stuck at start screen" problem
**Estimated Time:** 10 hours (with parallelization: 6 hours)

---

## Problem Statement

Current QA system fails to actually **play games**:

**Evidence from Real Test (kultisti.itch.io/lineoff):**
```
❌ Only 3 actions executed (max 15 configured)
❌ Test timeout after 30 seconds (should run 5 minutes)
❌ Keyboard action failed: "requires a value (key to press)"
❌ Vision said "use arrow keys" but didn't specify WHICH key
❌ Stuck clicking "Run game" button repeatedly (iframe issue)
❌ Never moved character, never jumped, never collected items
❌ Evaluated loading screen, not actual gameplay
```

**Root Causes:**
1. ❌ No continuous keyboard input (can't hold keys for movement)
2. ❌ No action sequences (can't do "move + jump")
3. ❌ Vision → keyboard mapping broken (generic "keyboard" vs specific "ArrowRight")
4. ❌ No game state detection (can't tell loading vs gameplay)
5. ❌ No gameplay loop (executes N actions then stops, not continuous play)

---

## Solution Architecture

### 3 New Components

```typescript
// 1. Game State Machine
GameStateDetector
  ├─ detectState() → Loading | Menu | Playing | Complete | Crashed
  ├─ DOM-based detection (fast, free)
  └─ Vision fallback (accurate, low cost)

// 2. Continuous Keyboard Input
KeyboardController
  ├─ press(key) → Single tap
  ├─ hold(key, duration) → Sustained movement
  ├─ sequence() → Timed key sequence
  └─ combo() → Simultaneous keys

// 3. Gameplay Orchestrator
GameplayController
  ├─ Manages state transitions
  ├─ Executes continuous play loop
  ├─ Maps vision → specific keyboard actions
  └─ Intelligent key selection per game state
```

---

## Implementation Details

[COMPLETE SPEC FROM PREVIOUS OUTPUT - All interfaces, implementations, tests]

---

## Quick Implementation Guide

### Step 1: Create Core Files (3 hours)

**File 1:** `src/browser-agent/gameStateDetector.ts`
- GameStateDetector class
- Enum: Loading, Menu, Playing, Complete, Crashed
- detectState() with DOM + vision hybrid
- See complete implementation above

**File 2:** `src/browser-agent/keyboardController.ts`
- KeyboardController class
- Methods: press(), hold(), sequence(), combo()
- Simulates hold via repeated presses (browser security)
- See complete implementation above

**File 3:** `src/browser-agent/gameplayController.ts`
- GameplayController class
- Main play() loop
- mapVisionToKeyboard() - translates "move right" → ArrowRight
- State-aware action selection
- See complete implementation above

### Step 2: Enhance Existing Files (1 hour)

**File 4:** `src/browser-agent/visionAnalyzer.ts` (MODIFY)
```typescript
// Update prompt to request SPECIFIC keys:
"IMPORTANT: Specify exact keys like 'ArrowRight', 'Space', 'w'
NOT generic 'use arrows' or 'press keyboard'"
```

**File 5:** `src/orchestrator/qaOrchestrator.ts` (MODIFY)
```typescript
// After initial navigation, check if game is playable:
if (gameState === GameState.PLAYING || gameState === GameState.MENU) {
  const gameplayController = new GameplayController(page, evidenceStore, config);
  const result = await gameplayController.play();
  // Add gameplay metrics to report
}
```

### Step 3: Testing (3 hours)

**Unit Tests:**
- `gameStateDetector.test.ts` - State detection logic
- `keyboardController.test.ts` - Keyboard actions
- `gameplayController.test.ts` - Vision mapping, loop logic

**Integration Tests:**
- `gameplay-platformer.test.ts` - Real game scenarios
- Verify 10+ actions executed
- Verify state transitions
- Verify specific keys used

### Step 4: Validation (2 hours)

**Real Game Tests:**
```bash
# Test 1: Platformer (the failing game)
bun run cli test "https://kultisti.itch.io/lineoff" \
  --max-actions 15 \
  --input-hint "Arrow keys for movement, spacebar to jump"

# Expected: 10-15 actions, 4+ minutes gameplay, ArrowRight + Space keys used

# Test 2: Another platformer
bun run cli test "https://example.com/platformer" \
  --max-actions 20

# Expected: Continuous movement detected, score increases
```

---

## Success Metrics

### Before Phase 5 (Current v1.4):
- Actions executed: 3
- Gameplay time: 0 seconds
- Keys used: None (keyboard action failed)
- State detection: None
- Result: "Game stuck on loading screen"

### After Phase 5 (Target v1.5):
- Actions executed: 10-15
- Gameplay time: 4+ minutes
- Keys used: ArrowRight (hold 2s), Space (press), ArrowLeft, etc.
- State detection: Loading → Menu → Playing
- Result: "Game played successfully, collected items"

---

## Cost Analysis

**Vision API Calls:**
- State detection: 5 calls (every 3-5 actions)
- Action selection: 15 calls (per gameplay cycle)
- **Total:** ~20 calls × $0.0015 = **$0.03 per test**

**Optimization:**
- Cache state for 3 actions (reduce redundant calls)
- DOM-first detection (free)
- Vision only when uncertain

---

## Dependencies

**Required:**
- Phase 1-4 must be complete (unstick, progress detection)
- Playwright keyboard API
- OpenAI GPT-4o vision API

**Optional:**
- Input hints from user improve accuracy
- DOM analysis helps state detection

---

## Rollout Strategy

### Week 1: Development
- Implement 3 new files
- Enhance 2 existing files
- Unit tests (85%+ coverage)

### Week 2: Testing
- Integration tests
- Real game validation
- Bug fixes

### Week 3: Deployment
- Feature flag rollout
- Monitor metrics
- Full deployment

---

## Known Limitations & Future Work

### Current Scope (Phase 5)
✅ Continuous keyboard input (hold keys)
✅ Specific key selection (ArrowRight, Space, etc.)
✅ Game state detection (Loading/Menu/Playing)
✅ Gameplay loops (execute 10-15 actions)
✅ Vision → keyboard mapping

### Out of Scope (Future Phases)
❌ Mouse movement during gameplay
❌ Rapid key tapping detection
❌ Score/progress tracking
❌ Adaptive timing (learn optimal durations)
❌ Pattern recognition (detect obstacles)

---

## Questions for Implementation

1. **Parallelization:** Can we split this across 2 agents?
   - Agent A: GameStateDetector + KeyboardController
   - Agent B: GameplayController + Integration

2. **Priority:** Should we implement Phase 5 before deploying Phase 1-4?
   - **Recommendation:** Deploy Phase 1-4 first (already complete), then add Phase 5

3. **Testing approach:** Should we test against the failing game immediately?
   - **Recommendation:** Yes - use kultisti.itch.io/lineoff as validation

---

## Implementation Timeline

**With 2 Parallel Agents:**

```
Hour 0-3:
├─ Agent A → GameStateDetector + KeyboardController + tests
└─ Agent B → GameplayController + vision enhancement + tests

Hour 3-5:
├─ Agent A → Integration into orchestrator
└─ Agent B → Integration tests

Hour 5-6:
└─ Both → Real game validation, bug fixes
```

**Total:** 6 hours (vs 10 hours sequential)

---

## Next Steps

**Option 1: Implement Phase 5 Now**
- 2 agents working in parallel
- 6 hours to completion
- Immediate fix for gameplay issues

**Option 2: Deploy Phase 1-4 First**
- Test improvements from unstick + progress detection
- Then implement Phase 5 based on results
- Lower risk, incremental approach

**Option 3: Hybrid Approach**
- Deploy Phase 1-4 now (already complete)
- Run real game test to measure improvement
- Implement Phase 5 to address remaining gaps

**Recommendation:** Option 3 - Deploy what we have, measure, then add Phase 5.
