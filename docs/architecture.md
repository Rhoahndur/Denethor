# Architecture

## Executive Summary

The Denethor system is an autonomous AI agent that tests browser-based games through intelligent automation. The architecture follows a **layered hybrid strategy** combining deterministic heuristics for speed, AI vision analysis for adaptation, and optional RAG augmentation for continuous learning. Built on Bun with TypeScript, the system prioritizes performance (< 5 min per test), cost efficiency (< $0.10 per test), and reliability (99%+ test completion) while maintaining extensibility for future enhancements.

## Project Initialization

This project was initialized using Bun's official starter:

```bash
bun init -y
```

This command established:
- TypeScript 5.9.3 with strict mode enabled
- ESNext module system with native ESM
- Bun runtime configuration
- Basic project structure (package.json, tsconfig.json, index.ts)

**First implementation story:** The project has been initialized with these base configurations. Subsequent stories will build upon this foundation.

## Decision Summary

| Category | Decision | Version | Affects Epics | Rationale |
| -------- | -------- | ------- | ------------- | --------- |
| **Runtime** | Bun | Latest | All epics | Fast TypeScript execution, native .env support, Lambda compatible |
| **Language** | TypeScript | 5.9.3 | All epics | Type safety, better tooling, team preference (from PRD) |
| **Testing Framework** | Vitest | 4.0 | All epics | Fast, modern, excellent TypeScript support, Bun-compatible |
| **Code Quality** | Biome | 2.3.2 | All epics | 100x faster than ESLint+Prettier, all-in-one linting and formatting |
| **Environment Variables** | Bun native .env | Built-in | All epics | Zero config, automatic loading, works for local dev and Lambda |
| **Browser Automation** | @browserbasehq/sdk | 2.6.0 | Browser Agent, Orchestrator | Cloud browsers for Lambda, reliable headless execution |
| **Browser AI Framework** | @browserbasehq/stagehand | 2.5.0 | Browser Agent, Hybrid Strategy | AI-powered browser automation, vision-guided navigation |
| **AI Framework** | ai (Vercel AI SDK) | 5.0.86 | AI Evaluator | Unified LLM interface, streaming support, provider abstraction |
| **AI Provider** | @ai-sdk/openai | 2.0.59 | AI Evaluator | GPT-4o/GPT-4o-mini for vision analysis, cost-effective |
| **CLI Framework** | commander | 14.0.2 | CLI Integration | Industry standard, auto-help generation, TypeScript support |
| **Logging** | pino | 10.1.0 | All epics | Extremely fast structured JSON logging, low overhead |
| **Report Generation** | Custom functions | None | Report Generator | Zero dependencies, full control, simple structure fits use case |
| **Date/Time** | Native Date | Built-in | All epics | ISO 8601 format, zero dependencies, Lambda-compatible |

## Project Structure

```
Denethor/
├── src/
│   ├── orchestrator/
│   │   ├── qaOrchestrator.ts          # Main orchestrator class
│   │   ├── qaOrchestrator.test.ts     # Orchestrator tests
│   │   └── types.ts                    # Orchestrator-specific types
│   │
│   ├── browser-agent/
│   │   ├── browserAgent.ts             # Stagehand integration
│   │   ├── browserAgent.test.ts        # Browser agent tests
│   │   ├── actionStrategy.ts           # Hybrid action strategy
│   │   ├── heuristics/
│   │   │   └── coreHeuristics.ts      # Initial heuristic patterns
│   │   ├── visionAnalyzer.ts          # GPT-4o-mini vision analysis
│   │   ├── ragProvider.ts             # RAG interface (STRETCH)
│   │   └── types.ts                    # Browser agent types
│   │
│   ├── ai-evaluator/
│   │   ├── aiEvaluator.ts              # OpenAI evaluation logic
│   │   ├── aiEvaluator.test.ts         # Evaluator tests
│   │   ├── prompts.ts                  # LLM prompts
│   │   └── types.ts                    # Evaluator types
│   │
│   ├── evidence-store/
│   │   ├── evidenceStore.ts            # Screenshot & log capture
│   │   ├── evidenceStore.test.ts       # Evidence tests
│   │   └── types.ts                    # Evidence types
│   │
│   ├── report-generator/
│   │   ├── reportGenerator.ts          # Multi-format reports
│   │   ├── reportGenerator.test.ts     # Generator tests
│   │   ├── htmlGenerator.ts            # HTML report builder
│   │   ├── markdownGenerator.ts        # Markdown report builder
│   │   └── types.ts                    # Report types
│   │
│   ├── errors/
│   │   ├── QAError.ts                  # Base error class
│   │   ├── RetryableError.ts           # Network/timeout errors
│   │   ├── GameCrashError.ts           # Game crash errors
│   │   └── ValidationError.ts          # Input validation errors
│   │
│   ├── utils/
│   │   ├── config.ts                   # Centralized env config
│   │   ├── logger.ts                   # Pino logger setup
│   │   ├── retry.ts                    # Retry with backoff logic
│   │   ├── dateUtils.ts                # Date formatting helpers
│   │   └── fileUtils.ts                # File system helpers
│   │
│   └── types/
│       ├── qaReport.ts                 # QAReport interface
│       ├── config.ts                   # Configuration types
│       └── index.ts                    # Export all shared types
│
├── cli/
│   ├── index.ts                        # CLI entry point (Commander.js)
│   └── commands.ts                     # Command implementations
│
├── output/                             # Test results (gitignored)
│   └── test-{uuid}-{timestamp}/
│       ├── metadata.json
│       ├── screenshots/
│       │   ├── 00-initial-load.png
│       │   ├── 01-start-button-click.png
│       │   └── ...
│       ├── logs/
│       │   ├── console.log
│       │   ├── actions.log
│       │   └── errors.log
│       └── reports/
│           ├── report.json
│           ├── report.md
│           └── report.html
│
├── tests/                              # Integration tests
│   ├── integration/
│   │   └── e2e.test.ts                # End-to-end tests
│   └── fixtures/
│       └── sample-games/               # Test game URLs
│
├── .env                                # Environment variables (gitignored)
├── .env.example                        # Example env file
├── .gitignore                          # Git ignore rules
├── biome.json                          # Biome config
├── vitest.config.ts                    # Vitest config
├── tsconfig.json                       # TypeScript config
├── package.json                        # Dependencies
├── bun.lock                            # Lock file
├── README.md                           # Setup and usage docs
├── index.ts                            # Programmatic API entry point
└── docs/
    ├── architecture.md                 # This document
    └── PRD.md                          # Product requirements
```

