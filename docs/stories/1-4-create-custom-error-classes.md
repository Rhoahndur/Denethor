# Story 1.4: Create Custom Error Classes

Status: done

## Story

As a developer,
I want typed error classes for different failure scenarios,
so that error handling logic can distinguish between retry-able and fatal errors.

## Acceptance Criteria

1. Create `src/errors/QAError.ts` with base error class
2. Create `src/errors/RetryableError.ts` for network/timeout errors
3. Create `src/errors/GameCrashError.ts` for game crash errors (fail fast)
4. Create `src/errors/ValidationError.ts` for input validation errors
5. Each error class includes message and optional cause parameter
6. Error classes follow pattern from architecture.md
7. Unit tests cover all error classes

## Tasks / Subtasks

- [x] Create src/errors directory structure (AC: #1)
  - [x] Create src/ directory if it doesn't exist
  - [x] Create src/errors/ subdirectory
- [x] Implement QAError base class (AC: #1, #5, #6)
  - [x] Extend Error class
  - [x] Add message parameter
  - [x] Add optional cause parameter
  - [x] Follow TypeScript error pattern from architecture
- [x] Implement RetryableError class (AC: #2, #5, #6)
  - [x] Extend QAError
  - [x] Document use case (network/timeout errors)
  - [x] Include message and cause parameters
- [x] Implement GameCrashError class (AC: #3, #5, #6)
  - [x] Extend QAError
  - [x] Document use case (game crash - fail fast)
  - [x] Include message and cause parameters
- [x] Implement ValidationError class (AC: #4, #5, #6)
  - [x] Extend QAError
  - [x] Document use case (input validation failures)
  - [x] Include message and cause parameters
- [x] Create comprehensive unit tests (AC: #7)
  - [x] Test QAError instantiation and properties
  - [x] Test RetryableError instantiation and inheritance
  - [x] Test GameCrashError instantiation and inheritance
  - [x] Test ValidationError instantiation and inheritance
  - [x] Test error message preservation
  - [x] Test cause parameter handling
  - [x] Test instanceof checks for all error types

## Dev Notes

### Technical Context

**Error Handling Strategy:**
- Custom typed errors enable precise error handling logic
- RetryableError: Transient failures (network issues, timeouts) - retry with backoff
- GameCrashError: Critical failures (game crashed) - fail fast, no retry
- ValidationError: Input validation failures - fail fast, user correction needed
- Base QAError: Common parent for all custom errors in the system

**TypeScript Error Pattern:**
- Extend built-in Error class
- Set prototype explicitly for instanceof checks to work correctly
- Include optional cause parameter for error chaining
- Use proper TypeScript typing for all parameters

**Architecture Alignment:**
- Follows hybrid error recovery strategy from architecture.md
- Supports retry utility (Story 1.8) which needs to identify RetryableError
- Enables evidence collection to log appropriate error context
- Foundation for logger integration (Story 1.6) to log errors with proper context

### Project Structure Notes

**Current State:**
- No src/ directory exists yet (will be created)
- TypeScript configured with strict mode in tsconfig.json
- Vitest configured for testing (Story 1.3)
- 51 tests currently passing

**Expected Changes:**
- New directory: src/errors/
- New files: QAError.ts, RetryableError.ts, GameCrashError.ts, ValidationError.ts
- New test files: errors.test.ts or individual test files per error class
- Foundation for future error handling throughout the codebase

**Alignment Notes:**
- Error classes are TypeScript-only (no runtime dependencies)
- Follow camelCase file naming convention (qaError.ts pattern)
- Test co-location: errors.test.ts alongside error classes or in same directory
- Strict mode compatible: proper typing for all parameters

### Learnings from Previous Story

**From Story 1.3 (1-3-configure-vitest-for-testing):**

**Status:** done

- **Testing Infrastructure Ready**: Vitest 4.0 fully configured and working - use for error class tests
- **Test Pattern Established**: Follow comprehensive testing approach (20 tests in Story 1.3) - cover all error classes thoroughly
- **Architecture Template Matching**: Story 1.3 achieved exact template match - aim for same precision with architecture error patterns
- **Test Organization**: Use describe blocks for each error class, group related tests logically
- **Zero Regressions**: All 51 existing tests continue passing - maintain this standard
- **Comprehensive Coverage**: Test existence, structure, functionality, edge cases, and TypeScript types

**New Files Created in Story 1.3:**
- vitest.config.ts (testing configuration)
- vitest.config.test.ts (20 comprehensive tests)

**Modified Files in Story 1.3:**
- package.json (added @vitest/coverage-v8 dependency)

**Technical Patterns to Reuse:**
- Comprehensive test suites with describe blocks for organization
- Test file existence, proper structure, and all functionality
- Verify TypeScript strict mode compatibility
- Follow established project patterns (naming, structure, testing)

**Review Findings from Story 1.3:**
- Perfect architecture alignment led to clean approval with zero issues
- Comprehensive testing caught all edge cases
- Documentation and evidence tracking enabled fast review
- Zero technical debt introduced

[Source: stories/1-3-configure-vitest-for-testing.md#Dev-Agent-Record]

### References

- [Source: docs/architecture.md] - Error handling strategy and patterns
- [Source: docs/epics.md#Story-1.4] - Story definition and acceptance criteria
- [TypeScript Error Handling](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html#support-for-newtarget) - Error class patterns
- [MDN Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error) - JavaScript Error class reference

## Dev Agent Record

### Context Reference

- docs/stories/1-4-create-custom-error-classes.context.xml


### Debug Log References

None - implementation completed without requiring debug logs.

### Completion Notes List

1. **Directory Structure Created**: Created src/ and src/errors/ directories
2. **QAError Base Class**: Implemented base error class extending Error with message and optional cause parameter, sets name property, uses Object.setPrototypeOf for instanceof compatibility
3. **RetryableError Class**: Implemented for transient failures (network/timeout errors), extends QAError, documented use case for retry with exponential backoff
4. **GameCrashError Class**: Implemented for critical failures (game crashes), extends QAError, documented use case for fail-fast behavior without retry
5. **ValidationError Class**: Implemented for input validation failures, extends QAError, documented use case for immediate failure requiring user correction
6. **Architecture Template Match**: All error classes follow exact pattern from architecture.md lines 618-648 with message, cause, name, and Object.setPrototypeOf
7. **Comprehensive Test Suite**: Created errors.test.ts with 32 tests covering:
   - QAError: instantiation, message/cause, name property, instanceof checks, stack trace (6 tests)
   - RetryableError: inheritance, instanceof, message/cause preservation, stack trace (7 tests)
   - GameCrashError: inheritance, instanceof, message/cause preservation, stack trace (7 tests)
   - ValidationError: inheritance, instanceof, message/cause preservation, stack trace (7 tests)
   - Error Type Discrimination: instanceof checks to distinguish error types (5 tests)
8. **All Tests Passing**: 83 total tests passing (51 from previous stories + 32 new error tests)
9. **Zero Regressions**: All existing tests continue passing without modifications
10. **TypeScript Strict Mode Compatible**: All error classes work correctly with TypeScript strict mode, proper typing for all parameters
11. **Documentation Included**: Each error class includes JSDoc comments explaining use case and retry behavior

### File List

**Created:**
- src/ directory (new directory)
- src/errors/ directory (new subdirectory)
- src/errors/qaError.ts (base error class)
- src/errors/retryableError.ts (network/timeout errors)
- src/errors/gameCrashError.ts (game crash errors - fail fast)
- src/errors/validationError.ts (input validation errors)
- src/errors/errors.test.ts (comprehensive test suite - 32 tests)

---

## Senior Developer Review (AI)

**Reviewer:** Sasha
**Date:** 2025-11-03
**Outcome:** ✅ APPROVE

### Summary

Story 1.4 successfully implements typed error classes for the hybrid error recovery strategy. All 7 acceptance criteria are fully implemented with verified evidence. All 27 tasks/subtasks marked as complete have been verified with specific file:line evidence. The implementation includes 4 error class files matching the architecture template exactly, plus a comprehensive test suite with 32 tests. All 83 tests pass. Code quality is excellent with perfect architecture alignment and no issues found.

### Key Findings

**No HIGH, MEDIUM, or LOW severity issues found.**

All implementation verified against architecture.md template (lines 618-648) with exact match.

### Acceptance Criteria Coverage

| AC# | Description | Status | Evidence |
|-----|-------------|--------|----------|
| AC1 | Create `src/errors/QAError.ts` with base error class | ✅ IMPLEMENTED | src/errors/qaError.ts:1-11 - File exists, QAError class extends Error with message and optional cause parameter |
| AC2 | Create `src/errors/RetryableError.ts` for network/timeout errors | ✅ IMPLEMENTED | src/errors/retryableError.ts:1-13 - File exists, RetryableError extends QAError with JSDoc documenting network/timeout use case |
| AC3 | Create `src/errors/GameCrashError.ts` for game crash errors (fail fast) | ✅ IMPLEMENTED | src/errors/gameCrashError.ts:1-13 - File exists, GameCrashError extends QAError with JSDoc documenting fail-fast use case |
| AC4 | Create `src/errors/ValidationError.ts` for input validation errors | ✅ IMPLEMENTED | src/errors/validationError.ts:1-13 - File exists, ValidationError extends QAError with JSDoc documenting validation use case |
| AC5 | Each error class includes message and optional cause parameter | ✅ IMPLEMENTED | All error classes (qaError.ts:6, retryableError.ts:8, gameCrashError.ts:8, validationError.ts:8) have constructor(message: string, cause?: Error) signature |
| AC6 | Error classes follow pattern from architecture.md | ✅ IMPLEMENTED | All classes match architecture.md:618-648 pattern exactly: extend Error/QAError, set this.name, use Object.setPrototypeOf |
| AC7 | Unit tests cover all error classes | ✅ IMPLEMENTED | errors.test.ts:1-215 - 32 comprehensive tests covering instantiation, inheritance, message/cause, instanceof checks, stack traces for all 4 error classes |

**Summary:** 7 of 7 acceptance criteria fully implemented ✅

### Task Completion Validation

| Task/Subtask | Marked As | Verified As | Evidence |
|--------------|-----------|-------------|----------|
| Create src/errors directory structure | [x] Complete | ✅ VERIFIED | src/ and src/errors/ directories exist |
| └ Create src/ directory | [x] Complete | ✅ VERIFIED | Directory exists with error classes |
| └ Create src/errors/ subdirectory | [x] Complete | ✅ VERIFIED | Directory contains all 4 error class files + test file |
| Implement QAError base class | [x] Complete | ✅ VERIFIED | qaError.ts:5-10 complete implementation |
| └ Extend Error class | [x] Complete | ✅ VERIFIED | qaError.ts:5 - extends Error |
| └ Add message parameter | [x] Complete | ✅ VERIFIED | qaError.ts:6 - message: string |
| └ Add optional cause parameter | [x] Complete | ✅ VERIFIED | qaError.ts:6 - public cause?: Error |
| └ Follow TypeScript error pattern | [x] Complete | ✅ VERIFIED | qaError.ts:7-9 - super(message), this.name, Object.setPrototypeOf |
| Implement RetryableError class | [x] Complete | ✅ VERIFIED | retryableError.ts:7-12 complete implementation |
| └ Extend QAError | [x] Complete | ✅ VERIFIED | retryableError.ts:7 - extends QAError |
| └ Document use case | [x] Complete | ✅ VERIFIED | retryableError.ts:3-5 - JSDoc describes network/timeout, retry with backoff |
| └ Include message and cause parameters | [x] Complete | ✅ VERIFIED | retryableError.ts:8 |
| Implement GameCrashError class | [x] Complete | ✅ VERIFIED | gameCrashError.ts:7-12 complete implementation |
| └ Extend QAError | [x] Complete | ✅ VERIFIED | gameCrashError.ts:7 - extends QAError |
| └ Document use case | [x] Complete | ✅ VERIFIED | gameCrashError.ts:3-5 - JSDoc describes fail-fast, no retry |
| └ Include message and cause parameters | [x] Complete | ✅ VERIFIED | gameCrashError.ts:8 |
| Implement ValidationError class | [x] Complete | ✅ VERIFIED | validationError.ts:7-12 complete implementation |
| └ Extend QAError | [x] Complete | ✅ VERIFIED | validationError.ts:7 - extends QAError |
| └ Document use case | [x] Complete | ✅ VERIFIED | validationError.ts:3-5 - JSDoc describes user correction needed |
| └ Include message and cause parameters | [x] Complete | ✅ VERIFIED | validationError.ts:8 |
| Create comprehensive unit tests | [x] Complete | ✅ VERIFIED | errors.test.ts:1-215 with 32 tests |
| └ Test QAError instantiation | [x] Complete | ✅ VERIFIED | errors.test.ts:8-42 - 6 tests |
| └ Test RetryableError | [x] Complete | ✅ VERIFIED | errors.test.ts:45-83 - 7 tests |
| └ Test GameCrashError | [x] Complete | ✅ VERIFIED | errors.test.ts:85-123 - 7 tests |
| └ Test ValidationError | [x] Complete | ✅ VERIFIED | errors.test.ts:125-163 - 7 tests |
| └ Test error message preservation | [x] Complete | ✅ VERIFIED | Each error class has message preservation tests |
| └ Test cause parameter handling | [x] Complete | ✅ VERIFIED | Each error class has cause parameter tests |
| └ Test instanceof checks | [x] Complete | ✅ VERIFIED | errors.test.ts:165-215 - Error Type Discrimination section with 5 tests |

**Summary:** 27 of 27 completed tasks verified ✅ (0 questionable, 0 falsely marked complete)

### Test Coverage and Gaps

**Test Coverage:**
- ✅ AC1: Tests verify QAError instantiation, message/cause, name, instanceof, stack trace (errors.test.ts:7-43 - 6 tests)
- ✅ AC2: Tests verify RetryableError functionality and inheritance (errors.test.ts:45-83 - 7 tests)
- ✅ AC3: Tests verify GameCrashError functionality and inheritance (errors.test.ts:85-123 - 7 tests)
- ✅ AC4: Tests verify ValidationError functionality and inheritance (errors.test.ts:125-163 - 7 tests)
- ✅ AC5: Tests verify message and cause parameters for all error classes
- ✅ AC6: Tests verify instanceof checks confirming proper inheritance chain (errors.test.ts:165-215 - 5 tests)
- ✅ AC7: Comprehensive error type discrimination tests ensure proper error type identification

**Test Quality:**
- 32 comprehensive tests covering all error classes
- Proper use of describe blocks for organization
- Tests are deterministic and non-flaky
- All 83 tests passing (51 from Stories 1.1-1.3 + 32 from Story 1.4)
- Covers edge cases: with/without cause parameter, stack trace preservation
- Error type discrimination tests ensure instanceof works correctly for all types

**No test coverage gaps identified.**

### Architectural Alignment

**Custom Error Classes Pattern (architecture.md:618-648):**
- ✅ All classes match template exactly - character-for-character match
- ✅ QAError extends Error, subclasses extend QAError
- ✅ All classes set this.name property to class name string
- ✅ All classes use Object.setPrototypeOf for instanceof compatibility
- ✅ Message and optional cause parameters implemented correctly

**TypeScript Strict Mode:**
- ✅ All error classes compatible with strict mode
- ✅ Proper typing: message: string, cause?: Error
- ✅ No type errors when compiled

**Error Recovery Strategy (ADR-004):**
- ✅ RetryableError enables intelligent retry logic for transient failures
- ✅ GameCrashError enables fail-fast for critical failures
- ✅ ValidationError enables immediate failure for user input errors
- ✅ Typed errors allow TypeScript type-checking of error handling

**File Naming Conventions:**
- ✅ qaError.ts, retryableError.ts, gameCrashError.ts, validationError.ts follow camelCase convention
- ✅ errors.test.ts follows test file naming pattern
- ✅ Consistent with project standards

**Epic Tech-Spec Requirements:**
- ✅ Story 1.4 from Epic 1: Project Foundation & Infrastructure
- ✅ Foundation for retry utility (Story 1.8) which needs RetryableError
- ✅ Foundation for logger integration (Story 1.6) to log errors with proper context
- ✅ Enables evidence collection to log appropriate error context

### Security Notes

**Security Review:**
- ✅ No injection risks - error classes only handle error messages
- ✅ No secret exposure
- ✅ No runtime dependencies - pure TypeScript code
- ✅ Error messages can contain any string - developers must ensure sensitive data not included in error messages (standard practice)
- ✅ Stack traces preserved for debugging

**No security concerns identified.**

### Best-Practices and References

**TypeScript Error Handling Pattern:**
- Uses Object.setPrototypeOf for correct instanceof behavior in TypeScript
- Essential for downlevel compilation targets (ES5/ES2015)
- Reference: [TypeScript 2.2+ Error Handling](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html#support-for-newtarget)

**Error Chaining with Cause:**
- Optional cause parameter enables error chaining for better debugging
- Standard pattern for wrapping and re-throwing errors
- Reference: [MDN Error Cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause)

**Custom Error Classes:**
- Typed errors enable precise error handling with type guards
- instanceof checks work correctly with proper prototype chain
- Reference: [MDN Custom Errors](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#custom_error_types)

**JSDoc Documentation:**
- Each error class documented with use case and retry behavior
- Clear intent for when each error type should be used
- Helps developers choose correct error type

### Action Items

**No code changes required for story approval.**

All acceptance criteria met, all tasks verified complete, excellent code quality and comprehensive test coverage.
