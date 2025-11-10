# Browserbase Setup Guide

This guide walks you through setting up Browserbase for Denethor. Browserbase provides cloud-hosted Chrome browsers that enable reliable browser automation in serverless environments like AWS Lambda.

## Table of Contents

- [Why Browserbase?](#why-browserbase)
- [Account Setup](#account-setup)
- [Getting API Credentials](#getting-api-credentials)
- [Configuring Denethor](#configuring-browsergameqa)
- [Verifying Connection](#verifying-connection)
- [Usage Limits & Pricing](#usage-limits--pricing)
- [Troubleshooting](#troubleshooting)

---

## Why Browserbase?

Denethor uses Browserbase for browser automation because:

- **Lambda Compatible**: Works seamlessly in AWS Lambda without complex setup
- **No Chrome Binary**: No need to package Chromium with your deployment (saves 100MB+)
- **Reliable**: Cloud browsers with predictable performance
- **Headless by Default**: Perfect for automated QA testing
- **Screenshot Support**: Built-in screenshot capture
- **Stagehand Integration**: Works with @browserbasehq/stagehand for AI-powered automation

**Alternative**: You can use Playwright or Puppeteer locally, but they won't work in Lambda without significant configuration.

---

## Account Setup

### Step 1: Sign Up for Browserbase

1. Go to [https://www.browserbase.com/](https://www.browserbase.com/)
2. Click **Sign Up** or **Get Started**
3. Create account with:
   - Email address
   - Password
   - Or sign in with GitHub/Google

### Step 2: Verify Email

1. Check your email for verification link
2. Click the link to verify your account
3. You'll be redirected to the Browserbase dashboard

### Step 3: Choose a Plan

Browserbase offers several pricing tiers:

| Plan | Cost | Browser Hours | Best For |
|------|------|---------------|----------|
| **Free Trial** | $0 | 1 hour | Testing Denethor |
| **Starter** | $49/mo | 10 hours | Small projects, development |
| **Pro** | $199/mo | 50 hours | Production use |
| **Enterprise** | Custom | Unlimited | High-volume QA |

**For Denethor:**
- **Free Trial**: Good for 12 tests (5 min each)
- **Starter**: ~120 tests per month
- **Pro**: ~600 tests per month

**Recommendation**: Start with the **Free Trial** to test the system, then upgrade based on your usage.

---

## Getting API Credentials

After creating your account, you need two pieces of information:
1. **API Key** - Authenticates your requests
2. **Project ID** - Identifies which project to use

### Step 1: Create a Project

1. In the Browserbase dashboard, go to **Projects**
2. Click **Create Project** (or use the default project)
3. Name your project: `Denethor` (or any name you prefer)
4. Click **Create**

### Step 2: Get Your API Key

1. Go to **Settings** → **API Keys**
2. Click **Create API Key**
3. Name it: `Denethor Production` or `Denethor Development`
4. Click **Create**
5. **Important**: Copy the API key immediately - it won't be shown again!

```
Example API key format:
bb_api_1a2b3c4d5e6f7g8h9i0j
```

### Step 3: Get Your Project ID

1. Go to **Projects**
2. Click on your project name (`Denethor`)
3. Find the **Project ID** in the project details

```
Example Project ID format:
proj_abc123def456ghi789
```

---

## Configuring Denethor

Now that you have your credentials, configure Denethor to use them.

### For Local Development

1. Navigate to your Denethor project directory
2. Copy the example environment file:

```bash
cp .env.example .env
```

3. Edit `.env` with your credentials:

```bash
# .env file
BROWSERBASE_API_KEY=bb_api_1a2b3c4d5e6f7g8h9i0j
BROWSERBASE_PROJECT_ID=proj_abc123def456ghi789
OPENAI_API_KEY=your_openai_api_key_here
```

4. Save the file

**Security Note**: Never commit `.env` to git! It's already in `.gitignore`.

### For AWS Lambda

1. Go to [AWS Lambda Console](https://console.aws.amazon.com/lambda/)
2. Select your `browsergame-qa` function
3. Go to **Configuration** → **Environment variables**
4. Click **Edit**
5. Add variables:
   - `BROWSERBASE_API_KEY` = your API key
   - `BROWSERBASE_PROJECT_ID` = your project ID
   - `OPENAI_API_KEY` = your OpenAI key
6. Click **Save**

### For CI/CD (GitHub Actions)

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret:
   - Name: `BROWSERBASE_API_KEY`, Value: your key
   - Name: `BROWSERBASE_PROJECT_ID`, Value: your project ID
   - Name: `OPENAI_API_KEY`, Value: your key
5. Update `.github/workflows/ci.yml` to use these secrets

---

## Verifying Connection

After configuring credentials, verify that Denethor can connect to Browserbase.

### Test Connection Locally

```bash
# Run a simple test
bun run src/cli/index.ts test https://example.com

# You should see:
# ✓ Creating Browserbase session...
# ✓ Navigating to game...
# ✓ Running test actions...
```

If connection succeeds, you'll see logs showing:
- Session creation
- Browser connection
- Page navigation

### Test Connection in Lambda

```bash
# Create test event
cat > test-event.json << 'EOF'
{
  "body": "{\"gameUrl\":\"https://example.com\",\"maxActions\":5}"
}
EOF

# Invoke Lambda function
aws lambda invoke \
  --function-name browsergame-qa \
  --payload file://test-event.json \
  response.json

# Check response
cat response.json
```

Expected response:
```json
{
  "statusCode": 200,
  "body": "{\"testId\":\"...\",\"status\":\"success\",...}"
}
```

---

## Usage Limits & Pricing

### Understanding Browser Hours

- **1 browser hour** = 60 minutes of browser runtime
- Denethor tests typically use **5 minutes** of browser time
- **Tests per hour**: ~12 tests per browser hour

### Calculating Your Needs

| Tests per Day | Browser Hours per Month | Recommended Plan |
|---------------|------------------------|------------------|
| 1-2 tests | < 1 hour | Free Trial |
| 5-10 tests | 2-5 hours | Starter |
| 20-50 tests | 10-25 hours | Starter |
| 100+ tests | 50+ hours | Pro |

### Cost Optimization Tips

1. **Reduce Test Duration**
   - Set `maxActions` to minimum needed (10-15 instead of 20)
   - Decrease `sessionTimeout` (240000ms instead of 300000ms)

2. **Smart Test Scheduling**
   - Batch tests during off-peak hours
   - Only test changed games, not all games repeatedly

3. **Monitor Usage**
   - Check Browserbase dashboard for usage metrics
   - Set up alerts when approaching limits

4. **Local Development**
   - Use mocked tests during development
   - Only use Browserbase for integration testing

---

## Troubleshooting

### Issue: "Browserbase API key is invalid"

**Cause**: API key is incorrect or expired

**Solutions**:
1. Verify API key in `.env` or Lambda environment variables
2. Check for extra spaces or quotes
3. Regenerate API key in Browserbase dashboard:
   - Go to **Settings** → **API Keys**
   - Delete old key
   - Create new key
   - Update `.env` or Lambda

### Issue: "Project not found"

**Cause**: Project ID is incorrect

**Solutions**:
1. Go to Browserbase dashboard → **Projects**
2. Verify Project ID matches exactly
3. Ensure you're using the correct Browserbase account

### Issue: "Browser session creation failed"

**Cause**: Browserbase service issue or account problem

**Solutions**:
1. Check [Browserbase Status Page](https://status.browserbase.com/)
2. Verify your account is active (not suspended)
3. Check usage limits - you may have exceeded your plan
4. Contact Browserbase support if issue persists

### Issue: "Out of browser hours"

**Cause**: Monthly limit reached

**Solutions**:
1. Check usage in Browserbase dashboard
2. Wait until next billing cycle
3. Upgrade to higher plan
4. Purchase additional browser hours (if available)

### Issue: "Connection timeout"

**Cause**: Network issues or Lambda timeout

**Solutions**:
1. Increase Lambda timeout to 300 seconds (5 minutes)
2. Check AWS Lambda VPC configuration (if using VPC)
3. Verify Browserbase service is operational
4. Try again - may be temporary network issue

### Viewing Browserbase Logs

Browserbase provides session logs in their dashboard:

1. Go to **Sessions** in Browserbase dashboard
2. Find your test session (search by timestamp)
3. Click on session to view:
   - Browser console logs
   - Network requests
   - Screenshots (if captured)
   - Error messages

---

## Best Practices

### Security

- **Never expose API keys** in client-side code
- **Rotate API keys** every 90 days
- **Use separate keys** for development and production
- **Monitor API key usage** in Browserbase dashboard

### Performance

- **Reuse sessions** when possible (future enhancement)
- **Close sessions promptly** - don't leave them running
- **Monitor session duration** to optimize costs
- **Use timeouts** to prevent hung sessions

### Monitoring

- **Track usage daily** in Browserbase dashboard
- **Set up billing alerts** before hitting limits
- **Monitor error rates** for failed sessions
- **Review session logs** for debugging

---

## Next Steps

- [AWS Lambda Deployment](./aws-lambda.md) - Deploy to Lambda
- [API Documentation](../api/README.md) - Learn programmatic usage
- [Getting Started Guide](../user-guide/getting-started.md) - Run your first test

---

## Additional Resources

- [Browserbase Documentation](https://docs.browserbase.com/)
- [Stagehand Documentation](https://github.com/browserbase/stagehand)
- [Browserbase Support](https://www.browserbase.com/support)
- [Browserbase Status Page](https://status.browserbase.com/)
- [Browserbase Pricing](https://www.browserbase.com/pricing)