## Epic to Architecture Mapping

| Epic | Primary Components | Location | Implementation Notes |
|------|-------------------|----------|---------------------|
| **FR-1: Game Loading** | Browser Agent, Orchestrator | `src/browser-agent/`, `src/orchestrator/` | Browserbase session management, retry with exponential backoff (3x max), 60s timeout |
| **FR-2: Interaction Simulation** | Hybrid Action Strategy | `src/browser-agent/actionStrategy.ts`, `src/browser-agent/heuristics/` | Three-layer strategy: heuristics → vision → RAG (optional) |
| **FR-3: Error Detection & Handling** | Browser Agent, Evidence Store, Custom Errors | `src/browser-agent/`, `src/evidence-store/`, `src/errors/` | Console monitoring, custom error classes with retry logic |
| **FR-4: AI Evaluation** | AI Evaluator | `src/ai-evaluator/` | GPT-4o vision analysis, structured prompts, confidence scoring |
| **FR-5: Report Generation** | Report Generator | `src/report-generator/` | Custom HTML/Markdown generators, JSON serialization |
| **FR-6: Lambda/CLI Integration** | CLI, Orchestrator | `cli/`, `index.ts` | Commander.js CLI, programmatic API export |
| **FR-7: RAG Augmentation** | RAG Provider (STRETCH) | `src/browser-agent/ragProvider.ts` | Interface ready for vector DB integration |
| **NFR-1: Performance** | All components | System-wide | Fast tools (Bun, Pino, Biome), 5-minute timeout enforcement |
| **NFR-2: Reliability** | Retry Logic, Error Recovery | `src/utils/retry.ts`, `src/errors/` | Hybrid retry strategy, graceful degradation |
| **NFR-3: Cost Efficiency** | Action Strategy | `src/browser-agent/actionStrategy.ts` | Heuristics-first approach minimizes LLM calls |
| **NFR-4: Maintainability** | Testing, Linting | All `.test.ts` files, `biome.json` | Vitest for testing, Biome for code quality |
| **NFR-5: Security** | Config Management | `src/utils/config.ts` | Centralized env validation, no key logging |

## Technology Stack Details

### Core Technologies

**Runtime & Language:**
- **Bun** - Fast JavaScript/TypeScript runtime
- **TypeScript 5.9.3** - Strict mode enabled, ESNext target
- **Node.js 20+** - Lambda runtime compatibility

**Browser Automation:**
- **@browserbasehq/sdk 2.6.0** - Browserbase cloud browser sessions
- **@browserbasehq/stagehand 2.5.0** - AI-powered browser automation framework

**AI/LLM Stack:**
- **ai 5.0.86** - Vercel AI SDK for unified LLM interface
- **@ai-sdk/openai 2.0.59** - OpenAI provider integration
- **GPT-4o-mini** - Vision analysis and action guidance (primary)
- **GPT-4o** - Final evaluation and scoring (when higher accuracy needed)

**Development Tools:**
- **vitest 4.0** - Testing framework with browser mode
- **biome 2.3.2** - Linting and formatting
- **commander 14.0.2** - CLI framework
- **pino 10.1.0** - Structured logging

### Integration Points

**Browser Agent ↔ Stagehand:**
- Browser Agent wraps Stagehand API
- Provides retry logic and error handling
- Captures screenshots at key moments
- Monitors console logs continuously

**Action Strategy ↔ AI Evaluator:**
- Vision Analyzer sends screenshots to GPT-4o-mini
- Returns action recommendations and state assessment
- Evaluator uses GPT-4o for final playability scoring
- Shared prompt templates in `src/ai-evaluator/prompts.ts`

**Evidence Store ↔ All Components:**
- Components emit events for screenshot capture
- Evidence Store manages file naming and storage
- Provides screenshot paths to Report Generator
- Collects logs from all components via Pino

