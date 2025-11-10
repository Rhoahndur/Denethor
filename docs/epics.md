# Denethor - Epic Breakdown

**Author:** Sasha
**Date:** 2025-11-03
**Project Level:** 2
**Target Scale:** Moderate Complexity - Browser Automation QA System

---

## Overview

This document provides the detailed epic breakdown for Denethor, expanding on the high-level epic list in the [PRD](./PRD.md).

Each epic includes:

- Expanded goal and value proposition
- Complete story breakdown with user stories
- Acceptance criteria for each story
- Story sequencing and dependencies

---

## Quick Reference

**Project Stats:**
- **Total Stories:** 44 across 8 epics
- **Estimated Duration:** 7 sprints (35 days with parallelization)
- **Test Coverage Target:** 70%+ (NFR-4)
- **Cost Target:** <$0.10 per test (NFR-3)

**Epic Summary:**
1. **Foundation** (8 stories) - Core infrastructure and utilities
2. **Evidence Collection** (4 stories) - Screenshot and log capture
3. **Browser Automation** (7 stories) - Hybrid action strategy
4. **AI Evaluation** (4 stories) - Playability scoring and issue detection
5. **Report Generation** (4 stories) - JSON, Markdown, HTML outputs
6. **Orchestration** (5 stories) - CLI, API, Lambda interfaces
7. **Testing** (7 stories) - Comprehensive test suite
8. **Infrastructure** (4 stories) - CI/CD and deployment

**Critical Milestones:**
- **Sprint 1 End:** Foundation complete, ready for feature development
- **Sprint 3 End:** Browser can intelligently interact with games
- **Sprint 5 End:** Working MVP with CLI interface
- **Sprint 7 End:** Production-ready system with full automation

**Next Steps After This Document:**
1. Run `/bmad:bmm:workflows:sprint-planning` to initialize sprint tracking
2. Begin Sprint 1 with Epic 1 stories
3. Follow development workflow in section below

---

**Epic Sequencing Principles:**

- Epic 1 establishes foundational infrastructure and initial functionality
- Subsequent epics build progressively, each delivering significant end-to-end value
- Stories within epics are vertically sliced and sequentially ordered
- No forward dependencies - each story builds only on previous work

---

## Implementation Phases & Sequencing

### Phase 1: Foundation (Sprint 1)
**Goal:** Establish base infrastructure and shared utilities

**Stories:** Epic 1 (all 8 stories)
- 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 → 1.8

**Parallel Opportunities:**
- Stories 1.2 (Biome) and 1.3 (Vitest) can run in parallel after 1.1
- Story 1.7 (Types) can run in parallel with 1.5 (Config) after 1.4

**Duration:** ~1-2 sprints
**Blocking:** All other epics depend on Epic 1 completion

---

### Phase 2: Core Components (Sprints 2-3)
**Goal:** Build evidence collection and browser automation

**Epic 2 Stories (Sequential):**
- 2.1 → 2.2 → 2.3 → 2.4

**Epic 3 Stories (Sequential with branching):**
- 3.1 → 3.2 → 3.3 → 3.4
- 3.3 and 3.4 can be developed in parallel
- 3.5 (Hybrid Strategy) requires both 3.3 and 3.4 complete
- 3.6 → 3.7 follows 3.5

**Parallel Opportunities:**
- Epic 2 and Epic 3 can be developed in parallel (no dependencies between them)
- Within Epic 3: 3.3 (Heuristics) || 3.4 (Vision Analyzer) after 3.2

**Duration:** ~2-3 sprints
**Blocking:** Epic 4 and Epic 5 wait for Epic 2 and Epic 3

---

### Phase 3: Intelligence & Output (Sprint 4)
**Goal:** Add AI evaluation and report generation

**Epic 4 Stories (Sequential):**
- 4.1 → 4.2 → 4.3 → 4.4

**Epic 5 Stories (Parallel after 5.1):**
- 5.1 → (5.2 || 5.3 || 5.4)

**Parallel Opportunities:**
- Epic 4 and Epic 5.1 can start in parallel (both only depend on Epic 1)
- Stories 5.2, 5.3, 5.4 are fully parallel after 5.1

**Duration:** ~1-2 sprints
**Blocking:** Epic 6 (Orchestration) waits for Epics 2-5

---

### Phase 4: Integration & Orchestration (Sprint 5)
**Goal:** Tie all components together with user interfaces

**Epic 6 Stories (Sequential with parallel endings):**
- 6.1 → 6.2 → (6.3 || 6.4 || 6.5)

**Parallel Opportunities:**
- Stories 6.3 (CLI), 6.4 (API), 6.5 (Lambda) are fully parallel after 6.2

**Duration:** ~1 sprint
**Blocking:** Epic 7 (Testing) waits for functional completion

---

### Phase 5: Quality Assurance (Sprint 6)
**Goal:** Comprehensive testing and coverage validation

**Epic 7 Stories (Mostly Parallel):**
- 7.1 through 7.6 can run in parallel (test different components)
- 7.7 (Coverage Verification) must run last

**Parallel Opportunities:**
- Stories 7.1-7.6 are fully parallel (testing different components)

**Duration:** ~1 sprint
**Blocking:** Epic 8 (Infrastructure) waits for quality validation

---

### Phase 6: Production Readiness (Sprint 7)
**Goal:** CI/CD, deployment, and documentation

**Epic 8 Stories (Sequential with parallel opportunities):**
- 8.1 (CI/CD) can start early
- 8.2 || 8.3 || 8.4 can run in parallel after 8.1

**Parallel Opportunities:**
- Stories 8.2, 8.3, 8.4 are fully parallel

**Duration:** ~1 sprint
**Result:** Production-ready system with automated testing and deployment

