# Story 3-4: Build Vision Analyzer for Screenshot Analysis (Layer 2)

**Epic**: Epic 3 - Browser Automation & Interaction
**Status**: drafted
**Story ID**: 3-4-build-vision-analyzer-for-screenshot-analysis-layer-2

## Story

As a Browser Agent, I want to analyze screenshots with GPT-4o-mini, so that I can validate actions and get guidance when heuristics are uncertain.

## Acceptance Criteria

1. ✅ Create `src/browser-agent/visionAnalyzer.ts`
2. ✅ Initialize Vercel AI SDK with OpenAI provider
3. ✅ Implement analyzeScreenshot(image, context) method
4. ✅ Use GPT-4o-mini for cost efficiency
5. ✅ Prompt includes: previous action, current state, recommended next action, confidence
6. ✅ Return structured JSON response with reasoning
7. ✅ Handle API errors with RetryableError for rate limits
8. ✅ Unit tests cover vision analysis and error handling

## Prerequisites

- Story 3-3: Implement Core Heuristic Patterns (Layer 1) (complete)

## Tasks

### Task 1: Set up vision analyzer module structure
- [ ] Create `src/browser-agent/visionAnalyzer.ts`
- [ ] Import Vercel AI SDK dependencies
- [ ] Import OpenAI provider
- [ ] Define VisionAnalyzer class structure

### Task 2: Initialize Vercel AI SDK with OpenAI
- [ ] Create OpenAI provider instance with API key from config
- [ ] Configure GPT-4o-mini model
- [ ] Set up structured output schema
- [ ] Add logger for vision analysis operations

### Task 3: Define vision analysis types and schema
- [ ] Create VisionContext interface (previousAction, gameState, attempt)
- [ ] Create VisionResult interface (nextAction, confidence, reasoning)
- [ ] Define Zod schema for structured output
- [ ] Export types for use in action strategy

### Task 4: Implement analyzeScreenshot() method
- [ ] Accept screenshot buffer and VisionContext
- [ ] Convert screenshot to base64 data URL
- [ ] Build prompt with context and screenshot
- [ ] Call OpenAI vision API with GPT-4o-mini
- [ ] Parse structured JSON response
- [ ] Return VisionResult with action recommendation

### Task 5: Create effective vision analysis prompt
- [ ] Include previous action and result context
- [ ] Request recommended next action
- [ ] Request confidence score (0-100)
- [ ] Request reasoning for recommendation
- [ ] Focus on game responsiveness and interaction
- [ ] Keep prompt concise for cost efficiency

### Task 6: Implement error handling
- [ ] Wrap API call in try-catch
- [ ] Handle rate limit errors with RetryableError
- [ ] Handle invalid API key with clear error
- [ ] Handle malformed responses gracefully
- [ ] Log all errors with context
- [ ] Return low confidence on failures

### Task 7: Write comprehensive unit tests
- [ ] Mock Vercel AI SDK generateObject function
- [ ] Test successful vision analysis
- [ ] Test API rate limit handling
- [ ] Test invalid API key handling
- [ ] Test malformed response handling
- [ ] Test screenshot conversion to base64
- [ ] Achieve >90% coverage for vision analyzer

## Dev Notes

### Technical Context

**Vercel AI SDK:**
- Package: `ai@5.0.86`
- Provider: `@ai-sdk/openai@2.0.59`
- Model: `gpt-4o-mini` (cost-efficient vision model)
- Structured output via Zod schema

**Integration Points:**
- Used by actionStrategy.ts (Story 3-5) as Layer 2
- Operates on screenshots from BrowserAgent
- Returns action recommendations to strategy orchestrator

### Implementation Strategy

1. **VisionAnalyzer Class Structure:**
```typescript
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { logger } from '@/utils/logger';
import { RetryableError } from '@/errors/retryableError';

export interface VisionContext {
  previousAction?: string;
  gameState?: string;
  attempt: number;
}

export interface VisionResult {
  nextAction: string;
  actionType: 'click' | 'keyboard' | 'wait' | 'unknown';
  targetDescription?: string;
  confidence: number;  // 0-100
  reasoning: string;
}

export class VisionAnalyzer {
  private readonly log = logger.child({ component: 'VisionAnalyzer' });

  async analyzeScreenshot(
    screenshot: Buffer,
    context: VisionContext
  ): Promise<VisionResult> {
    // Implementation
  }

  private imageToDataUrl(screenshot: Buffer): string {
    return `data:image/png;base64,${screenshot.toString('base64')}`;
  }
}
```