**Orchestrator ↔ All Components:**
- Central coordinator for test execution flow
- Manages component lifecycle (init, execute, cleanup)
- Aggregates results into QAReport structure
- Handles global timeout enforcement (5 min)

**Report Generator ↔ File System:**
- Reads screenshots from Evidence Store paths
- Generates three formats in parallel (JSON, MD, HTML)
- Embeds screenshots as base64 in HTML or file references
- Saves reports to predictable locations

## Novel Pattern Designs

### Hybrid Action Strategy (Three-Layer Escalation)

This pattern addresses the challenge of intelligent gameplay simulation across unknown game types while maintaining speed and cost efficiency.

**Problem:** Pure scripting is inflexible (fails on unexpected UI), pure AI is slow and expensive. We need something in between.

**Solution:** Three-layer strategy that escalates complexity only when needed.

#### Layer 1: Heuristic Patterns (Fast & Free)

Predefined action sequences for common game types:

```typescript
// Example heuristic patterns
const PLATFORMER_HEURISTIC = {
  name: 'platformer',
  triggers: ['gravity', 'jump', 'platform'],
  actions: [
    { type: 'click', target: 'center' },
    { type: 'keyboard', keys: ['ArrowRight'], duration: 2000 },
    { type: 'keyboard', keys: ['Space'] }, // jump
    { type: 'keyboard', keys: ['ArrowLeft'], duration: 1000 }
  ]
}

const CLICKER_HEURISTIC = {
  name: 'clicker',
  triggers: ['click', 'idle', 'increment'],
  actions: [
    { type: 'click', target: 'center', repeat: 10 },
    { type: 'wait', duration: 1000 },
    { type: 'screenshot', name: 'state-check' }
  ]
}
```

**When to use:** Initial action sequence, known game patterns
**Cost:** $0
**Speed:** Instant

#### Layer 2: Vision-Guided Navigation (Adaptive)

GPT-4o-mini analyzes screenshots to validate actions and guide next steps:

```typescript
// Vision analysis prompt
const visionPrompt = `
Analyze this game screenshot and determine:
1. Did the previous action succeed? (yes/no/unclear)
2. Current game state (menu/playing/game-over/stuck)
3. Recommended next action (click-element/try-keyboard/wait/give-up)
4. Confidence (0-100)

Return JSON with reasoning.
`
```

**When to use:** Heuristic unclear, state validation needed
**Cost:** ~$0.001 per analysis
**Speed:** ~500ms per call

**Input Hint Enhancement:**
Vision analysis can be guided by optional `inputHint` parameter that provides expected game controls:

```typescript
// Example with input hint
const context = {
  gameType: 'platformer',
  attempt: 1,
  inputHint: 'Arrow keys for movement, spacebar to jump, E to interact'
}

// Vision prompt automatically includes:
// "Expected Input Controls: Arrow keys for movement, spacebar to jump, E to interact"
```

This feature enables:
- **DreamUp Integration:** First-party games can pass their input schema
- **Third-Party Testing:** Semantic descriptions guide control detection
- **Improved Accuracy:** Vision layer prioritizes expected control patterns
- **Lambda Invocation:** Game-building agents can provide control context

#### Layer 3: RAG Augmentation (Knowledge-Driven) - STRETCH GOAL

Query vector database for learned patterns from previous successful tests:

```typescript
interface RAGPattern {
  gameType: string
  scenario: string  // "unresponsive menu button"
  solution: Action[]
  confidence: number // 95%+ after 3+ successes
  successCount: number
}
```

**When to use:** Both heuristics and vision uncertain
**Cost:** Vector DB query + context injection
**Speed:** ~200ms query + LLM call
**Learning:** Patterns promoted to Layer 1 after validation (human review)

#### Flow Logic

```typescript
async function executeHybridStrategy(page: Page): Promise<ActionResult> {
  // Layer 1: Try heuristics first
  const heuristic = selectHeuristic(await analyzeGameType(page))
  const result = await executeHeuristic(page, heuristic)

  if (result.confidence > 0.8) {
    return result // Success with high confidence
  }

  // Layer 2: Vision validation
  const screenshot = await captureScreenshot(page)
  const visionResult = await analyzeWithVision(screenshot, heuristic, result)

  if (visionResult.confidence > 0.7) {
    return visionResult.action // Vision gave clear guidance
  }

  // Layer 3: RAG augmentation (if enabled - STRETCH)
  if (config.features.ragEnabled) {
    const ragPattern = await queryRAG({
      gameType: visionResult.gameType,
      currentState: visionResult.state,
      attemptedActions: heuristic.actions
    })

    if (ragPattern && ragPattern.confidence > 0.95) {
      // Track for potential promotion
      trackPatternUsage(ragPattern)
      return ragPattern.solution
    }
  }

  // All layers uncertain - fail gracefully
  throw new GameCrashError('Unable to determine valid action')
}
```

#### Pattern Tracking & Promotion (STRETCH)

