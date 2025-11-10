# Troubleshooting Guide

This guide helps diagnose and resolve common issues encountered while running QA tests on browser-based games.

---

## Game Gets Stuck at Start Screen

**Symptoms:**
- Test completes with status "success" but action logs show 0 gameplay actions
- Screenshots show only loading screen or static start screen
- Action logs show "crash-detected" after 2.5 minutes
- Progress metrics show `progressScore = 0` and `uniqueGameStates = 1`

**Root Causes:**
1. Game requires specific user input (not detected by default strategies)
2. Game is embedded in an iframe (itch.io, GameJolt, etc.)
3. Game waiting for browser gestures (audio context, WebGL context)
4. Loading screen takes longer than timeout

**Diagnosis Steps:**

1. **Check if game is in iframe:**
   ```bash
   # Look at screenshot output directory for evidence
   # Inspect browser console logs for iframe detection
   grep -i "iframe" test-output.log
   ```

2. **Look for visual clues:**
   - Check first screenshot for "Click to Start" or similar prompts
   - Check for "Press Space/Enter" messages
   - Check for loading spinners or progress bars

3. **Enable verbose logging:**
   ```bash
   bun run cli test <url> --log-level debug 2>&1 | tee verbose.log
   grep "First action\|unstick\|strategy" verbose.log
   ```

**Solutions:**

### Solution 1: Provide Input Hint

If you know what input the game requires, provide it via command line:

```bash
bun run cli test "https://example.com/game" \
  --input-hint "Click screen to start, then use WASD to move and Space to jump"
```

The input hint helps the hybrid strategy and unstick logic make better decisions.

**Supported hints:**
- "Click to start"
- "Press Space to start"
- "Use WASD to move"
- "Arrow keys for movement"
- "Mouse only" (disable keyboard)
- "Keyboard only" (disable clicking)

### Solution 2: Increase Timeout for Slow Games

Some games have very slow loading screens:

```bash
bun run cli test "https://example.com/slow-game" \
  --timeout 180000  # 3 minutes instead of default 5 minutes
```

Monitor the logs to see if timeout increased waiting:

```bash
grep "First action is wait" test-output.log
```

### Solution 3: Check Iframe Handling

If game is in an iframe (especially itch.io), verify iframe detection worked:

```bash
grep -i "iframe\|game_drop\|switching context" test-output.log
```

If no iframe messages appear:
- Game may use non-standard iframe selector
- Check for custom `<embed>` or `<object>` tags
- Try refreshing the page (PR opportunity for improved detection)

### Solution 4: Disable Headless Mode for Debugging

Run with browser visible to see what the agent is experiencing:

```bash
HEADLESS=false bun run cli test "https://example.com/game" \
  --max-actions 5
```

This requires X11/display server on Linux or native Electron on Mac/Windows.

---

## Progress Metrics Show 0% Success Rate

**Symptoms:**
- `progressMetrics.progressScore` is 0 or very low
- `progressMetrics.uniqueStates` is 1 (only one screen seen)
- All screenshots look completely identical
- Test report shows "no meaningful progress"

