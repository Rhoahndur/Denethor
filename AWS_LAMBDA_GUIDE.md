# AWS Lambda Deployment - Step-by-Step Guide

This guide walks you through deploying Denethor to AWS Lambda from scratch.

**Time Required:** ~30-45 minutes
**Cost:** ~$1-5/month (depending on usage)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Set Up AWS CLI](#step-1-set-up-aws-cli)
3. [Step 2: Create Deployment Package](#step-2-create-deployment-package)
4. [Step 3: Create IAM Role](#step-3-create-iam-role)
5. [Step 4: Create Lambda Function](#step-4-create-lambda-function)
6. [Step 5: Test Your Function](#step-5-test-your-function)
7. [Step 6: Set Up API Gateway (Optional)](#step-6-set-up-api-gateway-optional)
8. [Step 7: Monitor and Debug](#step-7-monitor-and-debug)
9. [Troubleshooting](#troubleshooting)
10. [Cost Optimization](#cost-optimization)

---

## Prerequisites

### What You Need

- [x] **AWS Account** - [Sign up for free](https://aws.amazon.com/free/)
- [x] **AWS CLI** - We'll install this together
- [x] **Your API Keys**:
  - Browserbase API key
  - Browserbase Project ID
  - OpenAI API key
- [x] **Denethor working locally** - Complete [QUICKSTART.md](QUICKSTART.md) first

### Check Your Local Setup

```bash
# Make sure Denethor works locally first
bun run quick-test https://meiri.itch.io/doce-fim

# You should see:
# ✅ Session created successfully
# ✅ Game loaded
# ✅ Screenshot captured
```

If this doesn't work, go back to [QUICKSTART.md](QUICKSTART.md) before proceeding.

---

## Step 1: Set Up AWS CLI

### Install AWS CLI

**macOS:**
```bash
brew install awscli
```

**Linux:**
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

**Windows:**
```powershell
# Download and run the MSI installer from:
# https://awscli.amazonaws.com/AWSCLIV2.msi
```

### Verify Installation

```bash
aws --version
# Should output: aws-cli/2.x.x Python/3.x.x ...
```

### Configure AWS CLI

```bash
aws configure
```

You'll be prompted for:

1. **AWS Access Key ID**: Get from [AWS Console > IAM > Users > Security credentials](https://console.aws.amazon.com/iam/)
2. **AWS Secret Access Key**: Shown when you create access key
3. **Default region**: Use `us-east-1` (or your preferred region)
4. **Default output format**: Use `json`

**Example:**
```
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: us-east-1
Default output format [None]: json
```

### Test AWS Access

```bash
aws sts get-caller-identity
```

**Expected output:**
```json
{
    "UserId": "AIDAI...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```

✅ **If you see this, AWS CLI is configured correctly!**

---

## Step 2: Create Deployment Package

### Navigate to Project Directory

```bash
cd /path/to/Denethor
```

### Install Production Dependencies

```bash
# Remove dev dependencies
rm -rf node_modules

# Install only production dependencies
bun install --production
```

### Create Lambda Handler (Already Exists!)

Verify the Lambda handler exists:

```bash
cat src/lambda/handler.ts
```

You should see the handler function that AWS Lambda will invoke.

### Create Deployment ZIP

```bash
# Create the deployment package
zip -r lambda-deployment.zip . \
  -x "*.git*" \
  -x "*.env*" \
  -x ".env.example" \
  -x "qa-tests/*" \
  -x "my-results/*" \
  -x "node_modules/.cache/*" \
  -x "coverage/*" \
  -x "*.log" \
  -x "*.test.ts" \
  -x "*.md" \
  -x "LICENSE" \
  -x "DEMO-*" \
  -x "PRD.md" \
  -x ".DS_Store"
```

**This creates:** `lambda-deployment.zip` (~20-30 MB)

### Verify ZIP Contents

```bash
unzip -l lambda-deployment.zip | head -20
```

**You should see:**
- `src/` directory
- `node_modules/` directory
- `package.json`
- `bun.lockb`

✅ **Deployment package ready!**

---

## Step 3: Create IAM Role

AWS Lambda needs permission to execute and write logs. We'll create an IAM role with the necessary permissions.

### Create Trust Policy

```bash
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Service": "lambda.amazonaws.com"
    },
    "Action": "sts:AssumeRole"
  }]
}
EOF
```

### Create IAM Role

```bash
aws iam create-role \
  --role-name DenethorLambdaRole \
  --assume-role-policy-document file://trust-policy.json
```

**Expected output:**
```json
{
    "Role": {
        "Path": "/",
        "RoleName": "DenethorLambdaRole",
        "RoleId": "AROA...",
        "Arn": "arn:aws:iam::123456789012:role/DenethorLambdaRole",
        ...
    }
}
```

**📝 Copy the `Arn` - you'll need it in the next step!**

Example: `arn:aws:iam::123456789012:role/DenethorLambdaRole`

### Attach Basic Execution Policy

This allows Lambda to write logs to CloudWatch:

```bash
aws iam attach-role-policy \
  --role-name DenethorLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

**No output means success!**

### Verify Role Creation

```bash
aws iam get-role --role-name DenethorLambdaRole
```

✅ **IAM role created successfully!**

---

## Step 4: Create Lambda Function

### Set Your API Keys as Variables

**Replace with your actual keys:**

```bash
# Save your keys to variables (easier than typing them repeatedly)
export BROWSERBASE_API_KEY="bb_api_your_actual_key_here"
export BROWSERBASE_PROJECT_ID="proj_your_actual_project_id_here"
export OPENAI_API_KEY="sk-your_actual_key_here"

# Verify they're set
echo "Browserbase: ${BROWSERBASE_API_KEY:0:20}..."
echo "Project ID: ${BROWSERBASE_PROJECT_ID:0:20}..."
echo "OpenAI: ${OPENAI_API_KEY:0:20}..."
```

### Get Your AWS Account ID

```bash
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: $AWS_ACCOUNT_ID"
```

### Create Lambda Function

```bash
aws lambda create-function \
  --function-name denethor-game-qa \
  --runtime nodejs20.x \
  --handler src/lambda/handler.handler \
  --role arn:aws:iam::${AWS_ACCOUNT_ID}:role/DenethorLambdaRole \
  --zip-file fileb://lambda-deployment.zip \
  --timeout 300 \
  --memory-size 2048 \
  --environment "Variables={
    BROWSERBASE_API_KEY=${BROWSERBASE_API_KEY},
    BROWSERBASE_PROJECT_ID=${BROWSERBASE_PROJECT_ID},
    OPENAI_API_KEY=${OPENAI_API_KEY},
    OUTPUT_DIR=/tmp/qa-tests,
    LOG_LEVEL=info
  }"
```

**This will take 10-30 seconds...**

**Expected output:**
```json
{
    "FunctionName": "denethor-game-qa",
    "FunctionArn": "arn:aws:lambda:us-east-1:123456789012:function:denethor-game-qa",
    "Runtime": "nodejs20.x",
    "Role": "arn:aws:iam::123456789012:role/DenethorLambdaRole",
    "Handler": "src/lambda/handler.handler",
    "CodeSize": 25678910,
    "Timeout": 300,
    "MemorySize": 2048,
    "State": "Pending",
    ...
}
```

### Wait for Function to be Active

```bash
aws lambda wait function-active --function-name denethor-game-qa
echo "✅ Lambda function is active!"
```

✅ **Lambda function created successfully!**

---

## Step 5: Test Your Function

### Create Test Event

```bash
cat > test-event.json << 'EOF'
{
  "body": "{\"gameUrl\":\"https://meiri.itch.io/doce-fim\",\"maxActions\":10,\"maxDuration\":120000}"
}
EOF
```

### Invoke Lambda Function

```bash
aws lambda invoke \
  --function-name denethor-game-qa \
  --payload file://test-event.json \
  --cli-binary-format raw-in-base64-out \
  response.json
```

**This will take 2-5 minutes (the function is running your test!)...**

**Expected output:**
```json
{
    "StatusCode": 200,
    "ExecutedVersion": "$LATEST"
}
```

### View Response

```bash
cat response.json | jq .
```

**Expected response:**
```json
{
  "statusCode": 200,
  "body": "{\"testId\":\"abc-123-def\",\"status\":\"success\",\"scores\":{\"loadSuccess\":85,\"responsiveness\":75,\"stability\":80,\"overallPlayability\":78}}"
}
```

✅ **Lambda function is working!** 🎉

### View Logs in CloudWatch

```bash
# Get the latest log stream
aws logs describe-log-streams \
  --log-group-name /aws/lambda/denethor-game-qa \
  --order-by LastEventTime \
  --descending \
  --max-items 1 \
  --query 'logStreams[0].logStreamName' \
  --output text

# View logs (replace LOG_STREAM_NAME with output from above)
aws logs get-log-events \
  --log-group-name /aws/lambda/denethor-game-qa \
  --log-stream-name LOG_STREAM_NAME \
  --limit 50
```

**Or view in AWS Console:**
1. Go to [CloudWatch Logs](https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups)
2. Click `/aws/lambda/denethor-game-qa`
3. Click the latest log stream
4. See your test logs!

---

## Step 6: Set Up API Gateway (Optional)

This creates an HTTP endpoint so you can invoke your Lambda via HTTP requests.

### Create REST API

```bash
aws apigateway create-rest-api \
  --name "Denethor QA API" \
  --description "Browser game QA testing API" \
  --endpoint-configuration types=REGIONAL
```

**Expected output:**
```json
{
    "id": "abc123xyz",
    "name": "Denethor QA API",
    ...
}
```

**📝 Copy the `id` - this is your API ID**

### Set API ID Variable

```bash
export API_ID="abc123xyz"  # Replace with your actual API ID
```

### Get Root Resource ID

```bash
export ROOT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --query 'items[0].id' \
  --output text)

echo "Root Resource ID: $ROOT_RESOURCE_ID"
```

### Create Resource

```bash
aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_RESOURCE_ID \
  --path-part test
```

**Expected output:**
```json
{
    "id": "xyz789",
    "path": "/test",
    ...
}
```

**📝 Copy the resource `id`**

```bash
export RESOURCE_ID="xyz789"  # Replace with your actual resource ID
```

### Create POST Method

```bash
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method POST \
  --authorization-type NONE
```

### Link to Lambda

```bash
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:${AWS_ACCOUNT_ID}:function:denethor-game-qa/invocations
```

### Give API Gateway Permission to Invoke Lambda

```bash
aws lambda add-permission \
  --function-name denethor-game-qa \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:${AWS_ACCOUNT_ID}:${API_ID}/*/*"
```

### Deploy API

```bash
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod
```

### Get Your API Endpoint

```bash
echo "https://${API_ID}.execute-api.us-east-1.amazonaws.com/prod/test"
```

**📝 This is your HTTP endpoint!**

### Test via HTTP

```bash
curl -X POST \
  https://${API_ID}.execute-api.us-east-1.amazonaws.com/prod/test \
  -H "Content-Type: application/json" \
  -d '{
    "gameUrl": "https://meiri.itch.io/doce-fim",
    "maxActions": 10,
    "maxDuration": 120000
  }'
```

✅ **API Gateway configured!** You now have an HTTP endpoint for testing!

---

## Step 7: Monitor and Debug

### View Recent Invocations

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=denethor-game-qa \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

### View Errors

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=denethor-game-qa \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

### Tail Logs in Real-Time

```bash
# Install CloudWatch Logs CLI tool
brew install awslogs  # macOS
# or
pip install awslogs   # Other platforms

# Tail logs
awslogs get /aws/lambda/denethor-game-qa --watch
```

### View in AWS Console

1. **Lambda Console:** https://console.aws.amazon.com/lambda/home#/functions/denethor-game-qa
2. **CloudWatch Logs:** https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fdenethor-game-qa
3. **API Gateway Console:** https://console.aws.amazon.com/apigateway/home#/apis

---

## Troubleshooting

### Lambda Times Out

**Problem:** Function times out after 5 minutes

**Solution:** Tests are taking too long. Reduce test duration:

```bash
# Update Lambda timeout to 10 minutes (max 15)
aws lambda update-function-configuration \
  --function-name denethor-game-qa \
  --timeout 600

# Or reduce test duration in your requests
{
  "gameUrl": "https://example.com/game",
  "maxActions": 10,        // Reduce from 20
  "maxDuration": 120000    // 2 minutes instead of 5
}
```

### Out of Memory

**Problem:** Lambda runs out of memory (2048 MB)

**Solution:** Increase memory:

```bash
aws lambda update-function-configuration \
  --function-name denethor-game-qa \
  --memory-size 4096
```

### Environment Variables Not Set

**Problem:** "BROWSERBASE_API_KEY is required" error

**Solution:** Update environment variables:

```bash
aws lambda update-function-configuration \
  --function-name denethor-game-qa \
  --environment "Variables={
    BROWSERBASE_API_KEY=your_actual_key,
    BROWSERBASE_PROJECT_ID=your_actual_project,
    OPENAI_API_KEY=your_actual_key,
    OUTPUT_DIR=/tmp/qa-tests,
    LOG_LEVEL=debug
  }"
```

### Check Current Configuration

```bash
aws lambda get-function-configuration \
  --function-name denethor-game-qa
```

### Cold Start Too Slow

**Problem:** First invocation takes 10+ seconds

**Solutions:**

1. **Enable provisioned concurrency** (keeps 1 instance warm):
```bash
aws lambda put-provisioned-concurrency-config \
  --function-name denethor-game-qa \
  --provisioned-concurrent-executions 1 \
  --qualifier '$LATEST'
```
*Note: This costs ~$12/month but eliminates cold starts*

2. **Or reduce package size:**
```bash
# Remove unnecessary dependencies
bun install --production

# Re-create ZIP without dev dependencies
zip -r lambda-deployment.zip . -x <exclusions>
```

### Update Lambda Code

When you make changes to your code:

```bash
# Re-create deployment package
zip -r lambda-deployment.zip . -x "*.git*" -x "qa-tests/*" -x "my-results/*"

# Update Lambda function
aws lambda update-function-code \
  --function-name denethor-game-qa \
  --zip-file fileb://lambda-deployment.zip
```

### View All Lambda Functions

```bash
aws lambda list-functions --query 'Functions[].FunctionName'
```

### Delete Lambda Function (Cleanup)

```bash
# Delete function
aws lambda delete-function --function-name denethor-game-qa

# Delete IAM role
aws iam detach-role-policy \
  --role-name DenethorLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam delete-role --role-name DenethorLambdaRole
```

---

## Cost Optimization

### Current Cost Estimate

With default settings (2048 MB, 300s timeout):

| Usage | Monthly Cost |
|-------|-------------|
| 10 tests | ~$0.50 |
| 100 tests | ~$3-5 |
| 1,000 tests | ~$30-50 |

**Plus API costs:** ~$0.10 per test (Browserbase + OpenAI)

### Reduce Costs

#### 1. Lower Memory (if possible)

```bash
# Test with 1024 MB
aws lambda update-function-configuration \
  --function-name denethor-game-qa \
  --memory-size 1024
```

*Note: Lower memory = slower CPU, may increase duration*

#### 2. Reduce Timeout

```bash
# Set to 2 minutes if tests finish quickly
aws lambda update-function-configuration \
  --function-name denethor-game-qa \
  --timeout 120
```

#### 3. Use Shorter Tests

In your requests:
```json
{
  "gameUrl": "https://example.com/game",
  "maxActions": 10,        // Reduce actions
  "maxDuration": 120000    // 2 minutes max
}
```

#### 4. Set Concurrency Limits

Prevent runaway costs:

```bash
aws lambda put-function-concurrency \
  --function-name denethor-game-qa \
  --reserved-concurrent-executions 5
```

#### 5. Enable AWS Budgets

Set up budget alerts:

1. Go to [AWS Budgets](https://console.aws.amazon.com/billing/home#/budgets)
2. Create budget
3. Set monthly limit (e.g., $10)
4. Add email alert when 80% reached

### Monitor Costs

```bash
# View Lambda costs (requires Cost Explorer enabled)
aws ce get-cost-and-usage \
  --time-period Start=2025-11-01,End=2025-11-30 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://filter.json

# filter.json:
{
  "Dimensions": {
    "Key": "SERVICE",
    "Values": ["AWS Lambda"]
  }
}
```

---

## Next Steps

Now that Lambda is deployed:

1. ✅ **Test different games** via Lambda
2. ✅ **Set up scheduled tests** with EventBridge
3. ✅ **Integrate with CI/CD** via API Gateway
4. ✅ **Monitor costs** with CloudWatch and Budgets
5. ✅ **Scale up** as needed (Lambda auto-scales!)

### Example: Schedule Daily Tests

```bash
# Create EventBridge rule to run daily at 2 AM UTC
aws events put-rule \
  --name daily-game-qa \
  --schedule-expression "cron(0 2 * * ? *)"

# Add Lambda as target
aws events put-targets \
  --rule daily-game-qa \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:${AWS_ACCOUNT_ID}:function:denethor-game-qa","Input"="{\"body\":\"{\\\"gameUrl\\\":\\\"https://example.com/game\\\"}\"}"

# Give EventBridge permission
aws lambda add-permission \
  --function-name denethor-game-qa \
  --statement-id eventbridge-invoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:${AWS_ACCOUNT_ID}:rule/daily-game-qa
```

---

## Summary

You've successfully:
- ✅ Created AWS Lambda function
- ✅ Configured IAM roles and permissions
- ✅ Deployed Denethor to Lambda
- ✅ Tested via CLI
- ✅ (Optional) Set up HTTP API via API Gateway
- ✅ Configured monitoring and logging

**Your Lambda function is now:**
- Running serverless (no servers to manage)
- Auto-scaling (handles 1 to 1,000+ concurrent tests)
- Cost-optimized (pay only when running)
- Production-ready (with monitoring and logging)

---

## Quick Reference

### Invoke Lambda

```bash
aws lambda invoke \
  --function-name denethor-game-qa \
  --payload '{"body":"{\"gameUrl\":\"https://example.com/game\"}"}' \
  response.json
```

### Update Code

```bash
zip -r lambda-deployment.zip . -x "*.git*" -x "qa-tests/*"
aws lambda update-function-code \
  --function-name denethor-game-qa \
  --zip-file fileb://lambda-deployment.zip
```

### Update Configuration

```bash
aws lambda update-function-configuration \
  --function-name denethor-game-qa \
  --timeout 600 \
  --memory-size 4096
```

### View Logs

```bash
awslogs get /aws/lambda/denethor-game-qa --watch
```

---

**Questions?** Check [DEPLOYMENT.md](DEPLOYMENT.md) or open an [issue](https://github.com/yourusername/Denethor/issues).

**Happy deploying!** 🚀☁️