```typescript
interface PromotionCandidate {
  ragPattern: RAGPattern
  successRate: number  // 100% over 3 tests
  avgConfidence: number // 95%+
  status: 'pending-review' | 'approved' | 'rejected'
}

// After each test, check for promotion candidates
async function checkForPromotion(pattern: RAGPattern) {
  if (pattern.successCount >= 3 && pattern.confidence >= 0.95) {
    // Generate heuristic code suggestion
    const heuristicCode = generateHeuristicCode(pattern)

    // Queue for human review
    await queuePromotionReview({
      pattern,
      generatedCode: heuristicCode,
      stats: calculatePatternStats(pattern)
    })
  }
}
```

**Affects Epics:** FR-2 (Interaction Simulation), FR-7 (RAG Augmentation)

**Implementation Location:**
- `src/browser-agent/actionStrategy.ts` - Main orchestrator
- `src/browser-agent/heuristics/coreHeuristics.ts` - Layer 1
- `src/browser-agent/visionAnalyzer.ts` - Layer 2
- `src/browser-agent/ragProvider.ts` - Layer 3 (stretch)

## Implementation Patterns

These patterns ensure consistent implementation across all AI agents:

### Pattern 1: API Response Format

**Pattern:** Function returns QAReport directly, throws on failure

```typescript
// ✅ Correct usage
async function runQA(url: string): Promise<QAReport> {
  try {
    const report = await orchestrator.execute(url)
    return report
  } catch (error) {
    if (error instanceof RetryableError) {
      throw error
    }
    throw new QAError('Test failed', error)
  }
}

// Usage
const report = await runQA('https://game.com')
console.log(report.scores.overallPlayability)
```

**Rule:** All agents MUST return QAReport directly on success, throw typed errors on failure.

### Pattern 2: Screenshot Naming

**Pattern:** `{sequence}-{action-description}.png`

```typescript
// ✅ Correct
00-initial-load.png
01-start-button-detected.png
02-start-button-clicked.png
03-gameplay-action-1.png
19-final-state.png

// ❌ Incorrect
screenshot1.png
InitialLoad.png
00_initial_load.png
```

**Rules:**
- Sequence: 2-digit zero-padded (00-99)
- Description: kebab-case, max 30 chars, no special chars
- Evidence Store generates names automatically
- Agents NEVER manually name screenshots

### Pattern 3: TypeScript Type Organization

**Pattern:** Shared types in `src/types/`, component-specific in component folders

```typescript
// ✅ Correct - shared type
// src/types/qaReport.ts
export interface QAReport {
  meta: TestMetadata
  scores: PlayabilityScores
  // ...
}

// ✅ Correct - component-specific type
// src/browser-agent/types.ts
export interface HeuristicPattern {
  name: string
  triggers: string[]
  actions: Action[]
}

// ✅ Correct - import with type modifier
import type { QAReport } from '@/types/qaReport'
import type { ActionResult } from './types'

// ❌ Incorrect - relative path hell
import { QAReport } from '../../../types/qaReport'
```

**Rules:**
- Interfaces: `PascalCase`
- Types: `PascalCase`
- Enums: `PascalCase` with `UPPER_CASE` values
- Always use `type` import modifier
- Use path aliases (`@/`) not relative paths

### Pattern 4: Environment Variable Access

**Pattern:** Centralized config module, never access `process.env` directly

```typescript
// ✅ Correct - config module
// src/utils/config.ts
export const config = {
  browserbase: {
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY!
  },
  output: {
    dir: process.env.OUTPUT_DIR || './output'
  }
}

validateConfig(config) // Validate at module load

// ✅ Correct - usage in components
import { config } from '@/utils/config'
const client = new Browserbase(config.browserbase.apiKey)

// ❌ Incorrect - direct access
const apiKey = process.env.BROWSERBASE_API_KEY
```

**Rules:**
- ALL env vars accessed through `config`
- Config validated at startup (fail fast)
- Never use `process.env` directly in components

### Pattern 5: Async Function Patterns

**Pattern:** Always async/await, always try/catch, no floating promises

```typescript
// ✅ Correct - proper async/await
async function loadGame(url: string): Promise<void> {
  try {
    await page.goto(url)
    await page.waitForLoadState('networkidle')
  } catch (error) {
    if (error instanceof TimeoutError) {
      throw new RetryableError('Page load timeout', error)
    }
    throw error
  }
}

// ✅ Correct - parallel operations
const [screenshot, logs] = await Promise.all([
  captureScreenshot(),
  getConsoleLogs()
])

// ❌ Incorrect - floating promise
captureScreenshot() // Missing await!

// ❌ Incorrect - .then() style
page.goto(url).then(() => console.log('loaded'))
```

**Rules:**
- ALWAYS use async/await (never `.then()`)
- EVERY await MUST be in try/catch
- NEVER have floating promises
- Use `Promise.all()` for parallel ops when safe

### Pattern 6: Logging Patterns

**Pattern:** Pino structured logging with child loggers per component

```typescript
// ✅ Correct - logger setup
// src/utils/logger.ts
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
})

// ✅ Correct - component usage
import { logger } from '@/utils/logger'
const log = logger.child({ component: 'BrowserAgent' })

log.info({ url, attempt: 1 }, 'Loading game')
log.error({ error, url }, 'Failed to load game')
log.debug({ action: 'click', selector }, 'Executing action')

// ❌ Incorrect - console.log
console.log('Loading game:', url)

// ❌ Incorrect - unstructured logging
log.info('Loading game ' + url)
```

