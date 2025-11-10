# Denethor API Documentation

Complete API reference for Denethor - the automated QA testing system for browser-based games.

## Table of Contents

- [Quick Start](#quick-start)
- [Main API](#main-api)
  - [runQATest()](#runqatest)
  - [QAOrchestrator](#qaorchestrator)
- [Component APIs](#component-apis)
  - [EvidenceStore](#evidencestore)
  - [BrowserAgent](#browseragent)
  - [AIEvaluator](#aievaluator)
  - [ReportGenerator](#reportgenerator)
- [Error Handling](#error-handling)
- [Type Definitions](#type-definitions)
- [Usage Examples](#usage-examples)

---

## Quick Start

### Simple API Usage

The easiest way to use Denethor:

```typescript
import { runQATest } from 'browsergame-qa';

// Run a test
const results = await runQATest('https://example.com/game');

// Access results
console.log(`Score: ${results.report.scores.overallPlayability}/100`);
console.log(`Issues: ${results.report.issues.length}`);
console.log(`Report: ${results.reportPaths.html}`);
```

### Advanced API Usage

For more control, use the `QAOrchestrator` class:

```typescript
import { QAOrchestrator } from 'browsergame-qa';

const orchestrator = new QAOrchestrator({
  gameUrl: 'https://example.com/game',
  maxActions: 15,
  sessionTimeout: 60000,
  outputDir: './my-results'
});

const results = await orchestrator.runTest();
```

---

## Main API

### runQATest()

Simple wrapper function for running QA tests. Recommended for most use cases.

#### Signature

```typescript
function runQATest(
  gameUrl: string,
  options?: QATestOptions
): Promise<QATestResult>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `gameUrl` | string | Yes | HTTP/HTTPS URL of the game to test |
| `options` | QATestOptions | No | Configuration options |

##### QATestOptions

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

#### Returns

`Promise<QATestResult>` - Resolves to test results

```typescript
interface QATestResult {
  /** Complete QA report */
  report: QAReport;

  /** Paths to generated report files */
  reportPaths: {
    json: string;
    markdown: string;
    html: string;
  };
}
```

#### Throws

- `ValidationError` - Invalid game URL or configuration
- `GameCrashError` - Game crashed during testing
- `Error` - Other failures (network, timeout, etc.)

#### Example: Basic Usage

```typescript
import { runQATest } from 'browsergame-qa';

const results = await runQATest('https://example.com/game');
console.log(results.report.scores.overallPlayability);
```

#### Example: With Options

```typescript
import { runQATest } from 'browsergame-qa';

const results = await runQATest('https://example.com/game', {
  outputDir: './test-results',
  maxActions: 15,
  sessionTimeout: 60000
});

// Check if test passed
if (results.report.scores.overallPlayability >= 70) {
  console.log('Game passed QA!');
  console.log(`View report: ${results.reportPaths.html}`);
}
```

#### Example: Error Handling

```typescript
import { runQATest, ValidationError, GameCrashError } from 'browsergame-qa';

try {
  const results = await runQATest('https://example.com/game');
  console.log(`Score: ${results.report.scores.overallPlayability}/100`);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid URL:', error.message);
  } else if (error instanceof GameCrashError) {
    console.error('Game crashed:', error.message);
  } else {
    console.error('Test failed:', error);
  }
}
```

---

### QAOrchestrator

Main orchestrator class for coordinating test execution. Use this for advanced control.

#### Constructor

```typescript
new QAOrchestrator(config: QAOrchestratorConfig)
```

##### QAOrchestratorConfig

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

#### Methods

##### runTest()

Executes the complete QA test flow.

```typescript
async runTest(): Promise<QATestResult>
```

**Returns**: `Promise<QATestResult>` - Test results with report and file paths

**Throws**: Same as `runQATest()` function

#### Example: Basic Orchestrator Usage

```typescript
import { QAOrchestrator } from 'browsergame-qa';

const orchestrator = new QAOrchestrator({
  gameUrl: 'https://example.com/game'
});

const results = await orchestrator.runTest();
console.log(results.report.status);
```

#### Example: Custom Configuration

```typescript
import { QAOrchestrator } from 'browsergame-qa';

const orchestrator = new QAOrchestrator({
  gameUrl: 'https://example.com/game',
  maxActions: 10,           // Shorter test
  sessionTimeout: 120000,   // 2 minutes
  outputDir: './qa-results'
});

const results = await orchestrator.runTest();

// Process results
for (const issue of results.report.issues) {
  if (issue.severity === 'critical') {
    console.error(`Critical issue: ${issue.description}`);
  }
}
```

---

## Component APIs

These are lower-level APIs for advanced usage. Most users should use `runQATest()` or `QAOrchestrator` instead.

### EvidenceStore

Manages test evidence (screenshots, logs).

#### Constructor

```typescript
new EvidenceStore(testId: string, outputDir?: string)
```

#### Methods

##### initialize()

Creates directory structure for evidence storage.

```typescript
async initialize(): Promise<void>
```

##### captureScreenshot()

Saves a screenshot with auto-generated naming.

```typescript
async captureScreenshot(
  screenshot: Buffer | string,
  description: string
): Promise<string>
```

**Returns**: Path to saved screenshot

##### collectConsoleLog()

Appends browser console log entry.

```typescript
async collectConsoleLog(entry: string): Promise<void>
```

##### collectActionLog()

Appends action log entry.

```typescript
async collectActionLog(entry: string): Promise<void>
```

##### getAllEvidence()

Retrieves all collected evidence.

```typescript
async getAllEvidence(): Promise<EvidenceCollection>
```

#### Example

```typescript
import { EvidenceStore } from 'browsergame-qa';

const evidence = new EvidenceStore('test-123', './output');
await evidence.initialize();

// Capture screenshot
await evidence.captureScreenshot(buffer, 'initial-load');

// Get all evidence
const collection = await evidence.getAllEvidence();
console.log(collection.screenshots);
```

---

### BrowserAgent

Manages browser automation and interaction.

#### Constructor

```typescript
new BrowserAgent(testId: string, evidenceStore: EvidenceStore)
```

#### Methods

##### createSession()

Creates Browserbase session and initializes browser.

```typescript
async createSession(): Promise<void>
```

##### navigateToGame()

Navigates to game URL and waits for load.

```typescript
async navigateToGame(url: string): Promise<void>
```

##### detectGameType()

Analyzes page to detect game type.

```typescript
async detectGameType(): Promise<GameTypeDetectionResult>
```

**Returns**:
```typescript
interface GameTypeDetectionResult {
  gameType: 'platformer' | 'clicker' | 'puzzle' | 'generic';
  confidence: number;
  method: 'dom-analysis' | 'vision-analysis';
}
```

##### executeAction()

Executes a browser action.

```typescript
async executeAction(action: BrowserAction): Promise<ActionResult>
```

##### closeSession()

Closes browser session and cleans up.

```typescript
async closeSession(): Promise<void>
```

#### Example

```typescript
import { BrowserAgent, EvidenceStore } from 'browsergame-qa';

const evidence = new EvidenceStore('test-123');
await evidence.initialize();

const agent = new BrowserAgent('test-123', evidence);

try {
  await agent.createSession();
  await agent.navigateToGame('https://example.com/game');

  const gameType = await agent.detectGameType();
  console.log(`Detected ${gameType.gameType} game`);

  await agent.executeAction({ type: 'click', target: 'center' });
} finally {
  await agent.closeSession();
}
```

---

### AIEvaluator

Analyzes evidence and generates playability scores.

#### Constructor

```typescript
new AIEvaluator()
```

#### Methods

##### evaluatePlayability()

Analyzes evidence and generates scores.

```typescript
async evaluatePlayability(
  evidence: EvidenceCollection
): Promise<EvaluationResult>
```

**Returns**:
```typescript
interface EvaluationResult {
  scores: PlayabilityScores;
  reasoning: string;
  confidence: number;
}
```

##### detectIssues()

Identifies and categorizes issues.

```typescript
async detectIssues(
  evidence: EvidenceCollection,
  scores: PlayabilityScores
): Promise<Issue[]>
```

#### Example

```typescript
import { AIEvaluator, EvidenceStore } from 'browsergame-qa';

const evidence = await evidenceStore.getAllEvidence();
const evaluator = new AIEvaluator();

const evaluation = await evaluator.evaluatePlayability(evidence);
console.log(`Overall score: ${evaluation.scores.overallPlayability}`);
console.log(`Reasoning: ${evaluation.reasoning}`);

const issues = await evaluator.detectIssues(evidence, evaluation.scores);
console.log(`Found ${issues.length} issues`);
```

---

### ReportGenerator

Generates multi-format reports (JSON, Markdown, HTML).

#### Constructor

```typescript
new ReportGenerator(report: QAReport, evidenceStore: EvidenceStore)
```

#### Methods

##### generateAll()

Generates all report formats in parallel.

```typescript
async generateAll(): Promise<ReportPaths>
```

**Returns**:
```typescript
interface ReportPaths {
  json: string;
  markdown: string;
  html: string;
}
```

##### generateJSON()

Generates JSON report only.

```typescript
async generateJSON(): Promise<string>
```

##### generateMarkdown()

Generates Markdown report only.

```typescript
async generateMarkdown(): Promise<string>
```

##### generateHTML()

Generates HTML report only.

```typescript
async generateHTML(): Promise<string>
```

#### Example

```typescript
import { ReportGenerator } from 'browsergame-qa';

const generator = new ReportGenerator(qaReport, evidenceStore);

// Generate all formats
const paths = await generator.generateAll();
console.log(`JSON: ${paths.json}`);
console.log(`HTML: ${paths.html}`);

// Or generate specific format
const jsonPath = await generator.generateJSON();
```

---

## Error Handling

Denethor uses typed error classes for different failure scenarios.

### Error Classes

#### QAError

Base error class for all Denethor errors.

```typescript
class QAError extends Error {
  constructor(message: string, cause?: Error)
}
```

#### ValidationError

Thrown for invalid inputs (URL, configuration).

```typescript
class ValidationError extends QAError {
  constructor(message: string, cause?: Error)
}
```

**When thrown**:
- Invalid game URL
- Internal/private URLs (SSRF protection)
- Missing required configuration

#### GameCrashError

Thrown when game crashes during testing.

```typescript
class GameCrashError extends QAError {
  constructor(message: string, cause?: Error)
}
```

**When thrown**:
- Game JavaScript errors
- Frozen/unresponsive game
- Browser crash

#### RetryableError

Thrown for transient failures that can be retried.

```typescript
class RetryableError extends QAError {
  constructor(message: string, cause?: Error)
}
```

**When thrown**:
- Network timeouts
- Browserbase connection issues
- OpenAI API rate limits

### Error Handling Patterns

#### Pattern 1: Catch Specific Errors

```typescript
import {
  runQATest,
  ValidationError,
  GameCrashError,
  RetryableError
} from 'browsergame-qa';

try {
  const results = await runQATest('https://example.com/game');
  // Process results
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Configuration error:', error.message);
    // Fix configuration and retry
  } else if (error instanceof GameCrashError) {
    console.error('Game crashed - may be a bug:', error.message);
    // Report to game developer
  } else if (error instanceof RetryableError) {
    console.error('Temporary failure:', error.message);
    // Retry after delay
  } else {
    console.error('Unknown error:', error);
    // General error handling
  }
}
```

#### Pattern 2: Retry Logic

```typescript
import { runQATest, RetryableError } from 'browsergame-qa';

async function runTestWithRetry(url: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await runQATest(url);
    } catch (error) {
      if (error instanceof RetryableError && attempt < maxRetries) {
        console.log(`Attempt ${attempt} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        continue;
      }
      throw error;
    }
  }
}
```

---

## Type Definitions

See [types.md](./types.md) for complete type definitions.

### Core Types

```typescript
interface QAReport {
  meta: TestMetadata;
  status: 'success' | 'failure' | 'error';
  scores: PlayabilityScores;
  evaluation: {
    reasoning: string;
    confidence: number;
  };
  issues: Issue[];
  evidence: Evidence;
  actions: Action[];
}

interface PlayabilityScores {
  loadSuccess: number;       // 0-100
  responsiveness: number;    // 0-100
  stability: number;         // 0-100
  overallPlayability: number; // 0-100
}

interface Issue {
  severity: 'critical' | 'major' | 'minor';
  category: string;
  description: string;
  screenshot?: string;
}
```

---

## Usage Examples

### Example 1: Batch Testing Multiple Games

```typescript
import { runQATest } from 'browsergame-qa';

const games = [
  'https://example.com/game1',
  'https://example.com/game2',
  'https://example.com/game3'
];

for (const gameUrl of games) {
  try {
    console.log(`Testing ${gameUrl}...`);
    const results = await runQATest(gameUrl);

    console.log(`Score: ${results.report.scores.overallPlayability}/100`);
    console.log(`Status: ${results.report.status}`);
    console.log(`Report: ${results.reportPaths.html}\n`);
  } catch (error) {
    console.error(`Failed to test ${gameUrl}:`, error.message);
  }
}
```

### Example 2: Custom Result Processing

```typescript
import { runQATest } from 'browsergame-qa';

const results = await runQATest('https://example.com/game');
const { report } = results;

// Categorize result
let verdict: string;
if (report.scores.overallPlayability >= 90) {
  verdict = 'Excellent - Production Ready';
} else if (report.scores.overallPlayability >= 70) {
  verdict = 'Good - Minor Issues';
} else if (report.scores.overallPlayability >= 50) {
  verdict = 'Fair - Needs Work';
} else {
  verdict = 'Poor - Major Issues';
}

console.log(`Verdict: ${verdict}`);

// List critical issues
const criticalIssues = report.issues.filter(i => i.severity === 'critical');
if (criticalIssues.length > 0) {
  console.log('\nCritical Issues:');
  criticalIssues.forEach(issue => {
    console.log(`- ${issue.description}`);
  });
}
```

### Example 3: Exporting Results to Database

```typescript
import { runQATest } from 'browsergame-qa';
import { saveToDatabase } from './db';

const results = await runQATest('https://example.com/game');
const { report, reportPaths } = results;

// Save to database
await saveToDatabase({
  gameUrl: report.meta.gameUrl,
  testId: report.meta.testId,
  timestamp: report.meta.timestamp,
  overallScore: report.scores.overallPlayability,
  status: report.status,
  issueCount: report.issues.length,
  reportUrl: reportPaths.html,
  duration: report.meta.duration
});
```

### Example 4: Integration with CI/CD

```typescript
import { runQATest } from 'browsergame-qa';

async function validateGame(gameUrl: string): Promise<boolean> {
  try {
    const results = await runQATest(gameUrl, {
      maxActions: 10,
      sessionTimeout: 120000
    });

    // Pass if score >= 70
    const passed = results.report.scores.overallPlayability >= 70;

    if (!passed) {
      console.error('QA test failed!');
      console.error(`Score: ${results.report.scores.overallPlayability}/100`);
      console.error(`Issues: ${results.report.issues.length}`);
      process.exit(1);
    }

    console.log('QA test passed!');
    return true;
  } catch (error) {
    console.error('QA test error:', error);
    process.exit(1);
  }
}

// In CI pipeline
const gameUrl = process.env.GAME_URL || 'https://example.com/game';
await validateGame(gameUrl);
```

---

## Best Practices

### 1. Use Appropriate Timeouts

```typescript
// For simple games
await runQATest(url, {
  sessionTimeout: 60000,  // 1 minute
  maxActions: 10
});

// For complex games
await runQATest(url, {
  sessionTimeout: 300000, // 5 minutes
  maxActions: 20
});
```

### 2. Handle Errors Gracefully

```typescript
try {
  const results = await runQATest(url);
  // Process results
} catch (error) {
  // Always handle errors - don't let tests crash your app
  console.error('Test failed:', error);
  // Log to monitoring service
  // Send alert if needed
}
```

### 3. Clean Up Resources

```typescript
// If using QAOrchestrator directly
const orchestrator = new QAOrchestrator({ gameUrl: url });
try {
  const results = await orchestrator.runTest();
  return results;
} finally {
  // Cleanup is automatic, but you can add additional cleanup here
  console.log('Test complete, resources cleaned up');
}
```

### 4. Monitor Performance

```typescript
const startTime = Date.now();
const results = await runQATest(url);
const duration = Date.now() - startTime;

console.log(`Test completed in ${duration}ms`);
console.log(`Actions executed: ${results.report.actions.length}`);
console.log(`Screenshots captured: ${results.report.evidence.screenshots.length}`);
```

---

## Next Steps

- [Type Definitions](./types.md) - Complete TypeScript types
- [Getting Started Guide](../user-guide/getting-started.md) - Learn the basics
- [AWS Lambda Deployment](../deployment/aws-lambda.md) - Deploy to serverless

---

## Support

- [GitHub Issues](https://github.com/yourusername/browsergame-qa/issues)
- [Documentation](../README.md)
- [Examples](../../examples/)
