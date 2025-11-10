# Getting Started with Denethor

Welcome to Denethor! This guide will help you run your first automated QA test on a browser game.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Your First Test](#your-first-test)
- [Understanding Results](#understanding-results)
- [Common Workflows](#common-workflows)
- [Next Steps](#next-steps)

---

## Prerequisites

Before starting, ensure you have:

1. **Bun** (recommended) or **Node.js 20+**
   - Install Bun: `curl -fsSL https://bun.sh/install | bash`
   - Or Node.js: [Download from nodejs.org](https://nodejs.org/)

2. **API Keys** (required for testing):
   - **Browserbase Account** - [Sign up free](https://www.browserbase.com/)
   - **OpenAI Account** - [Get API key](https://platform.openai.com/api-keys)

3. **Basic Command Line Knowledge**
   - Comfortable running terminal commands
   - Understanding of environment variables

---

## Installation

### Option 1: Install as NPM Package (Coming Soon)

```bash
# Via npm
npm install browsergame-qa

# Via bun
bun add browsergame-qa
```

### Option 2: Clone Repository

```bash
# Clone the repository
git clone https://github.com/yourusername/browsergame-qa.git
cd browsergame-qa

# Install dependencies
bun install

# Or with npm
npm install
```

---

## Quick Start

### Step 1: Set Up Environment Variables

Create a `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` with your API keys:

```bash
# Browserbase credentials
BROWSERBASE_API_KEY=bb_api_your_key_here
BROWSERBASE_PROJECT_ID=proj_your_project_id

# OpenAI credentials
OPENAI_API_KEY=sk-your_openai_key_here

# Optional configuration
OUTPUT_DIR=./output
LOG_LEVEL=info
```

**Where to find these values:**

- **Browserbase**: See [Browserbase Setup Guide](../deployment/browserbase.md)
- **OpenAI**: Get from [OpenAI API Keys](https://platform.openai.com/api-keys)

### Step 2: Verify Installation

```bash
# Test that everything is installed correctly
bun run src/cli/index.ts version

# Expected output:
# Denethor v1.0.0
# Runtime: Bun
# Architecture: ESNext
```

---

## Your First Test

Let's run a QA test on a simple browser game.

### Command Line Interface (CLI)

```bash
# Basic test
bun run src/cli/index.ts test https://example.com/game.html

# With custom options
bun run src/cli/index.ts test https://example.com/game.html \
  --output ./my-results \
  --timeout 120000 \
  --max-actions 15
```

### What Happens During a Test

When you run a test, Denethor:

1. **Creates a browser session** in Browserbase cloud
2. **Navigates to the game URL**
3. **Detects the game type** (platformer, clicker, puzzle, etc.)
4. **Executes intelligent actions** using the hybrid strategy:
   - Tries predefined heuristics first (fast, free)
   - Uses AI vision analysis when needed
5. **Captures evidence** (screenshots, console logs, actions)
6. **Analyzes playability** using AI evaluation
7. **Generates reports** in JSON, Markdown, and HTML formats

**Typical duration**: 2-5 minutes per test

### Example Output

```
Starting QA test...
Game URL: https://example.com/game.html
Output directory: ./output
Timeout: 300000ms
Max actions: 20

Running test (this may take a few minutes)...

============================================================
  QA TEST RESULTS
============================================================

Test ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Game URL: https://example.com/game.html
Duration: 3m 45s
Status: SUCCESS

------------------------------------------------------------
  PLAYABILITY SCORES
------------------------------------------------------------
Load Success:     95/100
Responsiveness:   85/100
Stability:        90/100
Overall:          88/100

Confidence: 92%

------------------------------------------------------------
  ISSUES DETECTED
------------------------------------------------------------

Major (1):
  - Controls are slightly delayed when pressing arrow keys

Minor (2):
  - Start button could be more prominent
  - No visual feedback when game over occurs

------------------------------------------------------------
  GENERATED REPORTS
------------------------------------------------------------

JSON:     ./output/test-a1b2c3d4-2025-11-04/reports/report.json
Markdown: ./output/test-a1b2c3d4-2025-11-04/reports/report.md
HTML:     ./output/test-a1b2c3d4-2025-11-04/reports/report.html

============================================================
```

---

## Understanding Results

### Playability Scores

Denethor evaluates four key metrics:

#### 1. Load Success (0-100)

**What it measures**: How well the game loads

- **90-100**: Perfect load, all assets visible
- **70-89**: Loaded with minor visual issues
- **40-69**: Partially loaded, missing assets
- **0-39**: Failed to load or blank screen

#### 2. Responsiveness (0-100)

**What it measures**: How well controls respond to input

- **90-100**: All inputs trigger immediate feedback
- **70-89**: Most inputs work, slight delays acceptable
- **40-69**: Some inputs work, others unresponsive
- **0-39**: No inputs work or major failures

#### 3. Stability (0-100)

**What it measures**: Game stability and error-free operation

- **90-100**: No errors, smooth gameplay
- **70-89**: Minor errors that don't affect gameplay
- **40-69**: Significant errors but game still playable
- **0-39**: Crashes, freezes, game-breaking errors

#### 4. Overall Playability (0-100)

**What it measures**: Combined assessment of game quality

- **90-100**: Production-ready, excellent UX
- **70-89**: Playable with minor issues
- **40-69**: Playable but significant UX problems
- **0-39**: Not playable, critical issues

### Issue Severity Levels

Issues are categorized by severity:

| Severity | Definition | Examples |
|----------|------------|----------|
| **Critical** | Game unplayable or severely broken | Crash on load, controls don't work, game freezes |
| **Major** | Significant functionality issues | Delayed controls, frequent errors, poor performance |
| **Minor** | Small bugs or usability concerns | UI inconsistencies, unclear instructions, missing feedback |

### Report Formats

Denethor generates three report formats:

#### JSON Report (`report.json`)

- **For**: Programmatic access, databases, APIs
- **Contains**: Complete structured data
- **Use when**: Integrating with other tools, storing results

```json
{
  "meta": {
    "testId": "...",
    "gameUrl": "...",
    "timestamp": "2025-11-04T12:00:00Z"
  },
  "scores": {
    "overallPlayability": 88
  }
}
```

#### Markdown Report (`report.md`)

- **For**: Human review, documentation
- **Contains**: Formatted summary with images
- **Use when**: Reviewing results, sharing with team

```markdown
# QA Test Report

## Summary
- **Overall Score**: 88/100
- **Status**: Success

## Issues
- Major: Controls slightly delayed
```

#### HTML Report (`report.html`)

- **For**: Visual review in browser
- **Contains**: Interactive dashboard with embedded screenshots
- **Use when**: Presenting results, visual inspection

Features:
- Color-coded scores
- Embedded screenshots
- Expandable issue sections
- Print-friendly layout

---

## Common Workflows

### Workflow 1: Quick Game Validation

Test a game quickly to check if it's playable:

```bash
# Fast test with fewer actions
bun run src/cli/index.ts test https://example.com/game.html \
  --max-actions 10 \
  --timeout 60000
```

**When to use**: Quick sanity check, smoke testing

### Workflow 2: Comprehensive QA

Full test with maximum actions:

```bash
# Full test
bun run src/cli/index.ts test https://example.com/game.html \
  --max-actions 20 \
  --timeout 300000
```

**When to use**: Pre-release testing, detailed evaluation

### Workflow 3: Batch Testing

Test multiple games sequentially:

```bash
# Create a script
cat > test-all-games.sh << 'EOF'
#!/bin/bash
for game in https://example.com/game1.html https://example.com/game2.html https://example.com/game3.html; do
  echo "Testing $game..."
  bun run src/cli/index.ts test "$game"
done
EOF

chmod +x test-all-games.sh
./test-all-games.sh
```

**When to use**: Testing multiple game variants, regression testing

### Workflow 4: CI/CD Integration

Integrate with your CI/CD pipeline:

```yaml
# .github/workflows/qa.yml
name: QA Tests

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run src/cli/index.ts test ${{ secrets.GAME_URL }}
        env:
          BROWSERBASE_API_KEY: ${{ secrets.BROWSERBASE_API_KEY }}
          BROWSERBASE_PROJECT_ID: ${{ secrets.BROWSERBASE_PROJECT_ID }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

**When to use**: Automated testing on code changes

---

## Troubleshooting

### Issue: "BROWSERBASE_API_KEY is required"

**Solution**: Ensure `.env` file exists and contains API keys

```bash
# Check .env file
cat .env

# Should contain:
# BROWSERBASE_API_KEY=...
# BROWSERBASE_PROJECT_ID=...
# OPENAI_API_KEY=...
```

### Issue: "Game failed to load"

**Possible causes**:
1. Game URL is incorrect
2. Game requires authentication
3. Game is down or unavailable

**Solutions**:
- Verify URL in browser
- Check game is publicly accessible
- Try a different game URL

### Issue: Test takes too long

**Solution**: Reduce timeout and max actions

```bash
bun run src/cli/index.ts test https://example.com/game.html \
  --max-actions 10 \
  --timeout 120000  # 2 minutes
```

### Issue: Low playability scores

**This is expected behavior!** Low scores indicate issues with the game, not the tool.

**Next steps**:
1. Review the HTML report for specific issues
2. Check screenshots to see what went wrong
3. Fix identified issues in your game
4. Re-run the test

---

## Next Steps

### Learn More

- [Configuration Guide](./configuration.md) - All configuration options
- [Interpreting Results](./interpreting-results.md) - Deep dive into reports
- [API Documentation](../api/README.md) - Programmatic usage

### Advanced Usage

- [AWS Lambda Deployment](../deployment/aws-lambda.md) - Serverless deployment
- [Examples](../../examples/) - Code examples

### Get Help

- Check [Troubleshooting](#troubleshooting) section above
- Review [documentation](../README.md)
- Open an issue on GitHub

---

## Tips for Success

1. **Start with simple games** - Test basic games first to understand the tool
2. **Review HTML reports** - Visual reports are easiest to understand
3. **Check screenshots** - Evidence shows exactly what the agent saw
4. **Iterate on issues** - Fix problems and re-test to verify
5. **Monitor costs** - Each test uses Browserbase time and OpenAI tokens

Happy testing!