**Log Level Usage:**
- `debug` - Detailed action steps, state transitions
- `info` - Major milestones (test started, game loaded)
- `warn` - Retry attempts, recoverable issues
- `error` - Failures, exceptions thrown

**Rules:**
- ALWAYS use structured logging: `log.level({ context }, 'message')`
- NEVER use console.log/console.error
- ALWAYS include relevant context (url, testId, action)
- Use child loggers for component context

## Consistency Rules

### Naming Conventions

**File Naming:**
- TypeScript source files: `camelCase.ts` (e.g., `browserAgent.ts`, `qaOrchestrator.ts`)
- Test files: `camelCase.test.ts` (e.g., `browserAgent.test.ts`)
- Type files: `types.ts` (within each component folder)
- Output files: `kebab-case` (e.g., `00-initial-load.png`, `report.json`)

**Directory Naming:**
- Component folders: `kebab-case` (e.g., `browser-agent/`, `ai-evaluator/`)
- Test output: `test-{uuid}-{timestamp}/`

**Code Naming:**
- Variables/Functions: `camelCase`
- Classes/Interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Enums: `PascalCase` with `UPPER_CASE` values

### Code Organization

**Component Structure (feature-based):**
```
src/{component-name}/
├── {componentName}.ts       # Main implementation
├── {componentName}.test.ts  # Tests
├── types.ts                 # Component-specific types
└── {helpers}.ts             # Optional helper modules
```

**Test Organization:**
- Unit tests: Co-located with source (`*.test.ts`)
- Integration tests: `tests/integration/`
- Fixtures: `tests/fixtures/`

**Import Order:**
1. External packages (`import pino from 'pino'`)
2. Internal shared types (`import type { QAReport } from '@/types'`)
3. Component-local imports (`import { helper } from './helper'`)

### Error Handling

**Custom Error Classes:**

```typescript
// Base error
export class QAError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message)
    this.name = 'QAError'
  }
}

// Retryable errors (network, timeouts)
export class RetryableError extends QAError {
  constructor(message: string, cause?: Error) {
    super(message, cause)
    this.name = 'RetryableError'
  }
}

// Game crashes (fail fast)
export class GameCrashError extends QAError {
  constructor(message: string, cause?: Error) {
    super(message, cause)
    this.name = 'GameCrashError'
  }
}

// Invalid inputs (fail immediately)
export class ValidationError extends QAError {
  constructor(message: string, cause?: Error) {
    super(message, cause)
    this.name = 'ValidationError'
  }
}
```

**Error Handling Strategy:**
- `RetryableError`: Retry 3x with exponential backoff (1s, 2s, 4s)
- `GameCrashError`: Fail fast, capture evidence, report
- `ValidationError`: Fail immediately, no retry
- All errors logged with context

### Logging Strategy

**Logger Configuration:**
- Centralized in `src/utils/logger.ts`
- Pino with pretty-printing for development
- JSON output for production
- Log level controlled via `LOG_LEVEL` env var

**Structured Logging Pattern:**
```typescript
log.info({
  component: 'BrowserAgent',
  url: gameUrl,
  attempt: attemptNumber,
  duration: elapsedMs
}, 'Game loaded successfully')
```

**What to Log:**
- `debug`: Action details, state transitions, internal decisions
- `info`: Test lifecycle events, major milestones, success paths
- `warn`: Retry attempts, degraded performance, recoverable issues
- `error`: Failures, exceptions, unrecoverable states

**What NOT to Log:**
- API keys or secrets
- Full screenshot data (log paths instead)
- Large JSON payloads (summarize or log size)

## Data Architecture

### Core Data Models

**QAReport (from PRD):**
```typescript
interface QAReport {
  meta: {
    testId: string
    gameUrl: string
    timestamp: string         // ISO 8601
    duration: number          // seconds
    agentVersion: string
  }
  status: 'success' | 'failure' | 'error'
  scores: {
    loadSuccess: number       // 0-100
    responsiveness: number    // 0-100
    stability: number         // 0-100
    overallPlayability: number // 0-100
  }
  evaluation: {
    reasoning: string
    confidence: number        // 0-100
  }
  issues: Array<{
    severity: 'critical' | 'major' | 'minor'
    category: string
    description: string
    screenshot?: string       // path to evidence
  }>
  evidence: {
    screenshots: string[]     // paths
    logs: {
      console: string         // path
      actions: string         // path
      errors: string          // path
    }
  }
  actions: Array<{
    type: string
    timestamp: string
    success: boolean
    details?: string
  }>
}
```

**Configuration:**
```typescript
interface Config {
  browserbase: {
    apiKey: string
    projectId: string
  }
  openai: {
    apiKey: string
  }
  output: {
    dir: string
  }
  features: {
    ragEnabled: boolean
  }
}
```

**Action Types:**
```typescript
interface Action {
  type: 'click' | 'keyboard' | 'wait' | 'screenshot'
  target?: string
  keys?: string[]
  duration?: number
  timestamp: string
}

interface ActionResult {
  success: boolean
  confidence: number
  evidence?: string[]
  error?: Error
}
```

### Data Flow

