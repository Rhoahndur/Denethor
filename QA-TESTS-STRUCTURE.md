# QA Tests Output Directory Structure

All test outputs are now organized under a central `qa-tests/` directory for easier management and navigation.

## Directory Structure

```
qa-tests/
├── default/                    # Default CLI test outputs
│   └── test-{uuid}-{timestamp}/
│       ├── reports/
│       │   ├── report.json
│       │   ├── report.md
│       │   └── report.html
│       ├── screenshots/
│       ├── logs/
│       └── metadata.json
│
├── quick-test/                 # Quick test outputs (bun run quick-test)
│   └── test-quick-test-{timestamp}/
│       └── (same structure as above)
│
├── demo/                       # Demo test outputs (bun run demo)
│   └── test-demo-test-{timestamp}/
│       └── (same structure as above)
│
└── custom/                     # Custom output directories
    └── test-{uuid}-{timestamp}/
        └── (same structure as above)
```

## Usage Examples

### Default CLI Test
```bash
bun run cli test https://example.com/game
# Output: ./qa-tests/default/test-{uuid}-{timestamp}/
```

### Quick Test
```bash
bun run quick-test https://example.com/game
# Output: ./qa-tests/quick-test/test-quick-test-{timestamp}/
```

### Demo Test (No APIs)
```bash
bun run demo
# Output: ./qa-tests/demo/test-demo-test-{timestamp}/
```

### Custom Output Directory
```bash
bun run cli test https://example.com/game --output ./qa-tests/my-custom-test
# Output: ./qa-tests/my-custom-test/test-{uuid}-{timestamp}/
```

### Programmatic Usage
```typescript
import { QAOrchestrator } from 'browsergame-qa';

const orchestrator = new QAOrchestrator({
  gameUrl: 'https://example.com/game',
  outputDir: './qa-tests/integration-tests',
});

const result = await orchestrator.runTest();
// Output: ./qa-tests/integration-tests/test-{uuid}-{timestamp}/
```

## Accessing Reports

### Find Latest Test
```bash
# Find most recent test
ls -lt qa-tests/default/ | head -2

# Find most recent quick test
ls -lt qa-tests/quick-test/ | head -2
```

### Open HTML Report
```bash
# Default test
open qa-tests/default/test-*/reports/report.html

# Quick test
open qa-tests/quick-test/test-*/reports/report.html

# Demo test
open qa-tests/demo/test-*/reports/report.html
```

### Search for Specific Test
```bash
# Find test by UUID
find qa-tests -name "test-{uuid}*"

# Find tests from specific date
find qa-tests -name "*20251105*"
```

## Configuration

The default output directory can be changed via:

### Environment Variable
```bash
# .env file
OUTPUT_DIR=./qa-tests/my-default
```

### CLI Option
```bash
bun run cli test https://example.com/game --output ./qa-tests/custom
```

### Programmatic
```typescript
const orchestrator = new QAOrchestrator({
  gameUrl: 'https://example.com/game',
  outputDir: './qa-tests/my-output',
});
```

## Test Subdirectory Structure

Each test creates a unique timestamped directory with:

```
test-{uuid}-{timestamp}/
├── reports/              # Generated reports
│   ├── report.json      # Structured data (for APIs/databases)
│   ├── report.md        # Human-readable Markdown
│   └── report.html      # Interactive HTML report (recommended!)
│
├── screenshots/         # Test screenshots
│   ├── 00-initial-load.png
│   ├── 01-click-start.png
│   └── ...
│
├── logs/               # Test logs
│   ├── console.log     # Browser console logs
│   ├── actions.log     # Actions performed
│   └── errors.log      # Errors encountered
│
└── metadata.json       # Test metadata
```

## Migration from Old Structure

Old output directories are no longer used:
- ❌ `./output` → ✅ `./qa-tests/default`
- ❌ `./quick-test-output` → ✅ `./qa-tests/quick-test`
- ❌ `./demo-output` → ✅ `./qa-tests/demo`
- ❌ `./real-test` → ✅ `./qa-tests/real-test`

The new structure provides:
- 🗂️ Centralized organization
- 🔍 Easier to find tests
- 🧹 Simpler cleanup
- 📦 Better .gitignore management

## Cleanup

To clean up old tests:

```bash
# Remove all QA tests
rm -rf qa-tests/

# Remove specific test type
rm -rf qa-tests/demo/

# Remove tests older than 7 days
find qa-tests -type d -name "test-*" -mtime +7 -exec rm -rf {} +
```
