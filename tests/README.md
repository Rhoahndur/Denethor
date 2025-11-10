# Denethor Test Suite

This directory contains the comprehensive test suite for the Denethor project, designed to ensure reliability, performance, and correctness across all system components.

## Overview

The test suite is organized into three main categories:

1. **Unit Tests** - Located alongside source files (`*.test.ts`)
2. **Integration Tests** - Located in `tests/integration/`
3. **End-to-End Tests** - Located in `tests/e2e/`

## Test Structure

```
tests/
├── fixtures/                  # Test fixtures and sample data
│   ├── sample-evidence.ts    # Sample QA reports and evidence
│   └── sample-screenshots/   # Sample screenshot files
├── integration/               # Integration tests
│   ├── orchestrator.integration.test.ts
│   ├── error-scenarios.test.ts
│   ├── performance.test.ts
│   └── lambda.integration.test.ts
├── e2e/                       # End-to-end tests
│   ├── cli.e2e.test.ts
│   └── api.e2e.test.ts
└── README.md                  # This file
```

## Running Tests

### Run All Tests

```bash
bun test
```

### Run Tests with Coverage

```bash
bun test --coverage
```

This generates coverage reports in:
- `coverage/` directory (HTML report)
- Terminal output (text summary)

### Run Specific Test File

```bash
bun test src/errors/errors.test.ts
bun test tests/integration/orchestrator.integration.test.ts
```

### Run Tests in Watch Mode

```bash
bun test --watch
```

### Run Tests Matching Pattern

```bash
bun test --grep "error"  # Run tests with "error" in name
```

## Test Categories

### Unit Tests (Co-located with source)

**Location:** `src/**/*.test.ts`

**Purpose:** Test individual functions and classes in isolation

**Coverage Target:** 70%+ overall, 90%+ for foundation components

**Examples:**
- `src/errors/errors.test.ts` - Custom error classes
- `src/utils/logger.test.ts` - Logger functionality
- `src/utils/retry.test.ts` - Retry logic
- `src/utils/config.test.ts` - Configuration validation

**Pattern:**
```typescript
import { describe, it, expect } from 'vitest';
import { MyClass } from './myClass';

describe('MyClass', () => {
  it('should do something', () => {
    const instance = new MyClass();
    expect(instance.method()).toBe(expectedValue);
  });
});
```

### Integration Tests

**Location:** `tests/integration/`

**Purpose:** Test component interactions and data flow

**Coverage:** Tests how components work together

**Key Files:**
- `orchestrator.integration.test.ts` - Full orchestration flow
- `error-scenarios.test.ts` - Comprehensive error handling
- `performance.test.ts` - Performance and timeout enforcement
- `lambda.integration.test.ts` - Lambda handler integration

**Pattern:**
```typescript
import { describe, it, expect, vi } from 'vitest';

describe('Component Integration', () => {
  it('should integrate ComponentA with ComponentB', () => {
    // Test real component interaction
    // Mock only external services
  });
});
```

### End-to-End Tests

**Location:** `tests/e2e/`

**Purpose:** Test complete user workflows

**Coverage:** CLI commands, API calls, full system flows

**Key Files:**
- `cli.e2e.test.ts` - CLI command execution
- `api.e2e.test.ts` - Programmatic API usage

**Pattern:**
```typescript
describe('E2E: CLI Usage', () => {
  it('should run complete test via CLI', async () => {
    const result = await execAsync('bun run cli/index.ts test <url>');
    expect(result.exitCode).toBe(0);
  });
});
```

## Mocking Strategy

### External Services (Always Mocked)

```typescript
import { vi } from 'vitest';

// Mock Browserbase SDK
vi.mock('@browserbasehq/sdk', () => ({
  Browserbase: vi.fn().mockImplementation(() => ({
    createSession: vi.fn().mockResolvedValue({ id: 'test-session' }),
    closeSession: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock OpenAI SDK
vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn().mockReturnValue({
    chat: vi.fn().mockResolvedValue({ choices: [] }),
  }),
}));
```

### File System Operations

```typescript
import { vi } from 'vitest';
import fs from 'node:fs/promises';

// Mock fs operations
vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
```

### Component Methods

```typescript
import { vi } from 'vitest';

const mockMethod = vi.fn().mockResolvedValue(expectedResult);
// Use mockMethod in tests
```

## Test Fixtures

**Location:** `tests/fixtures/`

**Purpose:** Provide consistent test data across tests

**Available Fixtures:**
- `sampleQAReport` - Complete successful QA report
- `sampleFailedQAReport` - Failed QA report with errors
- `sampleEvidence` - Screenshot and log paths
- `sampleConsoleLogs` - Sample console output
- `sampleActionLogs` - Sample action logs
- `sampleErrorLogs` - Sample error logs

**Usage:**
```typescript
import { sampleQAReport } from '../fixtures/sample-evidence';

it('should process QA report', () => {
  const result = processReport(sampleQAReport);
  expect(result).toBeDefined();
});
```

## Coverage Targets

### Overall Project
- **Target:** 70%+ (NFR-4 requirement from PRD)
- **Current:** Check with `bun test --coverage`

### By Module
- **Foundation (Epic 1):** 90%+ (errors, utils, types)
- **Evidence Store (Epic 2):** 80%+
- **Browser Agent (Epic 3):** 75%+
- **AI Evaluator (Epic 4):** 80%+
- **Report Generator (Epic 5):** 85%+
- **Orchestrator (Epic 6):** 70%+