```
User Input (URL)
  ↓
Orchestrator
  ↓
Browser Agent → Stagehand API
  ↓
Action Strategy (Heuristics/Vision/RAG)
  ↓
Evidence Store (Screenshots + Logs)
  ↓
AI Evaluator (Vision Analysis)
  ↓
Report Generator (JSON/MD/HTML)
  ↓
Output Files + Return QAReport
```

## API Contracts

### CLI Interface

```bash
# Basic usage
bun run cli/index.ts <gameUrl>

# With options
bun run cli/index.ts <gameUrl> --output <dir> --format <json,md,html>

# Examples
bun run cli/index.ts https://game.com/platformer.html
bun run cli/index.ts https://game.com/game.html --output ./results --format json,html
```

**CLI Options:**
- `<gameUrl>` - Required: HTTP/HTTPS URL of game to test
- `--output, -o <dir>` - Output directory (default: `./output`)
- `--format, -f <formats>` - Comma-separated: json, md, html (default: all)
- `--timeout, -t <seconds>` - Test timeout (default: 300)
- `--log-level, -l <level>` - Log level: debug, info, warn, error (default: info)

### Programmatic API

```typescript
// Import
import { runQA } from './index'

// Basic usage
const report = await runQA('https://game.com/platformer.html')
console.log(report.scores.overallPlayability)

// With options
const report = await runQA('https://game.com/game.html', {
  outputDir: './my-results',
  formats: ['json', 'html'],
  timeout: 180, // 3 minutes
  logLevel: 'debug'
})

// Error handling
try {
  const report = await runQA(gameUrl)
  if (report.scores.overallPlayability > 70) {
    console.log('Game passed QA!')
  }
} catch (error) {
  if (error instanceof GameCrashError) {
    console.error('Game crashed:', error.message)
  } else if (error instanceof ValidationError) {
    console.error('Invalid input:', error.message)
  } else {
    console.error('Test failed:', error)
  }
}
```

**Function Signature:**
```typescript
async function runQA(
  gameUrl: string,
  options?: {
    outputDir?: string      // Default: './output'
    formats?: ('json' | 'md' | 'html')[]  // Default: all
    timeout?: number        // Default: 300 seconds
    logLevel?: 'debug' | 'info' | 'warn' | 'error'  // Default: 'info'
  }
): Promise<QAReport>
```

## Security Architecture

### API Key Management

**Environment Variables (.env):**
```bash
# Required
BROWSERBASE_API_KEY=your_api_key_here
BROWSERBASE_PROJECT_ID=your_project_id_here
OPENAI_API_KEY=your_openai_key_here

# Optional
OUTPUT_DIR=./output
LOG_LEVEL=info
```

**Security Rules:**
1. **Never log API keys** - Config module sanitizes logs
2. **Validate at startup** - Fail fast if keys missing
3. **Use .env files** - Never hardcode in source
4. **.gitignore protection** - `.env` always ignored
5. **Lambda secrets** - Use environment variables in AWS

### Input Validation

**URL Validation:**
```typescript
function validateGameUrl(url: string): void {
  const parsed = new URL(url)

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ValidationError('Only HTTP/HTTPS URLs allowed')
  }

  // Prevent SSRF attacks
  const hostname = parsed.hostname
  if (hostname === 'localhost' || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
    throw new ValidationError('Internal/private URLs not allowed')
  }
}
```

### Browser Sandboxing

- Games run in **Browserbase isolated sessions**
- No access to host system
- Session destroyed after test
- No persistent cookies or storage across tests

## Performance Considerations

### Performance Targets (from PRD)

| Metric | Target | Strategy |
|--------|--------|----------|
| Total test time | < 5 minutes | Timeout enforcement, heuristics-first approach |
| LLM evaluation | < 30 seconds | GPT-4o-mini for speed, parallel API calls |
| Screenshot capture | < 2 seconds | Browserbase optimized, compress images |
| Startup time | < 10 seconds | Lazy loading, minimal dependencies |
| LLM cost per test | < $0.10 | Heuristics minimize LLM calls, use mini models |

### Optimization Strategies

**1. Heuristics-First Approach:**
- 80% of actions use free heuristics
- Only escalate to LLM when needed
- Saves ~$0.05-0.08 per test

**2. Parallel Operations:**
```typescript
// Generate all report formats in parallel
await Promise.all([
  generateJSON(report),
  generateMarkdown(report),
  generateHTML(report)
])
```

**3. Fast Tooling:**
- **Bun**: 3x faster than Node.js
- **Pino**: 5x faster than Winston
- **Biome**: 100x faster than ESLint+Prettier

**4. Timeout Enforcement:**
- Global 5-minute timeout on orchestrator
- Per-action 30-second timeout
- Exponential backoff on retries (1s, 2s, 4s)

## Deployment Architecture

### Local Development

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Run tests
bun run cli/index.ts https://game.com/test.html

# Run unit tests
bun test
```

### AWS Lambda Deployment

**Lambda Configuration:**
- Runtime: **Node.js 20**
- Memory: **2048 MB** (for browser automation)
- Timeout: **5 minutes** (300 seconds max)
- Environment Variables: Set in Lambda console

**Handler Function:**
```typescript
// lambda/handler.ts
import { runQA } from '../index'

