# Denethor Quick Start Guide

Get Denethor running in 5 minutes! This guide walks you through setup from scratch.

---

## Prerequisites

Before you begin, install these tools:

1. **Bun** (JavaScript runtime) - [Install Bun](https://bun.sh/)
   ```bash
   # macOS/Linux
   curl -fsSL https://bun.sh/install | bash

   # Windows
   powershell -c "irm bun.sh/install.ps1 | iex"
   ```

2. **Git** (to clone the repo) - [Install Git](https://git-scm.com/downloads)

That's it! Bun includes everything else you need.

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/Denethor.git
cd Denethor
```

---

## Step 2: Install Dependencies

```bash
bun install
```

This will install all required packages (~2-3 minutes on first run).

---

## Step 3: Set Up API Keys

Denethor requires two API keys:

### 3.1 Get Your Browserbase API Key

**Browserbase** provides cloud browsers for testing.

1. Go to [https://www.browserbase.com/](https://www.browserbase.com/)
2. Sign up for a free account
3. After signup, go to **Settings > API Keys**
4. Copy your:
   - **API Key** (starts with `bb_api_...`)
   - **Project ID** (starts with `proj_...`)

**Free Tier:**
- 10 hours/month of browser time
- Perfect for testing and demos
- No credit card required

### 3.2 Get Your OpenAI API Key

**OpenAI** powers the AI evaluation and vision analysis.

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click **"+ Create new secret key"**
4. Give it a name (e.g., "Denethor Testing")
5. Copy the API key (starts with `sk-...`)
   - ⚠️ **Important:** Copy it now! You can't see it again after closing the dialog

**Cost Estimate:**
- ~$0.05-0.10 per test
- New accounts get $5 free credit
- That's 50-100 free tests!

### 3.3 Create Your .env File

Copy the example environment file and add your keys:

```bash
# Copy the example file
cp .env.example .env

# Open in your favorite editor
nano .env
# or
code .env
# or
vim .env
```

**Replace the placeholder values with your actual API keys:**

```bash
# Browserbase API credentials
BROWSERBASE_API_KEY=bb_api_your_actual_key_here
BROWSERBASE_PROJECT_ID=proj_your_actual_project_id_here

# OpenAI API credentials
OPENAI_API_KEY=sk-your_actual_openai_key_here

# Optional settings (you can leave these as-is)
OUTPUT_DIR=./qa-tests/default
LOG_LEVEL=info
```

**Save the file** (Ctrl+X if using nano, or Cmd+S in VS Code).

---

## Step 4: Verify Your Setup

Run a quick test to verify everything works:

```bash
bun run quick-test https://meiri.itch.io/doce-fim
```

**Expected output:**
```
✅ Session created successfully
✅ Game loaded
✅ Screenshot captured
✅ Session closed (took 16 seconds)
✅ Reports generated

📊 Reports saved to: ./qa-tests/default/test-<id>/reports/
```

**If you see this, you're all set!** 🎉

---

## Step 5: View Your First Report

Open the HTML report in your browser:

```bash
# macOS
open qa-tests/default/test-*/reports/report.html

# Linux
xdg-open qa-tests/default/test-*/reports/report.html

# Windows
start qa-tests/default/test-*/reports/report.html
```

You should see:
- **Playability scores** (0-100 for each dimension)
- **Issues detected** with severity and recommendations
- **Sequential screenshots** showing the entire test
- **Console logs** and action traces

---

## What's Next?

### Run a Full Test

```bash
bun run cli test https://meiri.itch.io/doce-fim \
  --max-actions 20 \
  --game-type visual-novel \
  --input-hint "Click to advance dialogue"
```

### Try Different Games

```bash
# Test a platformer
bun run cli test https://example.com/platformer \
  --game-type platformer \
  --input-hint "Arrow keys for movement, spacebar to jump"

# Test a clicker game
bun run cli test https://example.com/clicker \
  --game-type clicker \
  --input-hint "Click repeatedly to gain resources"
```

### View All CLI Options

```bash
bun run cli test --help
```

### Check the Full Documentation

- **[README.md](README.md)** - Complete feature overview
- **[User Guide](docs/user-guide/getting-started.md)** - Detailed usage
- **[API Documentation](docs/api/README.md)** - Programmatic usage
- **[DEMO-GUIDE.md](DEMO-GUIDE.md)** - Demo walkthrough

---

## Troubleshooting

### "Command not found: bun"

**Solution:** Install Bun first (see Prerequisites)

### "BROWSERBASE_API_KEY is required"

**Problem:** Your .env file is missing or has incorrect keys.

**Solution:**
1. Verify `.env` file exists: `ls -la .env`
2. Check the contents: `cat .env`
3. Make sure API keys don't have extra spaces or quotes
4. Verify keys start with:
   - `bb_api_...` (Browserbase API key)
   - `proj_...` (Browserbase Project ID)
   - `sk-...` (OpenAI API key)

### "OpenAI API error: 401 Unauthorized"

**Problem:** Invalid OpenAI API key.

**Solution:**
1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Verify your key is active (not revoked)
3. Create a new key if needed
4. Update `.env` with the new key

### "Browserbase session creation failed"

**Problem:** Invalid Browserbase credentials or quota exceeded.

**Solution:**
1. Check your Browserbase dashboard for usage
2. Verify your free tier hasn't expired
3. Try creating a new API key in Browserbase settings
4. Update `.env` with fresh credentials

### "Test hangs/never completes"

**Problem:** Network issues or timeout too short.

**Solution:**
```bash
# Increase timeout
bun run cli test <url> --timeout 600000 --max-duration 300000
```

### "Module not found" errors

**Problem:** Dependencies not installed.

**Solution:**
```bash
# Clean install
rm -rf node_modules
bun install
```

### Still Having Issues?

1. Check the [GitHub Issues](https://github.com/yourusername/Denethor/issues) page
2. Enable debug logging: Edit `.env` and set `LOG_LEVEL=debug`
3. Run test again and check `qa-tests/*/logs/errors.log`
4. Open a new issue with:
   - Your OS (macOS/Linux/Windows)
   - Error message
   - Steps to reproduce

---

## Security Best Practices

### Never Commit Your .env File

The `.gitignore` already excludes `.env`, but be careful:

```bash
# ✅ SAFE: Copy example for reference
cp .env.example .env.backup

# ❌ DANGEROUS: Don't do this
git add .env
git add -f .env
```

### Rotate API Keys Regularly

If you accidentally expose your keys:

1. **Browserbase:**
   - Go to Settings > API Keys
   - Click "Revoke" on the exposed key
   - Create a new key
   - Update `.env`

2. **OpenAI:**
   - Go to [API Keys](https://platform.openai.com/api-keys)
   - Click "Revoke" on the exposed key
   - Create a new key
   - Update `.env`

### Use Environment Variables in CI/CD

For GitHub Actions, Vercel, etc., use their secret management:

```yaml
# GitHub Actions example
- name: Run tests
  env:
    BROWSERBASE_API_KEY: ${{ secrets.BROWSERBASE_API_KEY }}
    BROWSERBASE_PROJECT_ID: ${{ secrets.BROWSERBASE_PROJECT_ID }}
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: bun run cli test https://example.com/game
```

---

## Cost Management

### Monitor Usage

- **Browserbase:** Check [dashboard](https://www.browserbase.com/dashboard) for session time
- **OpenAI:** Check [usage page](https://platform.openai.com/usage) for API costs

### Optimize Costs

```bash
# Shorter tests = lower cost
bun run cli test <url> \
  --max-actions 10 \        # Reduce from default 20
  --max-duration 120000     # 2 minutes instead of 5
```

### Set Budget Alerts

Both Browserbase and OpenAI allow setting spend limits:

1. **OpenAI:** Settings > Usage Limits
2. **Browserbase:** Account > Billing > Set Alert

---

## Next Steps

Now that you're set up:

1. ✅ **Test different game types** - Try platformers, puzzles, clickers
2. ✅ **Integrate into CI/CD** - Automate testing on every deploy
3. ✅ **Deploy to Lambda** - See [AWS Lambda Guide](docs/deployment/aws-lambda.md)
4. ✅ **Customize heuristics** - See [Advanced Usage](examples/advanced-usage.ts)
5. ✅ **Contribute** - See [CONTRIBUTING.md](CONTRIBUTING.md)

---

**Happy Testing! 🎮🤖**

Questions? Check the [FAQ](README.md#faq) or open an [issue](https://github.com/yourusername/Denethor/issues).
