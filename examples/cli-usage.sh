#!/bin/bash
#
# CLI Usage Examples
#
# This script demonstrates various ways to use the Denethor CLI.
# Make executable with: chmod +x examples/cli-usage.sh
#

echo "Denethor CLI Examples"
echo "=========================="
echo ""

# Example 1: Basic usage with default options
echo "Example 1: Basic test with defaults"
echo "------------------------------------"
bun run src/cli/index.ts test https://example.com/game.html
echo ""

# Example 2: Custom output directory
echo "Example 2: Custom output directory"
echo "-----------------------------------"
bun run src/cli/index.ts test https://example.com/game.html \
  --output ./my-test-results
echo ""

# Example 3: Short test with fewer actions and reduced timeout
echo "Example 3: Quick test (10 actions, 2 minutes)"
echo "----------------------------------------------"
bun run src/cli/index.ts test https://example.com/game.html \
  --max-actions 10 \
  --timeout 120000
echo ""

# Example 4: Comprehensive test with all options
echo "Example 4: Full test with all options"
echo "--------------------------------------"
bun run src/cli/index.ts test https://example.com/game.html \
  --output ./comprehensive-results \
  --timeout 300000 \
  --max-actions 20
echo ""

# Example 5: Show version information
echo "Example 5: Version information"
echo "------------------------------"
bun run src/cli/index.ts version
echo ""

# Example 6: Testing multiple games sequentially
echo "Example 6: Batch testing multiple games"
echo "----------------------------------------"

GAMES=(
  "https://example.com/game1.html"
  "https://example.com/game2.html"
  "https://example.com/game3.html"
)

for game in "${GAMES[@]}"; do
  echo "Testing: $game"
  bun run src/cli/index.ts test "$game" \
    --output ./batch-results \
    --max-actions 10
  echo ""
done

echo "All tests complete!"
echo ""

# Example 7: Testing with environment variables
echo "Example 7: Using custom environment variables"
echo "----------------------------------------------"
LOG_LEVEL=debug \
OUTPUT_DIR=./debug-results \
bun run src/cli/index.ts test https://example.com/game.html
echo ""

# Example 8: Capture exit code for CI/CD
echo "Example 8: CI/CD integration with exit codes"
echo "---------------------------------------------"
bun run src/cli/index.ts test https://example.com/game.html

if [ $? -eq 0 ]; then
  echo "✓ Test passed - game is playable"
else
  echo "✗ Test failed - game has issues"
  exit 1
fi
echo ""

# Example 9: Output to file for post-processing
echo "Example 9: Save CLI output to file"
echo "-----------------------------------"
bun run src/cli/index.ts test https://example.com/game.html \
  2>&1 | tee test-output.log
echo ""
echo "Output saved to test-output.log"
echo ""

# Example 10: Parallel testing (requires GNU parallel or similar)
echo "Example 10: Parallel testing (if GNU parallel installed)"
echo "---------------------------------------------------------"

# Check if parallel is installed
if command -v parallel &> /dev/null; then
  echo "${GAMES[@]}" | tr ' ' '\n' | \
    parallel --jobs 3 \
      "bun run src/cli/index.ts test {} --max-actions 10 --output ./parallel-results"
  echo "Parallel tests complete!"
else
  echo "GNU parallel not installed - skipping parallel example"
  echo "Install with: brew install parallel (macOS) or apt install parallel (Linux)"
fi
echo ""

echo "All examples complete!"