---

## Recommended Sprint Structure

### Sprint 1: Foundation (8 stories)
**Focus:** Project setup, core utilities, type safety

**Critical Path:** 1.1 → 1.4 → 1.5 → 1.6 → 1.8

**Deliverable:** Working foundation with error handling, config, logging, retry logic

---

### Sprint 2: Evidence & Browser Setup (7 stories)
**Focus:** Evidence collection and browser connection

**Stories:** 2.1 → 2.2 → 2.3 → 2.4, 3.1 → 3.2 → 3.7

**Critical Path:** 2.1 → 2.4, 3.1 → 3.2

**Deliverable:** Browser can connect, navigate, and capture evidence

---

### Sprint 3: Intelligent Actions (6 stories)
**Focus:** Hybrid action strategy implementation

**Stories:** 3.3, 3.4 (parallel), then 3.5 → 3.6

**Critical Path:** 3.3 || 3.4 → 3.5 → 3.6

**Deliverable:** Browser can intelligently interact with games

---

### Sprint 4: Evaluation & Reports (8 stories)
**Focus:** AI evaluation and multi-format reports

**Stories:** 4.1 → 4.2 → 4.3 → 4.4, 5.1 → (5.2 || 5.3 || 5.4)

**Critical Path:** 4.1 → 4.4, 5.1 → 5.2

**Deliverable:** Complete QA reports with playability scores

---

### Sprint 5: Orchestration & Interfaces (5 stories)
**Focus:** Integration and user-facing interfaces

**Stories:** 6.1 → 6.2 → (6.3 || 6.4 || 6.5)

**Critical Path:** 6.1 → 6.2 → 6.3

**Deliverable:** Working CLI, API, and Lambda deployment

---

### Sprint 6: Testing & Coverage (7 stories)
**Focus:** Comprehensive test suite

**Stories:** 7.1 || 7.2 || 7.3 || 7.4 || 7.5 || 7.6 → 7.7

**Critical Path:** Any test suite → 7.7

**Deliverable:** 70%+ test coverage with full validation

---

### Sprint 7: Production Infrastructure (4 stories)
**Focus:** CI/CD and deployment readiness

**Stories:** 8.1 → (8.2 || 8.3 || 8.4)

**Critical Path:** 8.1 → 8.2

**Deliverable:** Production-ready system with automated pipelines

---

## Critical Path Summary

**Minimum path to working MVP (45 days / 9 sprints if 5-day sprints):**

1. **Foundation:** 1.1 → 1.4 → 1.5 → 1.6 → 1.8 (Epic 1)
2. **Evidence:** 2.1 → 2.4 (Epic 2)
3. **Browser:** 3.1 → 3.2 → 3.3 → 3.5 → 3.6 (Epic 3)
4. **Evaluation:** 4.1 → 4.4 (Epic 4)
5. **Reports:** 5.1 → 5.2 (Epic 5)
6. **Integration:** 6.1 → 6.2 → 6.3 (Epic 6)
7. **Testing:** 7.1 → 7.7 (Epic 7)
8. **Infrastructure:** 8.1 (Epic 8)

**Optimized path with parallelization (35 days / 7 sprints):**

Uses parallel execution opportunities identified above, reducing total time by ~22%.

---

## Dependency Map

```
Epic 1 (Foundation)
  ↓
  ├─→ Epic 2 (Evidence Store) ─┐
  │                             ├─→ Epic 6 (Orchestration)
  ├─→ Epic 3 (Browser Agent) ──┤       ↓
  │                             │   Epic 7 (Testing)
  ├─→ Epic 4 (AI Evaluator) ───┤       ↓
  │                             │   Epic 8 (Infrastructure)
  └─→ Epic 5 (Report Gen) ─────┘
```

**Key Insights:**
- Epic 1 blocks everything (must complete first)
- Epics 2-5 can run largely in parallel after Epic 1
- Epic 6 requires Epics 2-5 complete
- Epics 7-8 are sequential cleanup/polish

---

## Risk Mitigation

**High-Risk Stories (require extra attention):**
- **3.4 (Vision Analyzer):** External API integration, cost management
- **3.5 (Hybrid Strategy):** Novel pattern, no standard implementation
- **4.3 (Playability Scoring):** Core value proposition, 80% accuracy target
- **6.2 (Test Execution Flow):** Integration point for all components

**Mitigation Strategy:**
- Allocate senior developers to high-risk stories
- Build prototypes before sprint commitment for 3.4, 3.5
- Plan for iteration on 4.3 based on accuracy metrics
- Reserve buffer time in Sprint 5 for 6.2 integration issues

---

## Epic 1: Project Foundation & Infrastructure

**Goal:** Establish the foundational infrastructure and shared components that all other epics depend on.

**Value:** Creates the base layer for development - error handling, configuration, logging, and type safety.

**Dependencies:** None (starting point)

### Stories

**Story 1.1: Initialize Project and Install Core Dependencies**

As a developer,
I want the project initialized with all core dependencies installed,
So that I can begin implementing features with the correct tooling.

**Acceptance Criteria:**
1. All dependencies from architecture.md installed via `bun install`
2. Dependencies include: @browserbasehq/sdk@2.6.0, @browserbasehq/stagehand@2.5.0, ai@5.0.86, @ai-sdk/openai@2.0.59, commander@14.0.2, pino@10.1.0
3. Dev dependencies include: vitest@4.0, @biomejs/biome@2.3.2
4. package.json updated with all dependencies
5. bun.lock file generated
6. All packages install without errors

**Prerequisites:** Bun starter already executed (completed)

---

**Story 1.2: Configure Biome for Linting and Formatting**