### Critical Paths
- **Orchestrator flow:** 90%+
- **Error handling:** 100%
- **Configuration validation:** 100%

## Testing Best Practices

### 1. Follow AAA Pattern

```typescript
it('should do something', () => {
  // Arrange
  const input = setupTestData();

  // Act
  const result = functionUnderTest(input);

  // Assert
  expect(result).toBe(expectedValue);
});
```

### 2. Use Descriptive Test Names

```typescript
// ✅ Good
it('should throw ValidationError when URL is invalid', () => {});

// ❌ Bad
it('test 1', () => {});
```

### 3. One Logical Assertion Per Test

```typescript
// ✅ Good
it('should return status success', () => {
  expect(result.status).toBe('success');
});

it('should return score above 70', () => {
  expect(result.score).toBeGreaterThan(70);
});

// ❌ Bad
it('should return valid result', () => {
  expect(result.status).toBe('success');
  expect(result.score).toBeGreaterThan(70);
  expect(result.issues).toHaveLength(0);
  // Too many unrelated assertions
});
```

### 4. Isolate Tests

```typescript
import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.clearAllMocks(); // Clear mocks between tests
});

afterEach(() => {
  vi.restoreAllMocks(); // Restore original implementations
});
```

### 5. Mock External Dependencies

```typescript
// ✅ Good - Mock external services
vi.mock('@browserbasehq/sdk');

// ❌ Bad - Real API calls in tests
const browser = new Browserbase(realApiKey);
```

### 6. Use Meaningful Test Data

```typescript
// ✅ Good
const validGameUrl = 'https://example.com/game.html';
const invalidGameUrl = 'not-a-url';

// ❌ Bad
const url1 = 'https://test.com';
const url2 = 'invalid';
```

## Common Test Patterns

### Testing Async Functions

```typescript
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

### Testing Error Throwing

```typescript
it('should throw error on invalid input', () => {
  expect(() => functionThatThrows()).toThrow(ValidationError);
});

// For async functions
it('should reject with error', async () => {
  await expect(asyncFunctionThatThrows()).rejects.toThrow(ValidationError);
});
```

### Testing with Timeouts

```typescript
it('should complete within timeout', async () => {
  const startTime = Date.now();
  await functionWithTimeout();
  const duration = Date.now() - startTime;

  expect(duration).toBeLessThan(1000); // 1 second
});
```

### Testing Mocks

```typescript
it('should call mock with correct arguments', () => {
  const mockFn = vi.fn();

  functionUnderTest(mockFn);

  expect(mockFn).toHaveBeenCalledWith(expectedArgs);
  expect(mockFn).toHaveBeenCalledTimes(1);
});
```

## Debugging Tests

### Run Single Test

```bash
bun test -t "specific test name"
```

### Enable Debug Logging

```bash
LOG_LEVEL=debug bun test
```

### Use console.log (temporarily)

```typescript
it('should debug issue', () => {
  console.log('Debug value:', value);
  expect(value).toBe(expected);
});
```

### Use Vitest UI (optional)

```bash
bun test --ui
```

## CI/CD Integration

Tests are automatically run in GitHub Actions on:
- Pull requests to `main`
- Pushes to `main`

**CI Configuration:** `.github/workflows/test.yml`

**Requirements:**
- All tests must pass
- Coverage must be ≥70%
- No linting errors

## Test Execution Performance

**Target:** < 30 seconds for full suite

**Actual:** Check with:
```bash
time bun test
```

**Optimization Tips:**
- Use `vi.fn()` instead of real implementations
- Mock expensive operations (API calls, file I/O)
- Run independent tests in parallel (default in Vitest)
- Use `test.concurrent()` for CPU-intensive tests

## Test Maintenance

### Adding New Tests

1. Create test file next to source: `myModule.test.ts`
2. Import test utilities: `import { describe, it, expect } from 'vitest'`
3. Write tests following AAA pattern
4. Run tests: `bun test myModule.test.ts`
5. Verify coverage: `bun test --coverage`

### Updating Tests

1. When changing functionality, update related tests
2. Ensure coverage doesn't drop below 70%
3. Run full suite before committing

### Removing Tests

1. Only remove tests for deleted functionality
2. Check if other tests depend on removed test fixtures

## Troubleshooting

### Tests Failing Locally But Passing in CI

- Check Node/Bun version: `bun --version`
- Check environment variables in `.env`
- Clear test cache: `rm -rf coverage/`

### Coverage Not Updating

- Clear coverage directory: `rm -rf coverage/`
- Re-run with coverage: `bun test --coverage`

### Slow Tests

- Check for real API calls (should be mocked)
- Look for unnecessary `await` or long timeouts
- Use `--reporter=verbose` to see slow tests

### Flaky Tests

- Avoid time-dependent tests
- Ensure proper mock cleanup in `beforeEach`/`afterEach`
- Use deterministic test data

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Bun Test Runner](https://bun.sh/docs/cli/test)
- [Project Architecture](../docs/architecture.md)
- [PRD Requirements](../docs/PRD.md)

## Contributing

When contributing tests:

1. Follow existing patterns in the test suite
2. Ensure all tests pass: `bun test`
3. Maintain or improve coverage: `bun test --coverage`
4. Add tests for new features
5. Update this README if adding new test patterns

## Contact

For questions about testing:
- Review existing test files for examples
- Check architecture.md for testing guidelines
- See PRD.md for NFR-4 (testing requirements)