export const handler = async (event: {gameUrl: string}) => {
  try {
    const report = await runQA(event.gameUrl, {
      outputDir: '/tmp/qa-results',  // Lambda tmp storage
      timeout: 280  // Leave 20s buffer
    })

    return {
      statusCode: 200,
      body: JSON.stringify(report)
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        type: error.name
      })
    }
  }
}
```

**Deployment Steps:**
1. Build: `bun build --target=node`
2. Package: `zip -r function.zip .`
3. Upload to Lambda
4. Set environment variables
5. Test with sample game URL

## Development Environment

### Prerequisites

**Required:**
- **Bun** 1.0+ (or Node.js 20+)
- **TypeScript** 5.0+
- **Git**

**API Keys:**
- Browserbase account (free tier: 1 browser-hour)
- OpenAI API key (GPT-4o access)

### Setup Commands

```bash
# 1. Clone repository
git clone <repo-url>
cd Denethor

# 2. Install dependencies
bun install

# 3. Install additional dev dependencies
bun add -d vitest@4.0 @biomejs/biome@2.3.2 commander@14.0.2 pino@10.1.0

# 4. Install production dependencies
bun add @browserbasehq/sdk@2.6.0 @browserbasehq/stagehand@2.5.0 ai@5.0.86 @ai-sdk/openai@2.0.59

# 5. Set up environment
cp .env.example .env
# Edit .env and add your API keys

# 6. Configure Biome
bun biome init

# 7. Configure Vitest
# Create vitest.config.ts (see below)

# 8. Run first test
bun run cli/index.ts https://example-game.com/test.html
```

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})
```

### Development Workflow

```bash
# Run tests
bun test

# Run tests in watch mode
bun test --watch

# Run linter
bun biome check .

# Auto-fix linting issues
bun biome check --apply .

# Format code
bun biome format --write .

# Run CLI for manual testing
bun run cli/index.ts <game-url>
```

## Game Progression Strategy (v1.4.0)

**Problem (Pre-v1.4):** Early versions of the QA agent got stuck at game loading and start screens, executing 0 gameplay actions, spending 2.5 minutes in retry loops, then timing out. Root causes included:
1. "Wait" actions incorrectly treated as crashes
2. Blind center-clicking unstick logic without DOM/vision analysis
3. No progress detection (unable to determine if screen was actually changing)
4. Missing iframe handling for itch.io embedded games

**Solution (v1.4):** Multi-layered progression strategy combining progress detection with intelligent unstick strategies.

### Progress Detection System

**Objective:** Track game state changes to determine responsiveness and detect stuck conditions.

**Implementation:** `src/utils/progressDetector.ts`

**Core Capabilities:**
- Screenshots hashed with SHA-256 for fast comparison
- Tracks consecutive identical screenshots (stuck threshold: 5+)
- Calculates progress score: `(successfulInputs / totalInputs) * 100 + stateBonus`
- Identifies unique visual game states
- Integrated into QA report as `progressMetrics`

**Integration Points:**
- Called after each action in orchestrator main loop
- Reports included in final QA report
- Triggers enhanced unstick when 5+ consecutive identical screenshots detected

**Metrics Tracked:**
```typescript
interface ProgressMetrics {
  screenshotsWithChanges: number;      // Screens that differed from previous
  screenshotsIdentical: number;        // Screens identical to previous
  consecutiveIdentical: number;        // Current streak of identical screens
  uniqueGameStates: number;            // Total unique screen hashes seen
  inputsAttempted: number;             // Total actions attempted
  inputsSuccessful: number;            // Actions that caused screen changes
  progressScore: number;               // 0-100 composite score
}
```

### Unstick Strategies

**Objective:** Intelligently escape loading screens and start screens using multiple techniques.

**Implementation:** `src/browser-agent/unstickStrategies.ts`

**Strategy Execution Order:**
1. **Iframe Detection** - Detect game embedded in iframe (common for itch.io)
   - Searches for `#game_drop`, `iframe[src*='game']`, `.game-frame`
   - Switches context to iframe content frame
   - Attempts interaction within iframe bounds

2. **DOM Button Finder** - Locate and click start/play buttons via DOM analysis
   - Scans DOM analysis results for visible buttons
   - Matches text patterns: "start", "play", "begin", "continue"
   - Clicks button center using precise coordinates
   - Verifies screen change after click

3. **Vision-Guided Click** - Use GPT-4o to identify and click visible buttons
   - Analyzes screenshot with vision analyzer
   - Identifies clickable elements by visual appearance
   - Matches vision-described targets to DOM elements
   - Falls back to center-click if specific element not found

4. **Keyboard Mash** - Try common keyboard inputs in sequence
   - Attempts: Space, Enter, Escape, Arrow keys, WASD
   - 500ms wait between each key
   - Stops on first key that changes screen
   - Useful for keyboard-only games

5. **Page Refresh** - Last resort screen reload
   - Full page reload with load wait
   - 3 second pause for assets
   - Always changes screen

**Strategy Result Tracking:**
Each strategy returns:
- `success`: Whether strategy executed (not necessarily whether it worked)
- `changed`: Whether screenshot differed after action
- `action`: Description of what was attempted
- `beforeHash` / `afterHash`: Screenshot hashes for verification