As a developer,
I want Biome configured for code quality,
So that all code follows consistent standards automatically.

**Acceptance Criteria:**
1. biome.json created with project-specific rules
2. Linting enabled for TypeScript files
3. Formatting rules match architecture decisions (ESNext, strict mode)
4. `bun biome check .` command works
5. `bun biome format --write .` command works
6. Configuration excludes node_modules, .git, build directories

**Prerequisites:** Story 1.1

---

**Story 1.3: Configure Vitest for Testing**

As a developer,
I want Vitest configured for running tests,
So that I can write and execute tests for all components.

**Acceptance Criteria:**
1. vitest.config.ts created per architecture template
2. Test environment set to 'node'
3. Coverage provider set to 'v8'
4. Coverage reporters include text, json, html
5. `bun test` command executes Vitest
6. `bun test --coverage` generates coverage reports

**Prerequisites:** Story 1.1

---

**Story 1.4: Create Custom Error Classes**

As a developer,
I want typed error classes for different failure scenarios,
So that error handling logic can distinguish between retry-able and fatal errors.

**Acceptance Criteria:**
1. Create `src/errors/QAError.ts` with base error class
2. Create `src/errors/RetryableError.ts` for network/timeout errors
3. Create `src/errors/GameCrashError.ts` for game crash errors (fail fast)
4. Create `src/errors/ValidationError.ts` for input validation errors
5. Each error class includes message and optional cause parameter
6. Error classes follow pattern from architecture.md
7. Unit tests cover all error classes

**Prerequisites:** Story 1.3

---

**Story 1.5: Create Centralized Configuration Module**

As a developer,
I want centralized environment variable management,
So that API keys and config are accessed safely and consistently.

**Acceptance Criteria:**
1. Create `src/utils/config.ts` with config object
2. Load BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, OPENAI_API_KEY from env
3. Provide default for OUTPUT_DIR (./output)
4. Validate required keys at module load (throw ValidationError if missing)
5. Create `.env.example` with placeholder values
6. Add `.env` to .gitignore
7. Config module follows architecture pattern
8. Unit tests verify validation logic

**Prerequisites:** Story 1.4

---

**Story 1.6: Set Up Pino Logger**

As a developer,
I want structured logging with Pino,
So that all components can log consistently with proper levels.

**Acceptance Criteria:**
1. Create `src/utils/logger.ts` with Pino instance
2. Configure log level from LOG_LEVEL env var (default: 'info')
3. Add pino-pretty transport for development
4. Export logger instance for use across components
5. Support child loggers with component context
6. Follow logging pattern from architecture.md
7. Unit tests verify logger creation and child logger functionality

**Prerequisites:** Story 1.5

---

**Story 1.7: Define Shared TypeScript Types**

As a developer,
I want shared type definitions for core data structures,
So that components communicate with type safety.

**Acceptance Criteria:**
1. Create `src/types/qaReport.ts` with QAReport interface matching PRD
2. Create `src/types/config.ts` with Config interface
3. Create `src/types/index.ts` that exports all shared types
4. Types include: QAReport, TestMetadata, PlayabilityScores, Issue, Evidence, Action
5. All types use PascalCase naming
6. Types match data structures from architecture.md
7. TypeScript compilation succeeds with strict mode

**Prerequisites:** Story 1.3

---

**Story 1.8: Create Retry Utility with Exponential Backoff**

As a developer,
I want a retry utility for handling transient failures,
So that components can implement the hybrid error recovery strategy.

**Acceptance Criteria:**
1. Create `src/utils/retry.ts` with retry function
2. Implement exponential backoff (1s, 2s, 4s delays)
3. Max 3 retry attempts as per architecture
4. Only retry on RetryableError instances
5. Propagate other error types immediately
6. Log retry attempts with Pino
7. Unit tests cover retry logic, backoff timing, error propagation

**Prerequisites:** Story 1.4, Story 1.6

---

## Epic 2: Evidence Collection System

**Goal:** Build the Evidence Store to capture screenshots and logs during test execution.

**Value:** Provides the evidence capture mechanism needed by Browser Agent and Report Generator.

**Dependencies:** Epic 1 (Foundation)

### Stories

**Story 2.1: Create Evidence Store Core Module**

As a QA agent,
I want a centralized evidence store,
So that screenshots and logs are organized and accessible.

**Acceptance Criteria:**
1. Create `src/evidence-store/evidenceStore.ts` with EvidenceStore class
2. Initialize with test ID and output directory
3. Create directory structure: `output/test-{uuid}-{timestamp}/`
4. Create subdirectories: screenshots/, logs/, reports/
5. Store test metadata in metadata.json
6. Use logger for evidence operations
7. Handle file system errors with proper error types
8. Unit tests cover directory creation and metadata storage

**Prerequisites:** Epic 1 complete

---

**Story 2.2: Implement Screenshot Capture with Auto-Naming**

As a Browser Agent,
I want to capture and save screenshots with automatic naming,
So that evidence is collected without manual filename management.

**Acceptance Criteria:**
1. Add captureScreenshot() method to EvidenceStore
2. Generate filenames: `{sequence}-{action-description}.png` (00-99)
3. Sequence numbers are zero-padded 2 digits
4. Action descriptions use kebab-case, max 30 chars
5. Save screenshots to screenshots/ directory
6. Return screenshot path for reference
7. Log screenshot capture events
8. Unit tests verify naming format and file saving

**Prerequisites:** Story 2.1

---

**Story 2.3: Implement Log Collection**

As a QA Orchestrator,
I want to collect console logs, action logs, and error logs,
So that complete test evidence is preserved.

