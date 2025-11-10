# AWS Lambda Deployment Guide

This guide walks you through deploying Denethor as an AWS Lambda function for serverless execution.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Configuration Overview](#configuration-overview)
- [Deployment Methods](#deployment-methods)
  - [Method 1: AWS Console (Recommended for First-Time)](#method-1-aws-console-recommended-for-first-time)
  - [Method 2: AWS CLI](#method-2-aws-cli)
  - [Method 3: Infrastructure as Code (Terraform)](#method-3-infrastructure-as-code-terraform)
- [Testing Your Deployment](#testing-your-deployment)
- [Cost Estimates](#cost-estimates)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying to AWS Lambda, ensure you have:

1. **AWS Account** - [Sign up here](https://aws.amazon.com/)
2. **AWS CLI** installed and configured - [Installation guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
3. **API Keys** - Browserbase and OpenAI API keys (see [Browserbase setup](./browserbase.md))
4. **Node.js 20+** or **Bun** installed locally for building
5. **IAM Permissions** - Ability to create Lambda functions, IAM roles, and CloudWatch Logs

---

## Configuration Overview

### Lambda Settings

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Runtime** | Node.js 20.x | Latest LTS, Bun-compatible |
| **Memory** | 2048 MB | Browser automation requires more memory |
| **Timeout** | 300 seconds (5 minutes) | Maximum Lambda timeout, matches test duration |
| **Ephemeral Storage** | 512 MB (default) | Sufficient for screenshots and reports |
| **Architecture** | x86_64 | Broadest compatibility |

### Environment Variables

Required environment variables that must be set in Lambda configuration:

```bash
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_browserbase_project_id
OPENAI_API_KEY=your_openai_api_key
LOG_LEVEL=info  # Optional: debug, info, warn, error
```

---

## Deployment Methods

### Method 1: AWS Console (Recommended for First-Time)

This method is best for learning and testing.

#### Step 1: Build the Lambda Package

```bash
# Navigate to project root
cd Denethor

# Install dependencies (production only)
bun install --production

# Create deployment package
zip -r lambda-deployment.zip . \
  -x "*.git*" \
  -x "*.test.ts" \
  -x "coverage/*" \
  -x "output/*" \
  -x "node_modules/@types/*" \
  -x ".env"

# Verify package size (should be < 50MB)
du -h lambda-deployment.zip
```

#### Step 2: Create IAM Role

1. Go to [IAM Console](https://console.aws.amazon.com/iam/)
2. Click **Roles** → **Create role**
3. Select **AWS service** → **Lambda**
4. Attach policies:
   - `AWSLambdaBasicExecutionRole` (for CloudWatch Logs)
5. Name the role: `Denethor-Lambda-Role`
6. Click **Create role**

#### Step 3: Create Lambda Function

1. Go to [Lambda Console](https://console.aws.amazon.com/lambda/)
2. Click **Create function**
3. Choose **Author from scratch**
4. Configure:
   - **Function name**: `browsergame-qa`
   - **Runtime**: Node.js 20.x
   - **Architecture**: x86_64
   - **Execution role**: Use existing role → `Denethor-Lambda-Role`
5. Click **Create function**

#### Step 4: Upload Code

1. In the Lambda function page, scroll to **Code source**
2. Click **Upload from** → **.zip file**
3. Upload `lambda-deployment.zip`
4. Click **Save**

#### Step 5: Configure Function

1. Go to **Configuration** → **General configuration**
2. Click **Edit**
3. Set:
   - **Memory**: 2048 MB
   - **Timeout**: 5 min 0 sec
4. Click **Save**

#### Step 6: Set Environment Variables

1. Go to **Configuration** → **Environment variables**
2. Click **Edit** → **Add environment variable**
3. Add each variable:
   - `BROWSERBASE_API_KEY` = your_key
   - `BROWSERBASE_PROJECT_ID` = your_project_id
   - `OPENAI_API_KEY` = your_openai_key
   - `LOG_LEVEL` = info
4. Click **Save**

#### Step 7: Configure Handler

1. Go to **Code** tab
2. Scroll to **Runtime settings** → **Edit**
3. Set **Handler**: `src/lambda/handler.handler`
4. Click **Save**

---

### Method 2: AWS CLI

This method is faster for repeated deployments.

#### Step 1: Build and Package

```bash
# Build deployment package
bun install --production
zip -r lambda-deployment.zip . \
  -x "*.git*" \
  -x "*.test.ts" \
  -x "coverage/*" \
  -x "output/*" \
  -x "node_modules/@types/*" \
  -x ".env"
```

#### Step 2: Create IAM Role

```bash
# Create trust policy document
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create the role
aws iam create-role \
  --role-name Denethor-Lambda-Role \
  --assume-role-policy-document file://trust-policy.json

# Attach basic execution policy
aws iam attach-role-policy \
  --role-name Denethor-Lambda-Role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Get the role ARN (you'll need this)
aws iam get-role --role-name Denethor-Lambda-Role --query 'Role.Arn' --output text
```

#### Step 3: Create Lambda Function

Replace `<ROLE_ARN>` with the ARN from Step 2:

```bash
aws lambda create-function \
  --function-name browsergame-qa \
  --runtime nodejs20.x \
  --role <ROLE_ARN> \
  --handler src/lambda/handler.handler \
  --zip-file fileb://lambda-deployment.zip \
  --timeout 300 \
  --memory-size 2048 \
  --environment Variables='{
    BROWSERBASE_API_KEY=your_browserbase_api_key,
    BROWSERBASE_PROJECT_ID=your_browserbase_project_id,
    OPENAI_API_KEY=your_openai_api_key,
    LOG_LEVEL=info
  }'
```

#### Step 4: Update Function Code (for redeployments)

```bash
# After making code changes
zip -r lambda-deployment.zip . \
  -x "*.git*" -x "*.test.ts" -x "coverage/*" -x "output/*" -x ".env"

aws lambda update-function-code \
  --function-name browsergame-qa \
  --zip-file fileb://lambda-deployment.zip
```

---

### Method 3: Infrastructure as Code (Terraform)

For production deployments, use Terraform to manage infrastructure.

#### Terraform Configuration

Create `terraform/lambda.tf`:

```hcl
# terraform/lambda.tf

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "browserbase_api_key" {
  description = "Browserbase API key"
  type        = string
  sensitive   = true
}

variable "browserbase_project_id" {
  description = "Browserbase project ID"
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "browsergame-qa-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Attach CloudWatch Logs policy
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda Function
resource "aws_lambda_function" "browsergame_qa" {
  filename         = "../lambda-deployment.zip"
  function_name    = "browsergame-qa"
  role            = aws_iam_role.lambda_role.arn
  handler         = "src/lambda/handler.handler"
  source_code_hash = filebase64sha256("../lambda-deployment.zip")
  runtime         = "nodejs20.x"
  timeout         = 300
  memory_size     = 2048

  environment {
    variables = {
      BROWSERBASE_API_KEY    = var.browserbase_api_key
      BROWSERBASE_PROJECT_ID = var.browserbase_project_id
      OPENAI_API_KEY         = var.openai_api_key
      LOG_LEVEL              = "info"
    }
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.browsergame_qa.function_name}"
  retention_in_days = 7
}

# Outputs
output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.browsergame_qa.arn
}

output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.browsergame_qa.function_name
}
```

#### Deploy with Terraform

```bash
# Navigate to terraform directory
cd terraform

# Initialize Terraform
terraform init

# Create terraform.tfvars (don't commit this!)
cat > terraform.tfvars << 'EOF'
aws_region             = "us-east-1"
browserbase_api_key    = "your_browserbase_api_key"
browserbase_project_id = "your_browserbase_project_id"
openai_api_key         = "your_openai_api_key"
EOF

# Plan deployment
terraform plan

# Apply deployment
terraform apply

# Get outputs
terraform output
```

---

## Testing Your Deployment

### Test with AWS Console

1. Go to Lambda function page
2. Click **Test** tab
3. Create new test event:

```json
{
  "body": "{\"gameUrl\":\"https://example.com/game.html\",\"maxActions\":15}"
}
```

4. Click **Test**
5. Check results in **Execution results**

### Test with AWS CLI

```bash
# Create test event file
cat > test-event.json << 'EOF'
{
  "body": "{\"gameUrl\":\"https://example.com/game.html\",\"maxActions\":15}"
}
EOF

# Invoke Lambda function
aws lambda invoke \
  --function-name browsergame-qa \
  --payload file://test-event.json \
  response.json

# View response
cat response.json | jq '.'
```

### Test with API Gateway (Optional)

To expose Lambda via HTTP endpoint:

1. Go to [API Gateway Console](https://console.aws.amazon.com/apigateway/)
2. Create **REST API**
3. Create resource `/test`
4. Create **POST** method
5. Set **Integration type**: Lambda Function
6. Select `browsergame-qa` function
7. Deploy API to stage (e.g., `prod`)
8. Test with curl:

```bash
curl -X POST \
  https://your-api-id.execute-api.region.amazonaws.com/prod/test \
  -H 'Content-Type: application/json' \
  -d '{"gameUrl":"https://example.com/game.html"}'
```

---

## Cost Estimates

### Per Test Execution

| Service | Cost Component | Estimate |
|---------|---------------|----------|
| **Lambda** | Compute time (2048 MB, 5 min) | $0.0017 |
| **Lambda** | Requests (1 invocation) | $0.0000002 |
| **Browserbase** | Browser session (5 min) | $0.05 - $0.10 |
| **OpenAI** | GPT-4o-mini tokens (~2000) | $0.001 - $0.003 |
| **CloudWatch** | Logs (5 MB) | $0.00025 |
| **Total per test** | | **$0.05 - $0.12** |

### Monthly Estimates

| Tests per Month | Total Cost |
|-----------------|------------|
| 100 tests | $5 - $12 |
| 1,000 tests | $50 - $120 |
| 10,000 tests | $500 - $1,200 |

**Note:** Costs can be optimized by:
- Reducing `maxActions` parameter
- Adjusting `sessionTimeout` for faster tests
- Using Lambda reserved concurrency for predictable pricing
- Implementing result caching for repeated tests

---

## Troubleshooting

### Issue: "Task timed out after 300.00 seconds"

**Cause:** Test exceeded Lambda's 5-minute timeout

**Solutions:**
- Reduce `maxActions` in event body (default: 20 → try 10-15)
- Reduce `sessionTimeout` (default: 280000ms → try 240000ms)
- Optimize game loading (some games take longer to load)

### Issue: "Cannot find module 'src/lambda/handler'"

**Cause:** Handler path is incorrect or deployment package is malformed

**Solutions:**
- Verify handler setting: `src/lambda/handler.handler`
- Rebuild deployment package from project root
- Ensure all source files are included in zip

### Issue: "Process exited before completing request"

**Cause:** Out of memory or unhandled promise rejection

**Solutions:**
- Increase memory to 3008 MB (may help with complex games)
- Check CloudWatch Logs for error details
- Ensure environment variables are set correctly

### Issue: "BROWSERBASE_API_KEY is required"

**Cause:** Environment variables not configured

**Solutions:**
- Go to Lambda → Configuration → Environment variables
- Add all required variables (see [Configuration Overview](#configuration-overview))
- Click Save and redeploy

### Issue: High costs

**Cause:** Long test durations or many tests

**Solutions:**
- Monitor CloudWatch metrics for execution duration
- Reduce `maxActions` to minimum needed for evaluation
- Implement caching layer (e.g., DynamoDB) for repeated tests
- Set up CloudWatch alarms for cost thresholds

### Viewing Logs

```bash
# Get latest log stream
aws logs describe-log-streams \
  --log-group-name /aws/lambda/browsergame-qa \
  --order-by LastEventTime \
  --descending \
  --max-items 1 \
  --query 'logStreams[0].logStreamName' \
  --output text

# Tail logs in real-time (replace LOG_STREAM_NAME)
aws logs tail /aws/lambda/browsergame-qa \
  --follow \
  --filter-pattern "ERROR"
```

---

## Next Steps

- [Browserbase Setup Guide](./browserbase.md) - Configure Browserbase account
- [API Documentation](../api/README.md) - Learn about programmatic usage
- [User Guide](../user-guide/getting-started.md) - Understand test results

---

## Additional Resources

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Browserbase Lambda Guide](https://docs.browserbase.com/guides/lambda)
- [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits)
