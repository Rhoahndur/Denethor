# Denethor QA Automation - Quick Demo Guide

## 🚀 Quick Start (Demo Mode)

### Option 1: Offline Demo (Recommended - No Rate Limits!)
```bash
bun run demo
```
**What it does:**
- Creates mock test evidence (screenshots, logs)
- Generates reports in all 3 formats (JSON, Markdown, HTML)
- Demonstrates the full reporting pipeline
- **No API calls = No rate limits!**

**View the results:**
```bash
# Open the latest HTML report in your browser
open demo-output/test-*/reports/report.html

# Or view the markdown report
cat demo-output/test-*/reports/report.md
```

### Option 2: Live Test (Requires Browserbase API)
```bash
bun run demo:throttled
```
**What it does:**
- Connects to real Browserbase cloud browser
- Tests a real game URL
- Throttled to respect free tier limits (15s delays)
- Reduced to 3 actions, 60s timeout for faster demo

**Note:** Free tier = 1 concurrent session, 5 sessions/minute

### Check Browserbase Sessions
```bash
bun run demo:cleanup
```
Shows all active/completed Browserbase sessions.

---

## 📊 What's Working (100% Tested)

| Component | Tests | Status |
|-----------|-------|--------|
| Evidence Store | 60/60 | ✅ 100% |
| Report Generation | 51/51 | ✅ 100% |
| Error Handling | 31/31 | ✅ 100% |

---

## 🎯 Demo Video Quick Commands

```bash
# 1. Show test coverage
bun test src/evidence-store/
bun test src/report-generator/
bun test src/errors/

# 2. Run offline demo
bun run demo

# 3. Open HTML report
open demo-output/test-*/reports/report.html

# 4. (Optional) Run live test if not hitting rate limits
bun run demo:throttled
```

---

## 📁 Project Structure

```
Denethor/
├── src/
│   ├── orchestrator/      # Main test coordinator
│   ├── browser-agent/     # Browserbase + Stagehand automation
│   ├── ai-evaluator/      # OpenAI-powered scoring
│   ├── evidence-store/    # Screenshot + log collection
│   └── report-generator/  # Multi-format reports
├── demo-test.ts           # Offline demo (no APIs)
├── throttled-test.ts      # Live test (rate-limited)
├── cleanup-sessions.ts    # Session management
└── DEMO-GUIDE.md         # Full demo documentation
```

---

## 🎬 Report Preview

The HTML reports include:
- **Summary Card:** Status, overall score, duration, issues
- **Score Bars:** Load success, responsiveness, stability
- **AI Evaluation:** Reasoning and confidence level
- **Issue List:** Categorized by severity (critical/major/minor)
- **Action Timeline:** What the AI agent did
- **Evidence:** Screenshots and log files

**Beautiful gradient design with responsive layout!**

---

## 🔧 Troubleshooting

### "Rate limit 429 error"
**Solution:** Wait 60 seconds, then run `bun run demo:cleanup` to check sessions.

### "Playwright not supported in Bun"
**Solution:** The throttled test already uses Node.js (`npx tsx`).

### "Environment variables not loading"
**Solution:** With Bun it auto-loads. With Node.js we use `-r dotenv/config`.

---

## 📝 API Keys Status

All configured in `.env`:
- ✅ BROWSERBASE_API_KEY (for cloud browsers)
- ✅ BROWSERBASE_PROJECT_ID
- ✅ OPENAI_API_KEY (for AI evaluation)

---

## 🎥 Recommended Demo Flow

1. **Show the offline demo** (`bun run demo`)
   - No rate limits
   - Shows all core features
   - Beautiful HTML report

2. **Open HTML report in browser**
   - Show the gradient design
   - Point out score bars
   - Highlight AI evaluation

3. **Show the evidence files**
   - Screenshots folder
   - Log files
   - Metadata

4. **(Optional) Run live test** if no rate limits
   - Shows real browser automation
   - Real AI evaluation
   - Complete end-to-end flow

---

**Ready to demo!** 🎉

For full details, see [DEMO-GUIDE.md](./DEMO-GUIDE.md)