**Root Causes:**
1. Game not responding to any input
2. Game stuck in infinite loading loop
3. Game requires browser permission (microphone, camera)
4. Game requires specific initialization (audio context unlock, WebGL setup)
5. Browser vendor issue (certain games don't work in Chromium-based browsers)

**Diagnosis Steps:**

1. **Check browser console for errors:**
   ```bash
   grep -i "error\|exception\|webgl\|audio\|permission" test-output-logs.txt
   ```

2. **Verify screenshots actually different:**
   ```bash
   # Check file sizes of captured screenshots
   ls -lh test-output/screenshots/ | tail -20

   # If all same size, likely identical content
   ```

3. **Check action execution logs:**
   ```bash
   grep "action\|click\|press" test-output/actions.log
   ```

**Solutions:**

### Solution 1: Check for Consent/Permission Prompts

Games may be waiting for:
- Cookie banner dismissal
- Age verification
- Privacy policy acceptance
- Audio context enable (browser permission)

**For cookie banners:**
```bash
bun run cli test <url> --input-hint "Accept privacy prompt before playing"
```

**For audio:**
Some games require audio context unlock (browser security feature):
```typescript
// This requires browser automation support for:
// 1. Detecting audio context requirement
// 2. Simulating user gesture to enable audio
```

Currently, this requires manual pre-enable. Workaround:
```bash
# Test with browser visible to manually enable audio
HEADLESS=false bun run cli test <url> --max-actions 3
```

### Solution 2: Try Different Input Methods

Games may require different input types:

```bash
# Try keyboard-first strategy
bun run cli test <url> --input-hint "Keyboard only - no mouse input"

# Try mouse-first strategy
bun run cli test <url> --input-hint "Click buttons - no keyboard"

# Try mixed with hints
bun run cli test <url> --input-hint "Click to start, Arrow keys to play"
```

### Solution 3: Check for WebGL/Browser Support

Some games are WebGL-only and don't work in headless Chromium:

```bash
grep -i "webgl\|gpu\|graphics" test-output-logs.txt
```

**Workaround:**
- Check if game has fallback 2D Canvas version
- Consider browser with GPU support (requires GPU-enabled container)
- Test in non-headless browser mode (slower but works)

### Solution 4: Increase Max Actions with Aggressive Retries

Sometimes games take many attempts to respond:

```bash
bun run cli test <url> \
  --max-actions 30 \
  --timeout 300000 \
  --input-hint "Keyboard only - may need multiple tries"
```

This allows more attempts to trigger initial response.

---

## Vision Analysis Keeps Failing

**Symptoms:**
- Logs show "Vision API error" or "Invalid vision response"
- Vision strategy in unstick sequence silently fails
- Progress doesn't improve even with strategies enabled
- Error mentions "rate limit" or "API timeout"

**Root Causes:**
1. OpenAI API rate limit exceeded
2. Invalid API key or insufficient quota
3. Screenshot too large for API
4. Vision analyzer timeout
5. Temporary API service issue

**Diagnosis Steps:**

1. **Check API configuration:**
   ```bash
   # Verify OPENAI_API_KEY is set
   echo $OPENAI_API_KEY

   # Check if key works with direct API call
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY" | head -20
   ```

2. **Check logs for vision errors:**
   ```bash
   grep -i "vision\|gpt-4o\|api.*error" test-output-logs.txt | head -20
   ```

3. **Monitor OpenAI API usage:**
   - Visit https://platform.openai.com/account/billing/usage
   - Check quota and remaining balance
   - Check rate limits for your account tier

**Solutions:**

### Solution 1: Rate Limiting - Reduce Test Frequency

If you're running many tests in quick succession:

```bash
# Add 60 second delay between tests
for url in url1 url2 url3; do
  bun run cli test "$url"
  sleep 60  # Wait before next test
done
```

Or reduce max actions per test:

```bash
bun run cli test <url> \
  --max-actions 5 \
  --skip-vision-strategy  # If implemented, skip expensive vision calls
```

### Solution 2: Check API Key and Quota

```bash
# Verify key is valid
OPENAI_API_KEY=$your_key bun run cli test <url> --log-level debug 2>&1 | \
  grep -i "openai\|401\|403"
```

If you see 401/403 errors:
- Regenerate API key on OpenAI platform
- Check key has vision capabilities (gpt-4o models)
- Verify key isn't revoked or expired

### Solution 3: Temporary API Issue - Retry with Backoff

OpenAI API occasionally has transient failures:

```bash
# Implement retry logic with backoff
retry_count=0
while [ $retry_count -lt 3 ]; do
  bun run cli test <url> && break
  retry_count=$((retry_count + 1))
  sleep $((retry_count * 30))  # 30s, 60s, 90s backoff
done
```

### Solution 4: Skip Vision for Testing, Use Heuristics Only

If vision is consistently failing, fall back to heuristics:

```bash
# Use heuristics + DOM strategies (no vision calls)
bun run cli test <url> \
  --max-actions 10 \
  --skip-vision  # If environment variable supported
```

The DOM Button Finder and Keyboard Mash strategies don't require API calls.

---

## Test Completes Instantly with No Actions

**Symptoms:**
- Test returns in <2 seconds
- Action count is 0
- Screenshot shows blank or error page
- No progress metrics captured

**Root Causes:**
1. Game URL returned HTTP error (404, 500, etc.)
2. Game blocked by CORS policy
3. Game requires specific headers or cookies
4. Browserbase sandbox restrictions
5. Invalid game URL provided

**Diagnosis Steps:**

1. **Check HTTP response:**
   ```bash
   curl -v <url> -A "Mozilla/5.0" | head -50
   ```

2. **Check for CORS errors:**
   ```bash
   grep -i "cors\|blocked\|cross-origin" test-output-logs.txt
   ```

3. **Check browser console logs:**
   ```bash
   cat test-output/console.log | head -30
   ```

**Solutions:**

### Solution 1: Verify URL is Accessible

```bash
# Simple check
curl -s <url> | head -100

# Check status code
curl -s -o /dev/null -w "%{http_code}" <url>
# Should be 200, not 404, 500, etc.
```

### Solution 2: Add Required Headers/Cookies

Some games require specific headers:

```bash
# Check if game requires authentication or specific headers
curl -v <url> -H "Referer: <origin>" -H "User-Agent: Chrome/120"
```

Currently, QA orchestrator doesn't support custom headers (feature request for v1.5).

### Solution 3: Check Browserbase Connectivity

If using Browserbase (cloud browsers):

```bash
# Verify BROWSERBASE_API_KEY is set
echo $BROWSERBASE_API_KEY

# Check Browserbase service status
curl https://api.browserbase.com/v1/sessions -H "x-bb-api-key: $BROWSERBASE_API_KEY"
```

---

## High Action Count but Low Progress Score

**Symptoms:**
- Test shows 20+ actions attempted
- Progress score is still low (20-40%)
- Unique states is 2-3 (very few screen changes)
- Game appears responsive but progress minimal

**Root Causes:**
1. Actions found by heuristics but don't match game mechanics
2. Vision analysis identifying wrong targets
3. Game has very subtle state changes (not visible in screenshots)
4. Game UI updates without full screen changes

**Diagnosis Steps:**

1. **Check action success rate:**
   ```bash
   # Calculate: successfulActions / inputsAttempted
   grep "Screenshot changed\|Screenshot unchanged" test-output-logs.txt | wc -l
   ```

2. **Review action types:**
   ```bash
   grep "action.*type:" test-output-logs.txt | sort | uniq -c
   ```

3. **Check for action repetition:**
   ```bash
   # Look for same action repeated many times (bad sign)
   grep "action.*details:" test-output-logs.txt | sort | uniq -c | sort -rn
   ```

**Solutions:**

### Solution 1: Reduce Action Repetition

If same action repeated many times, unstick strategies may be stuck in a loop:

```bash
bun run cli test <url> \
  --max-actions 15 \
  --input-hint "Avoid repeated same action"
```

### Solution 2: Provide Better Input Hint

```bash
bun run cli test <url> \
  --input-hint "Game has hidden menus, click edges of screen to reveal"
```

Better hints help heuristics and vision analysis avoid dead ends.

### Solution 3: Check for Non-Visual State Changes

Some games change state without visible feedback:

```bash
# Check browser console for game state logs
grep -i "loaded\|level\|score\|state" test-output/console.log
```

If game logs state changes not visible in screenshots, this is a game design issue (not QA agent issue).

---

## Test Timeout Exceeded

**Symptoms:**
- Test runs for exactly configured timeout (default 300s)
- Stops mid-execution
- Final action count is exactly at configured limit
- No timeout error message (just stops)

**Root Causes:**
1. Game is actually infinite (procedurally generated, won't end)
2. Game requires completion steps not in heuristics
3. Timeout value too low for slow game
4. Network latency causing slow action execution

**Solutions:**

### Solution 1: Increase Timeout

```bash
bun run cli test <url> \
  --timeout 600000  # 10 minutes instead of 5
```

Monitor logs to see progress:
```bash
bun run cli test <url> --timeout 600000 --log-level info | tail -20
```

### Solution 2: Reduce Max Actions

Some games just take many small steps:

```bash
bun run cli test <url> \
  --max-actions 15  # Reduce from default 50
```

This trades coverage for speed.

### Solution 3: Check if Game is Actually Infinite

Review screenshots at end of test sequence:

```bash
# Look at last 5 screenshots
ls -t test-output/screenshots/*.png | head -5 | xargs file
```

If screenshots show game progressing properly (new levels, new content), then it's just a long game - increase timeout.

---

## Common Error Messages

### "Game Crashed: Navigation Timeout"
- Browser failed to load page within timeout
- **Fix:** Increase `--timeout` or check game URL accessibility

### "No Interactive Elements Found"
- DOM analysis found no buttons, inputs, or clickable elements
- **Fix:** Provide `--input-hint` or check if game uses Canvas/WebGL only

### "All Unstick Strategies Failed"
- Game stuck on start screen and all recovery strategies failed
- **Fix:** Provide `--input-hint` with specific control information

### "Vision API Returned Invalid Response"
- Vision analyzer couldn't understand screenshot
- **Fix:** Check API key/quota, retry, or skip vision strategy

### "Browser Session Lost"
- Browserbase connection dropped mid-test
- **Fix:** Retry test, check network, verify API credentials

---

## Getting Help

If you've worked through this troubleshooting guide and still have issues:

1. **Gather debug information:**
   ```bash
   bun run cli test <url> --log-level debug 2>&1 > debug-output.txt

   # Attach: debug-output.txt, screenshots directory, and console.log
   ```

2. **Check improvement plan status:**
   - Review `/docs/improvement-plan-game-progression.md`
   - Verify which phases have been implemented
   - Check v1.4.0 features availability

3. **Report with context:**
   - Game URL (if public)
   - Input type (click/keyboard/mixed)
   - Expected behavior
   - Actual behavior
   - Debug logs and evidence files