### First Action Handling Changes

**Location:** `src/orchestrator/qaOrchestrator.ts:567-620`

**Key Changes:**

1. **"Wait" Actions Are Valid** - Not treated as crashes
   - Indicates game loading, expected behavior
   - Logs as INFO level, not WARN
   - Waits specified duration and continues naturally
   - Does not trigger unstick/retry loop

2. **Low-Confidence Actions Attempted** - Lower success threshold
   - Actions with 30%+ confidence are attempted
   - Only ultra-low confidence (<40%) triggers unstick
   - Rationale: Many low-confidence predictions succeed anyway
   - Avoids premature unstick entry

3. **Action Success Tracking** - Record whether actions caused changes
   - Each action compared to previous screenshot
   - Screen change indicates success (progress)
   - No change indicates dead-end (may need unstick)

**Old Logic (v1.3):**
```
If (wait OR unknown) AND confidence < 80
  → Enter 2.5min retry loop
```

**New Logic (v1.4):**
```
If wait AND confidence >= 50
  → Wait 5s, continue naturally (no retry)

If unknown AND confidence < 40
  → Enter unstick (intelligent strategies)

If confidence >= 30
  → Try action (may succeed despite low confidence)
```

### Integration with Orchestrator

**Progress Detection Integration:**
```typescript
// After each action execution
const changed = progressDetector.recordScreenshot(
  screenshot,
  strategyResult.actionType
);

// Check for stuck condition
if (progressDetector.isStuck()) {
  // Trigger enhanced unstick strategy
}

// Include in final report
report.progressMetrics = progressDetector.getMetrics();
```

**Unstick Strategy Integration:**
```typescript
// When game appears stuck
const unstickContext: UnstickContext = {
  testId: this.testId,
  attemptNumber: retryCount,
  domAnalysis: latestDOMAnalysis,
  inputHint: this.config.inputHint,
  evidenceStore: browserAgent.getEvidenceStore(),
};

const executor = UnstickStrategyExecutor.createDefault();
const result = await executor.executeAll(page, unstickContext);

// If screen changed, break retry loop and continue
if (result.changed) {
  break; // Exit retry loop, continue with next action
}
```

### Metrics and Success Indicators

**Expected Results After v1.4:**
- Actions executed per test: 10-20 (was 0)
- Time to escape start screen: <30 seconds (was 2.5 minutes)
- Unique game states seen: 3-10 (was 1)
- Input success rate: 60-80% (was N/A)
- Progress score: 60-100 (was 0)

**Diagnosis via Progress Metrics:**
- `progressScore = 0`: Game not responding to input (iframe issue, WebGL error, etc.)
- `uniqueGameStates = 1`: Screen never changed (stuck or infinite load)
- `inputSuccessRate = 100%`: Every action worked (good signal)
- `inputSuccessRate = 50%`: Some actions work, some don't (partial progress)

## Architecture Decision Records (ADRs)

### ADR-001: Use Bun over Node.js

**Decision:** Use Bun as primary runtime with Node.js 20 compatibility
**Rationale:**
- 3x faster execution than Node.js
- Native TypeScript support (no ts-node needed)
- Built-in .env loading
- AWS Lambda compatible via Node.js 20 runtime
- Project startup time reduced from ~2s to <500ms

### ADR-002: Hybrid Action Strategy over Pure AI

**Decision:** Three-layer strategy (heuristics → vision → RAG) instead of pure LLM-driven actions
**Rationale:**
- Cost: Reduces LLM calls by 80%, saving ~$0.08 per test
- Speed: Heuristics execute in <10ms vs 500ms+ for LLM
- Accuracy: Heuristics more reliable for common patterns
- Extensibility: RAG layer enables continuous learning

### ADR-003: Feature-Based Structure over Layer-Based

**Decision:** Organize code by component (browser-agent/, orchestrator/) not by layer (services/, models/)
**Rationale:**
- Easier for AI agents to locate related code
- Each component is self-contained with tests
- Clearer boundaries prevent coupling
- Aligns with domain-driven design principles

### ADR-004: Custom Error Classes over Generic Errors

**Decision:** Create typed error classes (RetryableError, GameCrashError) instead of throwing generic Error
**Rationale:**
- Enables intelligent retry logic based on error type
- TypeScript can type-check error handling
- Clearer intent in code (immediately obvious if error should retry)
- Aligns with hybrid error recovery strategy

### ADR-005: Vitest over Jest

**Decision:** Use Vitest 4.0 instead of Jest
**Rationale:**
- 10x faster test execution than Jest
- Native ESM support (Jest has issues)
- Better TypeScript integration
- Browser mode for integration tests
- Growing adoption in 2025 ecosystem

### ADR-006: Biome over ESLint + Prettier

**Decision:** Use Biome for both linting and formatting
**Rationale:**
- 100x faster than ESLint+Prettier combo
- Single tool reduces configuration complexity
- Zero config by default
- 97% Prettier compatibility
- Modern standard for TypeScript projects in 2025

---

_Generated by BMAD Decision Architecture Workflow v1.3.2_
_Date: 2025-11-03_
_For: Sasha_