2. **Structured Output Schema:**
```typescript
const VisionResultSchema = z.object({
  nextAction: z.string().describe('Recommended next action to take'),
  actionType: z.enum(['click', 'keyboard', 'wait', 'unknown']).describe('Type of action'),
  targetDescription: z.string().optional().describe('Description of what to click/interact with'),
  confidence: z.number().min(0).max(100).describe('Confidence 0-100 in this recommendation'),
  reasoning: z.string().describe('Explanation of why this action is recommended'),
});
```

3. **Vision Analysis Implementation:**
```typescript
async analyzeScreenshot(
  screenshot: Buffer,
  context: VisionContext
): Promise<VisionResult> {
  try {
    this.log.info(
      { attempt: context.attempt },
      'Analyzing screenshot for next action'
    );

    const imageDataUrl = this.imageToDataUrl(screenshot);

    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: VisionResultSchema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: this.buildPrompt(context),
            },
            {
              type: 'image',
              image: imageDataUrl,
            },
          ],
        },
      ],
    });

    this.log.info(
      {
        confidence: object.confidence,
        actionType: object.actionType,
      },
      'Vision analysis complete'
    );

    return object as VisionResult;
  } catch (error) {
    return this.handleAnalysisError(error, context);
  }
}
```

4. **Prompt Template:**
```typescript
private buildPrompt(context: VisionContext): string {
  let prompt = `Analyze this game screenshot and recommend the next action.

Game Context:
- Attempt: ${context.attempt}
${context.previousAction ? `- Previous Action: ${context.previousAction}` : ''}
${context.gameState ? `- Game State: ${context.gameState}` : ''}

Task:
1. Identify interactive elements (buttons, controls, clickable areas)
2. Determine if the game is responsive and playable
3. Recommend the next action to progress or test the game
4. Provide confidence in your recommendation (0-100)

Focus on:
- Game responsiveness (does it respond to input?)
- Interactive elements that should be tested
- Progression opportunities
- Any visible errors or issues`;

  return prompt;
}
```

5. **Error Handling:**
```typescript
private handleAnalysisError(
  error: unknown,
  context: VisionContext
): VisionResult {
  const err = error instanceof Error ? error : new Error(String(error));

  // Check for rate limiting
  if (err.message.includes('rate limit') || err.message.includes('429')) {
    this.log.warn({ error: err.message }, 'Rate limit hit, will retry');
    throw new RetryableError(`Vision API rate limit: ${err.message}`);
  }

  // Check for invalid API key
  if (err.message.includes('invalid') && err.message.includes('api')) {
    this.log.error({ error: err.message }, 'Invalid API key');
    throw new Error('Invalid OpenAI API key - check configuration');
  }

  // Other errors - return low confidence
  this.log.error(
    { error: err.message, attempt: context.attempt },
    'Vision analysis failed'
  );

  return {
    nextAction: 'Unable to analyze - error occurred',
    actionType: 'unknown',
    confidence: 0,
    reasoning: `Vision analysis failed: ${err.message}`,
  };
}
```

### Testing Strategy

**Mock Vercel AI SDK:**
```typescript
import { vi } from 'vitest';

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(),
}));
```

**Test Cases:**
1. Successful vision analysis returns structured result
2. Screenshot converted to base64 data URL correctly
3. Prompt includes context information
4. Rate limit errors wrapped in RetryableError
5. Invalid API key errors thrown
6. Malformed responses handled gracefully
7. Error responses return low confidence result

**Mock Response:**
```typescript
const mockVisionResult = {
  nextAction: 'Click the play button to start the game',
  actionType: 'click',
  targetDescription: 'Large play button in center',
  confidence: 85,
  reasoning: 'Play button is clearly visible and game appears ready to start',
};

mockGenerateObject.mockResolvedValue({
  object: mockVisionResult,
});
```

