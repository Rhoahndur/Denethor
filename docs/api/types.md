# Type Definitions

Complete TypeScript type definitions for Denethor.

## Table of Contents

- [Core Types](#core-types)
- [Configuration Types](#configuration-types)
- [Result Types](#result-types)
- [Evidence Types](#evidence-types)
- [Action Types](#action-types)
- [Error Types](#error-types)

---

## Core Types

### QAReport

Complete test report structure returned after QA execution.

```typescript
interface QAReport {
  /** Test metadata */
  meta: TestMetadata;

  /** Test status */
  status: 'success' | 'failure' | 'error';

  /** Playability scores (0-100) */
  scores: PlayabilityScores;

  /** AI evaluation details */
  evaluation: {
    reasoning: string;
    confidence: number; // 0-100
  };

  /** Detected issues */
  issues: Issue[];

  /** Collected evidence */
  evidence: Evidence;

  /** Actions executed during test */
  actions: Action[];
}
```

### TestMetadata

Test execution metadata.

```typescript
interface TestMetadata {
  /** Unique test identifier (UUID) */
  testId: string;

  /** URL of tested game */
  gameUrl: string;

  /** Test start timestamp (ISO 8601) */
  timestamp: string;

  /** Test duration in seconds */
  duration: number;

  /** Denethor version */
  agentVersion: string;
}
```

### PlayabilityScores

Playability assessment scores (all 0-100).

```typescript
interface PlayabilityScores {
  /** How well did the game load? */
  loadSuccess: number;

  /** How responsive are the controls? */
  responsiveness: number;

  /** How stable is the game (no crashes)? */
  stability: number;

  /** Overall playability assessment */
  overallPlayability: number;
}
```

**Scoring Guidelines:**

| Score Range | Interpretation |
|-------------|---------------|
| 90-100 | Excellent - Production ready |
| 70-89 | Good - Minor issues |
| 40-69 | Fair - Playable but needs work |
| 0-39 | Poor - Critical issues |

### Issue

Individual issue detected during testing.

```typescript
interface Issue {
  /** Severity level */
  severity: 'critical' | 'major' | 'minor';

  /** Issue category */
  category: string;

  /** Human-readable description */
  description: string;

  /** Path to supporting screenshot (optional) */
  screenshot?: string;
}
```

**Severity Definitions:**

- **critical**: Game unplayable or severely broken
- **major**: Significant functionality issues
- **minor**: Small bugs or usability concerns

**Common Categories:**

- `performance` - Slow loading, lag, FPS issues
- `stability` - Crashes, freezes, errors
- `usability` - Controls, UI, clarity issues
- `compatibility` - Browser/device compatibility

---

## Configuration Types

### QAOrchestratorConfig

Configuration for QAOrchestrator.

```typescript
interface QAOrchestratorConfig {
  /** URL of the game to test (required) */
  gameUrl: string;

  /** Maximum session timeout in milliseconds (default: 300000 = 5 minutes) */
  sessionTimeout?: number;

  /** Maximum number of actions to execute (default: 20) */
  maxActions?: number;

  /** Output directory for test results (default: './output') */
  outputDir?: string;
}
```

### QATestOptions

Options for runQATest() function.

```typescript
interface QATestOptions {
  /** Output directory for test results (default: './output') */
  outputDir?: string;

  /** Maximum session timeout in milliseconds (default: 300000 = 5 minutes) */
  sessionTimeout?: number;

  /** Maximum number of actions to execute (default: 20) */
  maxActions?: number;
}
```

### Config

System-wide configuration (from environment variables).

```typescript
interface Config {
  browserbase: {
    apiKey: string;
    projectId: string;
  };
  openai: {
    apiKey: string;
  };
  output: {
    dir: string;
  };
}
```

---

## Result Types

### QATestResult

Result returned from runQATest() or QAOrchestrator.runTest().

```typescript
interface QATestResult {
  /** Complete QA report */
  report: QAReport;

  /** Paths to generated report files */
  reportPaths: ReportPaths;
}
```

### ReportPaths

Paths to generated report files.

```typescript
interface ReportPaths {
  /** Path to JSON report */
  json: string;

  /** Path to Markdown report */
  markdown: string;

  /** Path to HTML report */
  html: string;
}
```

### EvaluationResult

Result from AI evaluation.

```typescript
interface EvaluationResult {
  /** Playability scores */
  scores: PlayabilityScores;

  /** AI reasoning for scores */
  reasoning: string;

  /** Confidence in evaluation (0-100) */
  confidence: number;
}
```

### ActionResult

Result from executing a browser action.

```typescript
interface ActionResult {
  /** Whether action succeeded */
  success: boolean;

  /** Confidence in success (0-100) */
  confidence: number;

  /** Evidence paths (screenshots, etc.) */
  evidence?: string[];

  /** Error if action failed */
  error?: Error;
}
```

---

## Evidence Types

### Evidence

Complete evidence collection from a test.

```typescript
interface Evidence {
  /** Paths to screenshot files */
  screenshots: string[];

  /** Paths to log files */
  logs: {
    console: string;  // Browser console logs
    actions: string;  // Action execution logs
    errors: string;   // Error logs
  };
}
```

### EvidenceCollection

Evidence collection with full paths.

```typescript
interface EvidenceCollection {
  /** Array of screenshot file paths */
  screenshots: string[];

  /** Log file paths */
  logs: {
    console?: string;
    actions?: string;
    errors?: string;
  };

  /** Test metadata path */
  metadataPath: string;
}
```

### LogType

Type of log to collect.

```typescript
type LogType = 'console' | 'actions' | 'errors';
```

---

## Action Types

### Action

Record of an action executed during testing.

```typescript
interface Action {
  /** Type of action */
  type: string;

  /** Timestamp (ISO 8601) */
  timestamp: string;

  /** Whether action succeeded */
  success: boolean;

  /** Additional details */
  details?: string;
}
```

**Common action types:**

- `create-session` - Browser session created
- `navigate` - Navigated to game URL
- `detect-game-type` - Game type detected
- `click` - Click action executed
- `keyboard` - Keyboard input executed
- `wait` - Wait action executed
- `screenshot` - Screenshot captured
- `close-session` - Browser session closed
- `crash-detected` - Game crash detected
- `error` - Error occurred

### BrowserAction

Action to be executed by browser agent.

```typescript
interface BrowserAction {
  /** Type of action */
  type: 'click' | 'keyboard' | 'wait' | 'screenshot';

  /** Target element selector (for click) */
  target?: string;

  /** Keyboard keys to press (for keyboard) */
  keys?: string[];

  /** Duration in milliseconds (for wait, keyboard) */
  duration?: number;

  /** Timestamp when action was created */
  timestamp: string;
}
```

### GameType

Detected game type.

```typescript
type GameType = 'platformer' | 'clicker' | 'puzzle' | 'generic';
```

### GameTypeDetectionResult

Result of game type detection.

```typescript
interface GameTypeDetectionResult {
  /** Detected game type */
  gameType: GameType;

  /** Confidence in detection (0-100) */
  confidence: number;

  /** Method used for detection */
  method: 'dom-analysis' | 'vision-analysis';
}
```

---

## Error Types

All error classes extend the base `QAError` class.

### QAError

Base error class for all Denethor errors.

```typescript
class QAError extends Error {
  /** Error name */
  name: 'QAError';

  /** Error message */
  message: string;

  /** Underlying cause (optional) */
  cause?: Error;

  constructor(message: string, cause?: Error);
}
```

### ValidationError

Thrown for invalid inputs or configuration.

```typescript
class ValidationError extends QAError {
  name: 'ValidationError';

  constructor(message: string, cause?: Error);
}
```

**When thrown:**

- Invalid game URL format
- Internal/private URLs (SSRF protection)
- Missing required environment variables
- Invalid configuration values

### GameCrashError

Thrown when game crashes during testing.

```typescript
class GameCrashError extends QAError {
  name: 'GameCrashError';

  constructor(message: string, cause?: Error);
}
```

**When thrown:**

- JavaScript errors in game code
- Frozen/unresponsive game state
- Browser tab crashes

### RetryableError

Thrown for transient failures that can be retried.

```typescript
class RetryableError extends QAError {
  name: 'RetryableError';

  constructor(message: string, cause?: Error);
}
```

**When thrown:**

- Network timeouts
- Browserbase connection issues
- OpenAI API rate limits
- Temporary service unavailability

---

## Type Guards

Utility type guards for runtime type checking.

### isValidationError()

```typescript
function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}
```

### isGameCrashError()

```typescript
function isGameCrashError(error: unknown): error is GameCrashError {
  return error instanceof GameCrashError;
}
```

### isRetryableError()

```typescript
function isRetryableError(error: unknown): error is RetryableError {
  return error instanceof RetryableError;
}
```

---

## Usage Examples

### Type-Safe Result Processing

```typescript
import type { QATestResult, PlayabilityScores } from 'browsergame-qa';

function analyzeResults(results: QATestResult): void {
  const scores: PlayabilityScores = results.report.scores;

  // TypeScript knows scores has these properties
  console.log(`Load: ${scores.loadSuccess}`);
  console.log(`Responsiveness: ${scores.responsiveness}`);
  console.log(`Stability: ${scores.stability}`);
  console.log(`Overall: ${scores.overallPlayability}`);
}
```

### Type-Safe Error Handling

```typescript
import {
  runQATest,
  ValidationError,
  GameCrashError,
  RetryableError
} from 'browsergame-qa';

try {
  const results = await runQATest('https://example.com/game');
} catch (error) {
  // TypeScript knows these are the possible error types
  if (error instanceof ValidationError) {
    // Handle validation errors
    console.error('Invalid input:', error.message);
  } else if (error instanceof GameCrashError) {
    // Handle game crashes
    console.error('Game crashed:', error.message);
  } else if (error instanceof RetryableError) {
    // Handle retryable errors
    console.error('Temporary failure:', error.message);
  } else {
    // Handle unknown errors
    console.error('Unknown error:', error);
  }
}
```

### Type-Safe Configuration

```typescript
import type { QAOrchestratorConfig } from 'browsergame-qa';
import { QAOrchestrator } from 'browsergame-qa';

const config: QAOrchestratorConfig = {
  gameUrl: 'https://example.com/game',
  maxActions: 15,
  sessionTimeout: 60000,
  outputDir: './results'
};

// TypeScript validates config structure
const orchestrator = new QAOrchestrator(config);
```

---

## Type Exports

All types are exported from the main module and can be imported individually:

```typescript
// Import all types
import type {
  QAReport,
  QATestResult,
  QAOrchestratorConfig,
  PlayabilityScores,
  Issue,
  Action,
  Evidence,
  EvaluationResult,
  // ... and more
} from 'browsergame-qa';
```

Or import from specific modules:

```typescript
// Import from types module
import type {
  QAReport,
  PlayabilityScores,
  Issue
} from 'browsergame-qa/types';

// Import from component modules
import type { EvidenceCollection } from 'browsergame-qa/evidence-store';
import type { GameType } from 'browsergame-qa/browser-agent';
```

---

## Next Steps

- [API Documentation](./README.md) - Complete API reference
- [Getting Started](../user-guide/getting-started.md) - Learn the basics
- [Examples](../../examples/) - See these types in action
