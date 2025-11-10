# Story 3-1: Create Browser Agent with BrowserBase Connection

**Epic**: Epic 3 - Browser Automation & Interaction
**Status**: drafted
**Story ID**: 3-1-create-browser-agent-with-browserbase-connection

## Story

As a QA Orchestrator, I want to connect to Browserbase and create browser sessions, so that games can be loaded in cloud browsers.

## Acceptance Criteria

1. ✅ Create `src/browser-agent/browserAgent.ts` with BrowserAgent class
2. ✅ Initialize Browserbase SDK with API key and project ID from config
3. ✅ Implement createSession() method to start browser session
4. ✅ Implement closeSession() method to clean up
5. ✅ Handle Browserbase connection errors with RetryableError
6. ✅ Use logger for browser operations
7. ✅ Unit tests cover session creation and cleanup

## Prerequisites

- Epic 1: Foundation (complete)
- Epic 2: Evidence Store (complete)

## Tasks

### Task 1: Set up browser-agent module structure
- [ ] Create `src/browser-agent/` directory
- [ ] Create `browserAgent.ts` file
- [ ] Install @browserbasehq/sdk dependency
- [ ] Import necessary types and utilities

### Task 2: Create BrowserAgent class structure
- [ ] Define BrowserAgent class with constructor
- [ ] Add private fields for Browserbase client and session
- [ ] Add testId and evidenceStore references
- [ ] Set up logger instance for component

### Task 3: Initialize Browserbase SDK
- [ ] Import Browserbase SDK
- [ ] Initialize Browserbase client with API key and project ID from config
- [ ] Handle initialization errors
- [ ] Add debug logging for initialization

### Task 4: Implement createSession() method
- [ ] Define createSession() async method
- [ ] Call Browserbase SDK to create session
- [ ] Store session reference
- [ ] Add timeout handling (60s)
- [ ] Wrap connection errors in RetryableError
- [ ] Log session creation success/failure

### Task 5: Implement closeSession() method
- [ ] Define closeSession() async method
- [ ] Check if session exists before closing
- [ ] Call Browserbase SDK to close session
- [ ] Clean up session reference
- [ ] Handle close errors gracefully
- [ ] Log session cleanup

### Task 6: Add error handling
- [ ] Wrap Browserbase connection errors with RetryableError
- [ ] Add appropriate error messages
- [ ] Handle timeout scenarios
- [ ] Add error context for debugging

### Task 7: Write comprehensive unit tests
- [ ] Create `browserAgent.test.ts`
- [ ] Mock Browserbase SDK
- [ ] Test successful session creation
- [ ] Test session creation failure
- [ ] Test session creation timeout
- [ ] Test successful session close
- [ ] Test close when no session exists
- [ ] Test RetryableError wrapping
- [ ] Verify logging calls

## Dev Notes

### Technical Context

**Browserbase SDK:**
- Package: `@browserbasehq/sdk`
- Provides cloud browser sessions
- Requires API key and project ID
- Session creation returns session ID and connection URL

**Integration Points:**
- Uses `config` module for credentials (BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID)
- Uses `logger` for operation tracking
- Uses `RetryableError` for network failures
- Will integrate with `EvidenceStore` in later stories

### Implementation Strategy

1. **BrowserAgent Class Structure:**
```typescript
export class BrowserAgent {
  private browserbaseClient: Browserbase;
  private session: Session | null = null;
  private readonly testId: string;
  private readonly evidenceStore: EvidenceStore;

  constructor(testId: string, evidenceStore: EvidenceStore) {
    // Initialize Browserbase client
    // Store references
  }

  async createSession(): Promise<void> {
    // Create browser session
    // Store session reference
  }

  async closeSession(): Promise<void> {
    // Close session if exists
    // Clean up references
  }
}
```

2. **Browserbase Initialization:**
```typescript
import { Browserbase } from '@browserbasehq/sdk';

this.browserbaseClient = new Browserbase({
  apiKey: config.browserbase.apiKey,
  projectId: config.browserbase.projectId,
});
```

3. **Session Creation:**
```typescript
async createSession(): Promise<void> {
  try {
    log.info({ testId: this.testId }, "Creating Browserbase session");

    this.session = await this.browserbaseClient.sessions.create({
      projectId: config.browserbase.projectId,
    });

    log.info(
      {
        testId: this.testId,
        sessionId: this.session.id
      },
      "Browserbase session created"
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error({ error: err.message }, "Failed to create Browserbase session");
    throw new RetryableError(`Failed to create browser session: ${err.message}`);
  }
}
```

4. **Session Cleanup:**
```typescript
async closeSession(): Promise<void> {
  if (!this.session) {
    log.debug("No active session to close");
    return;
  }

  try {
    await this.browserbaseClient.sessions.close(this.session.id);
    log.info({ sessionId: this.session.id }, "Browserbase session closed");
    this.session = null;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.warn({ error: err.message }, "Error closing session, continuing");
  }
}
```

### Testing Strategy

**Mock Browserbase SDK:**
```typescript
vi.mock('@browserbasehq/sdk', () => ({
  Browserbase: vi.fn().mockImplementation(() => ({
    sessions: {
      create: vi.fn(),
      close: vi.fn(),
    },
  })),
}));
```

**Test Cases:**
1. Constructor initializes Browserbase client
2. createSession() successfully creates session
3. createSession() throws RetryableError on failure
4. createSession() handles timeout
5. closeSession() successfully closes session
6. closeSession() handles missing session gracefully
7. closeSession() handles close errors
8. Logger calls are made for all operations

### Dependencies

**New Package to Install:**
```bash
npm install @browserbasehq/sdk
```