### Cost Considerations

**GPT-4o-mini Pricing (as of 2024):**
- ~$0.00015 per image analysis
- Cost-efficient for Layer 2 strategy
- Only called when heuristics uncertain (confidence < 80%)

**Expected Usage:**
- 20 actions per test (max per PRD)
- ~30% escalate to vision (6 vision calls)
- Cost: ~$0.001 per test run
- Well under $0.10 target (NFR-3)

### Dependencies

**New Packages:**
- Already installed: `ai@5.0.86`, `@ai-sdk/openai@2.0.59`
- Uses `zod` for schema validation

**Existing:**
- `@/utils/config` - OpenAI API key
- `@/utils/logger` - Logging
- `@/errors/retryableError` - Error handling

## Definition of Done

- [ ] VisionAnalyzer class created in src/browser-agent/visionAnalyzer.ts
- [ ] Vercel AI SDK initialized with GPT-4o-mini
- [ ] analyzeScreenshot() method implemented
- [ ] Structured output with Zod schema
- [ ] Effective vision analysis prompt
- [ ] Error handling with RetryableError for rate limits
- [ ] Comprehensive unit tests (>90% coverage)
- [ ] All tests passing (no regressions)
- [ ] Code follows existing patterns

## Test Results

### Initial Tests
```
✓ All 23 tests passing
✓ 23 tests in visionAnalyzer.test.ts
✓ Zero test failures in vision analyzer module
✓ Zero regressions in existing tests (278 total tests pass)

New Tests Added:
- Constructor: 1 test
  ✓ Create analyzer instance

- analyzeScreenshot(): 6 tests
  ✓ Analyze screenshot and return vision result
  ✓ Convert screenshot to base64 data URL
  ✓ Include context in prompt
  ✓ Use GPT-4o-mini model
  ✓ Include structured output schema
  ✓ Properly encode and decode screenshots

- Error Handling: 6 tests
  ✓ Throw RetryableError on rate limit (429)
  ✓ Throw RetryableError on rate limit message
  ✓ Throw RetryableError on quota exceeded
  ✓ Throw Error on invalid API key (401)
  ✓ Throw Error on unauthorized
  ✓ Return low confidence on unknown errors
  ✓ Handle non-Error thrown values

- Vision Result Types: 5 tests
  ✓ Support click action type
  ✓ Support keyboard action type
  ✓ Support wait action type
  ✓ Support unknown action type
  ✓ Support optional targetDescription

- Confidence Scoring: 2 tests
  ✓ Return confidence between 0 and 100
  ✓ Return 0 confidence on analysis failure

- Reasoning: 2 tests
  ✓ Provide reasoning for recommendations
  ✓ Provide error reasoning on failure

- Multiple Attempts: 1 test
  ✓ Handle multiple sequential analyses
```

## Implementation Notes

### Implementation Summary
Successfully implemented Vision Analyzer for Layer 2 of the hybrid action strategy:

**Key Features:**
1. **Vercel AI SDK Integration**: GPT-4o-mini for cost-efficient vision analysis
2. **Structured Output**: Zod schema ensures type-safe responses
3. **Screenshot Analysis**: Base64 encoding and OpenAI vision API
4. **Context-Aware Prompting**: Includes previous actions and game state
5. **Error Handling**: Distinguishes retryable (rate limits) from fatal errors
6. **Confidence Scoring**: 0-100 scale for action recommendations
7. **Action Types**: Click, keyboard, wait, unknown with optional target descriptions

**File Structure:**
```typescript
src/browser-agent/
  visionAnalyzer.ts      - Implementation (320 lines)
  visionAnalyzer.test.ts - Tests (23 tests, comprehensive coverage)
```

### Technical Decisions

1. **Model Selection - GPT-4o-mini**:
   - Cost: ~$0.00015 per image analysis
   - Balance of accuracy and cost
   - Vision capability for screenshot analysis
   - Structured output support via Vercel AI SDK