**Acceptance Criteria:**
1. Add methods: collectConsoleLog(), collectActionLog(), collectErrorLog()
2. Save logs to logs/ directory with fixed names: console.log, actions.log, errors.log
3. Append mode for logs (don't overwrite)
4. ISO 8601 timestamps for each log entry
5. Structured format for easy parsing
6. Handle concurrent writes safely
7. Unit tests cover all log types and appending behavior

**Prerequisites:** Story 2.1

---

**Story 2.4: Add Evidence Retrieval Methods**

As a Report Generator,
I want to retrieve collected evidence,
So that I can include it in generated reports.

**Acceptance Criteria:**
1. Add getScreenshots() method returning array of screenshot paths
2. Add getLogPath(logType) method for log file paths
3. Add getMetadata() method returning test metadata
4. Add getAllEvidence() method returning complete evidence object
5. Methods return typed responses (not raw strings)
6. Handle missing files gracefully (return empty arrays/null)
7. Unit tests verify retrieval methods

**Prerequisites:** Story 2.2, Story 2.3

---

## Epic 3: Browser Automation & Interaction

**Goal:** Implement the Browser Agent with Stagehand integration and the innovative Hybrid Action Strategy.

**Value:** Core automation capability - enables intelligent gameplay simulation across different game types.

**Dependencies:** Epic 1 (Foundation), Epic 2 (Evidence Store)

### Stories

**Story 3.1: Create Browser Agent with Browserbase Connection**

As a QA Orchestrator,
I want to connect to Browserbase and create browser sessions,
So that games can be loaded in cloud browsers.

**Acceptance Criteria:**
1. Create `src/browser-agent/browserAgent.ts` with BrowserAgent class
2. Initialize Browserbase SDK with API key and project ID from config
3. Implement createSession() method to start browser session
4. Implement closeSession() method to clean up
5. Handle Browserbase connection errors with RetryableError
6. Use logger for browser operations
7. Unit tests cover session creation and cleanup

**Prerequisites:** Epic 1 complete, Epic 2 complete

---

**Story 3.2: Integrate Stagehand for Browser Control**

As a Browser Agent,
I want to control the browser with Stagehand,
So that I can navigate to games and interact with elements.

**Acceptance Criteria:**
1. Initialize Stagehand with Browserbase session
2. Implement navigateToGame(url) method with 60s timeout
3. Implement waitForLoad() using networkidle state
4. Capture initial screenshot after page load
5. Monitor console logs and store to Evidence Store
6. Retry navigation failures up to 3 times per architecture
7. Unit tests cover navigation and retry logic

**Prerequisites:** Story 3.1

---

**Story 3.3: Implement Core Heuristic Patterns (Layer 1)**

As a Browser Agent,
I want predefined heuristic patterns for common game types,
So that basic interactions work without expensive LLM calls.

**Acceptance Criteria:**
1. Create `src/browser-agent/heuristics/coreHeuristics.ts`
2. Define PLATFORMER_HEURISTIC (click center, arrow keys, space for jump)
3. Define CLICKER_HEURISTIC (repeated clicks, wait, screenshot)
4. Define PUZZLE_HEURISTIC (click elements, observe changes)
5. Define GENERIC_HEURISTIC (try common inputs, detect response)
6. Each heuristic includes triggers, actions, confidence scoring
7. Heuristics return ActionResult with success/confidence
8. Unit tests cover all heuristic patterns

**Prerequisites:** Story 3.2

---

**Story 3.4: Build Vision Analyzer for Screenshot Analysis (Layer 2)**

As a Browser Agent,
I want to analyze screenshots with GPT-4o-mini,
So that I can validate actions and get guidance when heuristics are uncertain.

**Acceptance Criteria:**
1. Create `src/browser-agent/visionAnalyzer.ts`
2. Initialize Vercel AI SDK with OpenAI provider
3. Implement analyzeScreenshot(image, context) method
4. Use GPT-4o-mini for cost efficiency
5. Prompt includes: previous action, current state, recommended next action, confidence
6. Return structured JSON response with reasoning
7. Handle API errors with RetryableError for rate limits
8. Unit tests cover vision analysis and error handling

**Prerequisites:** Story 3.3

---

**Story 3.5: Create Hybrid Action Strategy Orchestrator**

As a Browser Agent,
I want to orchestrate the 3-layer action strategy,
So that actions escalate from fast heuristics to intelligent vision analysis.

**Acceptance Criteria:**
1. Create `src/browser-agent/actionStrategy.ts`
2. Implement executeHybridStrategy(page) method
3. Layer 1: Try heuristics first, return if confidence > 80%
4. Layer 2: Use vision analysis if heuristic uncertain, return if confidence > 70%
5. Layer 3: Placeholder for RAG (stretch goal - not implemented in MVP)
6. Throw GameCrashError if all layers uncertain
7. Log strategy decisions (which layer used, confidence)
8. Unit tests cover escalation logic and confidence thresholds

**Prerequisites:** Story 3.3, Story 3.4

---

**Story 3.6: Implement Action Execution with Evidence Capture**

As a Browser Agent,
I want to execute actions and capture evidence,
So that each interaction is documented.

**Acceptance Criteria:**
1. Implement executeAction(action) method in BrowserAgent
2. Support action types: click, keyboard, wait, screenshot
3. Capture screenshot before and after significant actions
4. Log each action to Evidence Store action log
5. Track action success/failure
6. Handle execution errors appropriately (retry vs fail fast)
7. Unit tests cover all action types and error scenarios

**Prerequisites:** Story 3.5

---

**Story 3.7: Add Game Type Detection Logic**

As a Browser Agent,
I want to detect game type from initial page analysis,
So that the appropriate heuristic pattern is selected.

**Acceptance Criteria:**
1. Implement detectGameType() method
2. Analyze DOM structure for game indicators (canvas, controls, etc.)
3. Use vision analysis of initial screenshot as fallback
4. Return game type: platformer, clicker, puzzle, generic
5. Map game type to appropriate heuristic pattern
6. Log detected game type
7. Unit tests cover detection logic for different game types

**Prerequisites:** Story 3.4

---

## Epic 4: AI Evaluation Engine

**Goal:** Build the AI Evaluator to analyze playability and generate scores.

**Value:** Provides intelligent assessment of game quality with 80%+ accuracy target.

**Dependencies:** Epic 1 (Foundation), Epic 2 (Evidence Store)

### Stories

**Story 4.1: Create AI Evaluator Core Module**

As a QA Orchestrator,
I want an AI evaluator module,
So that game playability can be assessed automatically.

**Acceptance Criteria:**
1. Create `src/ai-evaluator/aiEvaluator.ts` with AIEvaluator class
2. Initialize with Vercel AI SDK and OpenAI provider
3. Configure to use GPT-4o for final evaluation (higher accuracy)
4. Set up logger for evaluation operations
5. Handle API errors with appropriate error types
6. Unit tests cover initialization and configuration

**Prerequisites:** Epic 1 complete

---

**Story 4.2: Define Evaluation Prompts**

As an AI Evaluator,
I want structured prompts for assessing playability,
So that evaluations are consistent and comprehensive.

**Acceptance Criteria:**
1. Create `src/ai-evaluator/prompts.ts`
2. Define PLAYABILITY_EVALUATION_PROMPT covering:
   - Load success analysis
   - Responsiveness assessment
   - Stability evaluation
   - Overall playability scoring
3. Include context: screenshots, action logs, console errors
4. Request structured JSON response with scores 0-100
5. Require reasoning and confidence in response
6. Prompts align with PRD success criteria
7. Unit tests verify prompt structure

**Prerequisites:** Story 4.1

---

**Story 4.3: Implement Playability Scoring Logic**

As an AI Evaluator,
I want to generate playability scores from evidence,
So that games can be rated objectively.

**Acceptance Criteria:**
1. Implement evaluatePlayability(evidence) method
2. Analyze: screenshots, action logs, console logs, error logs
3. Generate scores: loadSuccess, responsiveness, stability, overallPlayability (0-100)
4. Include reasoning for each score
5. Return confidence level (0-100) for evaluation
6. Use GPT-4o for analysis per architecture
7. Unit tests cover scoring logic with sample evidence

**Prerequisites:** Story 4.2

---

**Story 4.4: Implement Issue Detection and Categorization**

As an AI Evaluator,
I want to detect and categorize issues,
So that problems are clearly communicated in reports.

**Acceptance Criteria:**
1. Implement detectIssues(evidence, scores) method
2. Categorize issues by severity: critical, major, minor
3. Categorize by type: performance, stability, usability, compatibility
4. Link issues to supporting screenshot evidence
5. Generate clear issue descriptions
6. Return array of Issue objects per QAReport type
7. Unit tests cover issue detection for various scenarios

**Prerequisites:** Story 4.3

---

## Epic 5: Report Generation

**Goal:** Create multi-format report generation (JSON, Markdown, HTML).

**Value:** Delivers test results in multiple consumable formats for different audiences.

**Dependencies:** Epic 1 (Foundation), Epic 2 (Evidence Store), Epic 4 (AI Evaluator)

### Stories

**Story 5.1: Create Report Generator Core Module**

As a QA Orchestrator,
I want a report generator module,
So that test results can be output in multiple formats.

**Acceptance Criteria:**
1. Create `src/report-generator/reportGenerator.ts` with ReportGenerator class
2. Initialize with test results and evidence
3. Implement generateAll() method for parallel format generation
4. Save reports to reports/ directory
5. Return paths to all generated reports
6. Use logger for generation operations
7. Unit tests cover initialization and parallel generation

**Prerequisites:** Epic 1 complete

---

**Story 5.2: Implement JSON Report Generation**

As a developer,
I want JSON reports for programmatic access,
So that results can be processed by other tools.

**Acceptance Criteria:**
1. Create `src/report-generator/jsonGenerator.ts`
2. Implement generateJSON(report) method
3. Output format matches QAReport interface exactly
4. Include all metadata, scores, evaluation, issues, evidence, actions
5. Pretty-print JSON with 2-space indentation
6. Save to `report.json`
7. Unit tests verify JSON structure and completeness

**Prerequisites:** Story 5.1

---

**Story 5.3: Implement Markdown Report Generation**

As a human reviewer,
I want Markdown reports for readability,
So that I can easily review test results.

**Acceptance Criteria:**
1. Create `src/report-generator/markdownGenerator.ts`
2. Implement generateMarkdown(report) method using template literals
3. Include sections: Summary, Scores, Evaluation, Issues, Actions
4. Format scores as table
5. List issues by severity with emoji indicators
6. Include relative paths to screenshots
7. Save to `report.md`
8. Unit tests verify Markdown formatting

**Prerequisites:** Story 5.1

---

**Story 5.4: Implement HTML Report Generation**

As a stakeholder,
I want interactive HTML reports with embedded screenshots,
So that I can view results in a browser.

**Acceptance Criteria:**
1. Create `src/report-generator/htmlGenerator.ts`
2. Implement generateHTML(report) method using custom builder function
3. Include CSS styling for professional appearance
4. Embed screenshots as base64 or file references
5. Make scores visually prominent (color-coded)
6. Group issues by severity with expandable sections
7. Save to `report.html`
8. Unit tests verify HTML structure and screenshot embedding

**Prerequisites:** Story 5.1

---

## Epic 6: Orchestration & User Interface

**Goal:** Build the QA Orchestrator to coordinate components and provide CLI/Lambda interfaces.

**Value:** Ties all components together into a usable QA automation tool.

**Dependencies:** Epic 1-5 (all core components)

### Stories

**Story 6.1: Create QA Orchestrator Core Module**

As a user,
I want a coordinating orchestrator,
So that all components work together seamlessly.

**Acceptance Criteria:**
1. Create `src/orchestrator/qaOrchestrator.ts` with QAOrchestrator class
2. Initialize with configuration and all component dependencies
3. Implement execute(gameUrl) method as main entry point
4. Coordinate: Evidence Store, Browser Agent, AI Evaluator, Report Generator
5. Enforce 5-minute global timeout per NFR-1
6. Handle component failures gracefully
7. Return QAReport on success, throw appropriate errors on failure
8. Unit tests cover orchestration flow and timeout enforcement

**Prerequisites:** Epic 1-5 complete

---

**Story 6.2: Implement Test Execution Flow**

As a QA Orchestrator,
I want to manage the complete test lifecycle,
So that tests run from start to finish automatically.

**Acceptance Criteria:**
1. Validate input URL (SSRF protection per architecture)
2. Create Evidence Store with unique test ID
3. Initialize Browser Agent and navigate to game
4. Execute gameplay simulation (max 20 actions per PRD)
5. Collect all evidence throughout execution
6. Run AI Evaluation on collected evidence
7. Generate all report formats
8. Clean up browser session
9. Log complete execution flow
10. Unit tests cover full execution path

**Prerequisites:** Story 6.1

---

**Story 6.3: Build CLI with Commander.js**

As a developer,
I want a command-line interface,
So that I can run QA tests from the terminal.

**Acceptance Criteria:**
1. Create `cli/index.ts` as CLI entry point
2. Implement using Commander.js 14.0.2
3. Support command: `bun run cli/index.ts <gameUrl>`
4. Options: --output <dir>, --format <json,md,html>, --timeout <seconds>, --log-level <level>
5. Display progress indicators during execution
6. Show summary on completion
7. Exit with appropriate codes (0=success, 1=failure)
8. Help text auto-generated by Commander
9. Integration tests cover CLI invocation

**Prerequisites:** Story 6.2

---

**Story 6.4: Create Programmatic API Export**

As a developer,
I want to import and use the QA agent programmatically,
So that I can integrate it into other tools.

**Acceptance Criteria:**
1. Create `index.ts` as main entry point
2. Export runQA() function with type signature from architecture
3. Support options: outputDir, formats, timeout, logLevel
4. Return QAReport on success
5. Throw typed errors on failure
6. Function matches API contract from architecture.md
7. Examples in README for programmatic usage
8. Integration tests cover programmatic API

**Prerequisites:** Story 6.2

---

**Story 6.5: Create Lambda Handler Function**

As a cloud user,
I want to deploy the QA agent to AWS Lambda,
So that I can run tests serverlessly.

**Acceptance Criteria:**
1. Create `lambda/handler.ts` with Lambda handler
2. Accept event with gameUrl property
3. Configure for Lambda constraints: /tmp directory, 280s timeout buffer
4. Return structured response with statusCode and body
5. Handle errors gracefully (return 500 with error details)
6. Compatible with Node.js 20 Lambda runtime
7. Follow Lambda handler pattern from architecture.md
8. Integration tests cover handler invocation

**Prerequisites:** Story 6.2

---

## Epic 7: Testing & Quality Assurance

**Goal:** Comprehensive testing across all components to ensure reliability.

**Value:** Maintains 70%+ test coverage target and validates functionality.

**Dependencies:** Epic 1-6 (all implementation complete)

### Stories

**Story 7.1: Write Unit Tests for Foundation Components**

As a developer,
I want complete unit test coverage for foundation components,
So that core utilities are reliable.

**Acceptance Criteria:**
1. Test coverage for all files in src/errors/, src/utils/, src/types/
2. Error class instantiation and properties
3. Config validation logic
4. Logger initialization and child loggers
5. Retry logic with mocked timers
6. Achieve >90% coverage for foundation
7. All tests pass with `bun test`

**Prerequisites:** Epic 1 complete

---

**Story 7.2: Write Unit Tests for Evidence Store**

As a developer,
I want comprehensive tests for Evidence Store,
So that evidence collection is reliable.

**Acceptance Criteria:**
1. Test directory creation and structure
2. Screenshot capture and naming format
3. Log collection and appending
4. Evidence retrieval methods
5. File system error handling
6. Achieve >80% coverage for Evidence Store
7. All tests pass

**Prerequisites:** Epic 2 complete

---

**Story 7.3: Write Unit Tests for Browser Agent**

As a developer,
I want thorough tests for Browser Agent,
So that browser automation is dependable.

**Acceptance Criteria:**
1. Mock Browserbase and Stagehand dependencies
2. Test session creation and cleanup
3. Test heuristic pattern execution
4. Test vision analyzer with mocked API
5. Test hybrid strategy escalation logic
6. Test action execution and error handling
7. Achieve >75% coverage for Browser Agent
8. All tests pass

**Prerequisites:** Epic 3 complete

---

**Story 7.4: Write Unit Tests for AI Evaluator**

As a developer,
I want complete tests for AI Evaluator,
So that scoring is accurate and consistent.

**Acceptance Criteria:**
1. Mock OpenAI API responses
2. Test playability scoring with various evidence inputs
3. Test issue detection and categorization
4. Test confidence scoring
5. Test error handling for API failures
6. Achieve >80% coverage for AI Evaluator
7. All tests pass

**Prerequisites:** Epic 4 complete

---

**Story 7.5: Write Unit Tests for Report Generator**

As a developer,
I want tests for all report formats,
So that outputs are correct and complete.

**Acceptance Criteria:**
1. Test JSON report structure and completeness
2. Test Markdown formatting and content
3. Test HTML generation and screenshot embedding
4. Test parallel generation
5. Test file saving and path resolution
6. Achieve >85% coverage for Report Generator
7. All tests pass

**Prerequisites:** Epic 5 complete

---

**Story 7.6: Write Integration Tests for Complete Flows**

As a developer,
I want integration tests for end-to-end scenarios,
So that component interactions are validated.

**Acceptance Criteria:**
1. Create tests/integration/ directory
2. Test complete QA execution flow with sample game
3. Test CLI invocation and output
4. Test programmatic API usage
5. Test error scenarios (invalid URL, game crash, timeout)
6. Mock external APIs (Browserbase, OpenAI)
7. All integration tests pass

**Prerequisites:** Epic 6 complete

---

**Story 7.7: Verify Overall Test Coverage Target**

As a project owner,
I want to confirm 70%+ test coverage,
So that NFR-4 requirement is met.

**Acceptance Criteria:**
1. Run `bun test --coverage`
2. Overall coverage >70% (lines, functions, branches)
3. Coverage report generated in coverage/ directory
4. Identify any gaps below threshold
5. Document test coverage in README
6. Coverage meets NFR-4 requirement from PRD

**Prerequisites:** Stories 7.1-7.6 complete

---

## Epic 8: Infrastructure & DevOps

**Goal:** Set up CI/CD pipeline and deployment infrastructure for production use.

**Value:** Enables automated testing, quality checks, and production deployments.

**Dependencies:** Epic 1-7 (all development and testing complete)

### Stories

**Story 8.1: Create CI/CD Pipeline with GitHub Actions**

As a developer,
I want automated testing on every commit,
So that code quality is maintained automatically.

**Acceptance Criteria:**
1. Create `.github/workflows/test.yml`
2. Run on pull requests and main branch pushes
3. Install dependencies with Bun
4. Run Biome linting checks
5. Run Vitest with coverage
6. Fail pipeline if coverage < 70%
7. Display test results in PR comments
8. Cache dependencies for faster builds

**Prerequisites:** Epic 7 complete

---

**Story 8.2: Create Lambda Deployment Configuration**

As a DevOps engineer,
I want Lambda deployment configuration,
So that the QA agent can be deployed to AWS.

**Acceptance Criteria:**
1. Create deployment documentation in README
2. Document required environment variables for Lambda
3. Specify Lambda configuration: Node.js 20, 2048 MB memory, 5 min timeout
4. Provide build command: `bun build --target=node`
5. Document packaging: `zip -r function.zip .`
6. Include deployment steps
7. Test Lambda deployment in staging environment

**Prerequisites:** Story 6.5

---

**Story 8.3: Add Environment Variable Documentation**

As a new developer,
I want clear documentation of all environment variables,
So that I can set up the project easily.

**Acceptance Criteria:**
1. Update .env.example with all required variables
2. Document each variable in README
3. Include setup instructions for development
4. Include setup instructions for Lambda deployment
5. Note which variables are required vs optional
6. Provide example values where appropriate
7. Security notes for API key management

**Prerequisites:** Story 8.2

---

**Story 8.4: Create Development Setup Documentation**

As a new team member,
I want complete setup documentation,
So that I can start contributing quickly.

**Acceptance Criteria:**
1. Prerequisites section (Bun 1.0+, API keys)
2. Step-by-step setup commands from architecture.md
3. Verification steps to confirm working setup
4. Common troubleshooting tips
5. Development workflow (run tests, linting, formatting)
6. Contributing guidelines
7. Documentation matches architecture.md setup section

**Prerequisites:** Epic 1-7 complete

---

---

## Development Guidance

### How to Use This Document

**For Sprint Planning:**
1. Review recommended sprint structure (Sprints 1-7 above)
2. Identify parallel opportunities to optimize velocity
3. Assign stories based on team capacity and expertise
4. Reserve high-risk stories for senior developers

**For Story Implementation:**
1. Read story title and user story (As a... I want... So that...)
2. Review ALL acceptance criteria before starting
3. Check prerequisites - ensure dependent stories are complete
4. Reference architecture.md for technical patterns
5. Follow Definition of Done (below) for completion

**For Progress Tracking:**
1. Mark stories as started when implementation begins
2. Update sprint-status.yaml as stories complete
3. Run tests continuously during development
4. Document any blockers or deviations immediately

---

### Development Workflow

**Before Starting a Story:**
```bash
# 1. Ensure foundation is working
bun install
bun test

# 2. Create feature branch
git checkout -b story-X.Y-short-description

# 3. Review acceptance criteria
# Open docs/epics.md and read the specific story section
```

**During Implementation:**
```bash
# Run tests frequently
bun test

# Run linting and formatting
bun biome check .
bun biome format --write .

# Commit regularly with clear messages
git commit -m "story X.Y: implement [specific feature]"
```

**After Completing a Story:**
```bash
# 1. Verify all acceptance criteria met
# 2. Run full test suite
bun test --coverage

# 3. Run quality checks
bun biome check .

# 4. Update sprint status
# Mark story as complete in sprint-status.yaml

# 5. Create PR or merge to main (per team workflow)
```

---

### Definition of Done (DoD)

A story is considered DONE when:

**Code Complete:**
- [ ] All acceptance criteria implemented
- [ ] Code follows architecture.md patterns
- [ ] TypeScript strict mode passes with no errors
- [ ] Biome linting passes (`bun biome check .`)
- [ ] No console.log or debug code remaining

**Tests Complete:**
- [ ] Unit tests written for all new functions/classes
- [ ] Tests cover happy path and error cases
- [ ] All tests passing (`bun test`)
- [ ] Coverage meets or exceeds targets (70%+ overall)

**Documentation Complete:**
- [ ] Code comments for complex logic
- [ ] JSDoc comments for public APIs
- [ ] README updated if new setup steps required
- [ ] .env.example updated if new env vars added

**Integration Verified:**
- [ ] Prerequisites from dependent stories still work
- [ ] Integration with existing components verified
- [ ] No breaking changes to downstream stories
- [ ] Evidence collection working (if applicable)

**Review Complete:**
- [ ] Self-review of all changes
- [ ] Peer review completed (if team workflow requires)
- [ ] All review feedback addressed
- [ ] Story marked complete in sprint-status.yaml

---

### Testing Expectations

**Unit Tests (Required for ALL stories):**
- Test individual functions and classes in isolation
- Mock external dependencies (Browserbase, OpenAI, file system)
- Cover edge cases and error conditions
- Fast execution (< 1 second per test file)

**Integration Tests (Required for Epic 6+ stories):**
- Test component interactions
- Use test fixtures for realistic data
- Mock external APIs but test real component integration
- Acceptable slower execution (< 30 seconds per test)

**Coverage Targets:**
- Foundation (Epic 1): >90%
- Evidence & Browser (Epics 2-3): >75%
- AI & Reports (Epics 4-5): >80%
- Orchestration (Epic 6): >70%
- Overall Project: >70% (NFR-4 requirement)

**Test Organization:**
```
src/
  component/
    component.ts
    component.test.ts    # Unit tests next to implementation
tests/
  integration/
    complete-flow.test.ts  # Integration tests in separate directory
```

---

### Architecture Reference

**Key Architectural Patterns:**

All stories must follow patterns defined in `docs/architecture.md`:

1. **Error Handling:** Use custom error classes (RetryableError, GameCrashError, ValidationError)
2. **Configuration:** Access via centralized config module
3. **Logging:** Use Pino with component-specific child loggers
4. **Async Operations:** Always use retry utility for transient failures
5. **Type Safety:** All functions have TypeScript type signatures
6. **File Naming:** camelCase for code, kebab-case for outputs

**Example Code Patterns:**

See architecture.md Section 7 (Implementation Patterns) for:
- API format templates
- Screenshot capture pattern
- Type definitions
- Config access pattern
- Async/await with retry
- Structured logging

---

### Supporting Documentation

**Primary References:**
- **PRD.md** - Product requirements and success criteria
- **architecture.md** - Technical decisions and implementation patterns
- **epics.md** - This document (story breakdown and sequencing)

**For Specific Stories:**
- **Epic 1 stories:** See architecture.md Section 7.4 (Config), 7.6 (Logging)
- **Epic 2 stories:** See architecture.md Section 7.2 (Screenshots)
- **Epic 3 stories:** See architecture.md Section 6 (Novel Patterns - Hybrid Strategy)
- **Epic 4 stories:** See architecture.md Section 3.6 (AI Evaluation)
- **Epic 5 stories:** See architecture.md Section 7.1 (API Format)
- **Epic 6 stories:** See architecture.md Section 7.1 (API), 8.2 (Lambda)
- **Epic 7 stories:** See architecture.md Section 3.2 (Vitest)
- **Epic 8 stories:** See architecture.md Section 8 (Deployment)

---

### Common Pitfalls to Avoid

**During Implementation:**
- ❌ Don't skip prerequisite stories - dependencies matter
- ❌ Don't implement features not in acceptance criteria (scope creep)
- ❌ Don't use deprecated packages or older versions than specified
- ❌ Don't bypass error handling ("it works on my machine")
- ❌ Don't hardcode values - use config module

**During Testing:**
- ❌ Don't write tests that depend on external services (use mocks)
- ❌ Don't skip error case testing
- ❌ Don't commit with failing tests
- ❌ Don't fake coverage numbers

**During Integration:**
- ❌ Don't break existing tests when adding features
- ❌ Don't assume other components will adapt to your changes
- ❌ Don't skip regression testing of dependent stories

---

### Getting Help

**If You're Blocked:**
1. Review acceptance criteria - are you solving the right problem?
2. Check architecture.md for the correct pattern
3. Review prerequisite stories - is foundation solid?
4. Check GitHub issues for similar problems
5. Ask team for help (better to ask early than deliver late)

**If Acceptance Criteria Are Unclear:**
1. Reference the PRD for original requirements
2. Check architecture.md for technical context
3. Consult with Product Manager (for functional questions)
4. Consult with Architect (for technical questions)
5. Document clarifications in story comments

**If You Discover New Work:**
1. Don't silently expand scope
2. Document the discovery
3. Discuss with team: Is it critical? Can it be a new story?
4. Update epic if new story is needed
5. Re-estimate timeline impact

---

## Story Guidelines Reference

**Story Format:**

```
**Story [EPIC.N]: [Story Title]**

As a [user type],
I want [goal/desire],
So that [benefit/value].

**Acceptance Criteria:**
1. [Specific testable criterion]
2. [Another specific criterion]
3. [etc.]

**Prerequisites:** [Dependencies on previous stories, if any]
```

**Story Requirements:**

- **Vertical slices** - Complete, testable functionality delivery
- **Sequential ordering** - Logical progression within epic
- **No forward dependencies** - Only depend on previous work
- **AI-agent sized** - Completable in 2-4 hour focused session
- **Value-focused** - Integrate technical enablers into value-delivering stories

---

**For implementation:** Use the `create-story` workflow to generate individual story implementation plans from this epic breakdown.