**Existing Dependencies:**
- `@/utils/config` - Browserbase credentials
- `@/utils/logger` - Operation logging
- `@/errors/retryableError` - Network error handling
- `@/evidence-store/evidenceStore` - Will be used in later stories

### Error Handling Patterns

Follow existing patterns from Foundation:
```typescript
try {
  // Browserbase operation
  log.info({ ... }, "Operation successful");
} catch (error) {
  const err = error instanceof Error ? error : new Error(String(error));
  log.error({ error: err.message, ... }, "Operation failed");
  throw new RetryableError(`Operation failed: ${err.message}`);
}
```

### Type Definitions

Types will likely come from `@browserbasehq/sdk`:
- `Browserbase` - Client class
- `Session` - Session object with id, status, etc.

## Definition of Done

- [ ] BrowserAgent class created in src/browser-agent/browserAgent.ts
- [ ] Browserbase SDK integrated and initialized
- [ ] createSession() and closeSession() methods implemented
- [ ] RetryableError wrapping for connection failures
- [ ] Logger integration for all operations
- [ ] Comprehensive unit tests (>90% coverage)
- [ ] All tests passing
- [ ] No regressions in existing tests
- [ ] Code follows existing patterns and conventions

## Test Results

### Initial Tests
```
✓ All 218 tests passing (21 new BrowserAgent tests)
✓ 21 tests in browserAgent.test.ts
✓ Zero test failures
✓ Zero regressions

New Tests Added:
- Constructor: 3 tests
  ✓ Create BrowserAgent instance
  ✓ Initialize with no active session
  ✓ Store testId and evidenceStore references

- createSession(): 5 tests
  ✓ Successfully create browser session
  ✓ Throw RetryableError when session creation fails
  ✓ Throw RetryableError with original error message
  ✓ Handle non-Error thrown values
  ✓ Store session reference after successful creation

- closeSession(): 5 tests
  ✓ Successfully close active session
  ✓ Safe to call when no session exists
  ✓ Safe to call multiple times
  ✓ Handle close errors gracefully
  ✓ Clear session reference even when close fails

- getSessionId(): 3 tests
  ✓ Return null when no session exists
  ✓ Return session ID when session exists
  ✓ Return null after session is closed

- hasActiveSession(): 3 tests
  ✓ Return false when no session exists
  ✓ Return true when session exists
  ✓ Return false after session is closed

- Session lifecycle integration: 2 tests
  ✓ Handle complete session lifecycle
  ✓ Work with try-finally cleanup pattern
```

### Code Review
```
# To be filled by code review workflow
```

## Implementation Notes

### Implementation Summary
Successfully implemented BrowserAgent class in `src/browser-agent/browserAgent.ts`:

**Key Features:**
1. **Browserbase Integration**: Initialized Browserbase SDK with credentials from config
2. **Session Management**: createSession() and closeSession() methods with proper lifecycle
3. **Error Handling**: RetryableError wrapping for network failures
4. **Session State**: getSessionId() and hasActiveSession() helper methods
5. **Logging**: Comprehensive structured logging for all operations
6. **Graceful Cleanup**: closeSession() is safe to call multiple times and handles errors

**Class Structure:**
```typescript
export class BrowserAgent {
  private readonly browserbaseClient: Browserbase;
  private session: BrowserSession | null = null;
  private readonly testId: string;
  private readonly evidenceStore: EvidenceStore;

  constructor(testId: string, evidenceStore: EvidenceStore)
  async createSession(): Promise<void>
  async closeSession(): Promise<void>
  getSessionId(): string | null
  hasActiveSession(): boolean
}
```

### Technical Decisions

1. **Session Lifecycle Pattern**:
   - Session stored as private field, null when inactive
   - createSession() throws RetryableError on failure (enables retry logic)
   - closeSession() logs warnings but doesn't throw (allows cleanup to complete)

2. **Browserbase API Usage**:
   - `sessions.create({ projectId })` to start session
   - `sessions.update(sessionId, { status: 'REQUEST_RELEASE' })` to close session
   - Session object contains `id` and `status` fields

3. **Error Handling Strategy**:
   - Network/auth errors wrapped in RetryableError (allows orchestrator to retry)
   - Close errors logged as warnings (cleanup shouldn't fail tests)
   - Non-Error thrown values converted to Error objects

4. **Helper Methods**:
   - getSessionId() returns null instead of throwing when no session
   - hasActiveSession() provides boolean check without accessing session internals

### Test Infrastructure

**Mock Strategy:**
- Created shared mockSessionsCreate and mockSessionsUpdate vi.fn() instances
- Mocked Browserbase SDK as a class with sessions property
- Avoided vi.resetModules() to keep config module loaded with env vars

**Test Patterns:**
- Mock resolution/rejection for each test case
- Verify state changes (hasActiveSession, getSessionId)
- Test idempotent operations (multiple closeSession calls)
- Test error scenarios (network failures, non-Error values)

### Integration with Existing Code

**Dependencies Used:**
- `@/utils/config` - Browserbase credentials
- `@/utils/logger` - Structured logging
- `@/errors/retryableError` - Network error wrapping
- `@/evidence-store/evidenceStore` - Test artifact storage (used in later stories)

**Follows Established Patterns:**
- Logger child({ component }) pattern
- Try-catch with error type checking
- Error wrapping with original message
- Structured logging with context objects

### Files Created
- `src/browser-agent/browserAgent.ts` - Main implementation (215 lines)
- `src/browser-agent/browserAgent.test.ts` - Comprehensive tests (423 lines)

### Next Steps
Story 3-2 will integrate Stagehand for browser control, using the session created here.