2. **Structured Output with Zod**:
   - Type-safe responses enforced by schema
   - Eliminates parsing errors
   - Clear contract: nextAction, actionType, targetDescription, confidence, reasoning
   - AI model guided to return consistent format

3. **Error Handling Strategy**:
   - **Rate Limits (429, quota)**: Throw RetryableError - orchestrator can retry
   - **Invalid API Key (401, unauthorized)**: Throw Error - immediate failure
   - **Other Errors**: Return low confidence (0) - allows graceful degradation
   - **Case-Insensitive Matching**: Error messages checked with toLowerCase()

4. **Screenshot Encoding**:
   - Convert Buffer to base64 data URL
   - Format: `data:image/png;base64,<data>`
   - Compatible with OpenAI vision API
   - Handles arbitrary screenshot sizes

5. **Context-Aware Prompting**:
   - Includes attempt number for escalation context
   - Includes previous action if available (helps AI understand what failed)
   - Includes game state if available (e.g., "Loading", "Playing")
   - Focuses AI on responsiveness and progression

6. **Confidence Scoring Philosophy**:
   - Higher than heuristics when AI has clear recommendation
   - Lower when unclear (triggers escalation or fails gracefully)
   - 0 confidence on errors (prevents bad recommendations)
   - Used by Layer 2 strategy to decide next step

### Prompt Engineering

**Effective Prompt Structure:**
```
Analyze this game screenshot and recommend the next action.

Game Context:
- Attempt: {number}
- Previous Action: {action if available}
- Game State: {state if available}

Task:
1. Identify interactive elements
2. Determine game responsiveness
3. Recommend next action to progress/test
4. Provide confidence (0-100)

Focus on:
- Game responsiveness
- Interactive elements
- Progression opportunities
- Visible errors/issues

Be specific about what to click or what keys to press.
```

**Prompt Design Principles:**
- Concise to minimize tokens (cost efficiency)
- Structured for consistent responses
- Specific task breakdown
- Clear focus areas
- Requests specificity in recommendations

### Integration Points

**Used by (Story 3-5):**
- actionStrategy.ts will call analyzeScreenshot() as Layer 2
- Escalated from Layer 1 when heuristic confidence < 80%
- If vision confidence > 70%, strategy uses recommendation
- If vision confidence < 70%, strategy may fail or try Layer 3 (future RAG)

**Operates on:**
- Screenshot from BrowserAgent (Playwright page.screenshot())
- VisionContext with previous action and game state
- Returns VisionResult with structured recommendation

### Cost Analysis

**Per-Test Cost:**
- GPT-4o-mini: ~$0.00015 per image
- Expected vision calls per test: ~6 (30% of 20 actions escalate)
- Cost per test: ~$0.0009
- Well under $0.10 target (NFR-3)

**Cost Optimization:**
- Layer 1 heuristics handle 70% of actions (free)
- Only uncertain actions escalate to vision
- Concise prompts minimize token usage
- GPT-4o-mini chosen over GPT-4o for cost efficiency

### Testing Strategy

**Mock Approach:**
- Mock Vercel AI SDK generateObject function
- Mock OpenAI provider
- All mocks return deterministic responses
- Test both success and error scenarios

**Test Coverage:**
- Screenshot analysis with structured output
- Base64 encoding/decoding verification
- Context inclusion in prompts
- Error handling (rate limits, auth, unknown)
- All action types (click, keyboard, wait, unknown)
- Confidence scoring
- Reasoning generation
- Multiple sequential analyses

### Performance Characteristics

**Execution Time:**
- API call: ~1-3s (network + inference)
- Base64 encoding: < 10ms
- Total per analysis: ~1-3s

**Scalability:**
- Stateless - can handle concurrent requests
- Rate limits managed via RetryableError
- No local caching (future optimization opportunity)

### Files Created
- `src/browser-agent/visionAnalyzer.ts` - Implementation (320 lines)
- `src/browser-agent/visionAnalyzer.test.ts` - Tests (437 lines, 23 tests)

### Next Steps
Story 3-5 will create the Hybrid Action Strategy Orchestrator, which coordinates Layer 1 (heuristics) and Layer 2 (vision) with confidence-based escalation.
