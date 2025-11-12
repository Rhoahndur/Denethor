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

### Method 1: Docker + ECR (Recommended)

**Why Docker?**
- Handles TypeScript bundling automatically with esbuild
- No ZIP size limits (supports up to 10GB vs 250MB for ZIP)
- Consistent builds across environments
- Easier dependency management
- Better suited for production

This is the recommended approach for all deployments.

#### Prerequisites

- **Docker** installed - [Install Docker](https://docs.docker.com/get-docker/)
- **AWS CLI** configured
- **Your API Keys** (Browserbase + OpenAI)

#### Step 1: Configure API Keys Locally

First, set up your environment variables that will be used for Lambda:

```bash
# Create lambda-env.json with YOUR API keys
cat > lambda-env.json << 'EOF'
{
  "Variables": {
    "BROWSERBASE_API_KEY": "your_browserbase_api_key_here",
    "BROWSERBASE_PROJECT_ID": "your_browserbase_project_id_here",
    "OPENAI_API_KEY": "your_openai_api_key_here"
  }
}
EOF
```

**Important:** Replace the placeholder values with your actual API keys from:
- **Browserbase**: Sign up at [https://www.browserbase.com/](https://www.browserbase.com/) and get your API key + Project ID
- **OpenAI**: Get your API key from [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)

**Security Note:** The `lambda-env.json` file is in `.gitignore` and will NOT be committed to your repository. Each developer needs their own API keys.

#### Step 2: Create IAM Role

```bash
# Create IAM role for Lambda execution
aws iam create-role \
  --role-name DenethorLambdaRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach basic execution policy (for CloudWatch Logs)
aws iam attach-role-policy \
  --role-name DenethorLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

#### Step 3: Create ECR Repository

```bash
# Create ECR repository to store Docker images
aws ecr create-repository \
  --repository-name denethor-lambda \
  --region us-east-1
```

#### Step 4: Build Docker Image

The included `Dockerfile.lambda` handles everything automatically:
- Installs dependencies (including dotenv required by Stagehand)
- Bundles TypeScript into JavaScript using esbuild
- Sets up the correct Lambda runtime

```bash
# Build for Lambda (linux/amd64 architecture)
docker build \
  --platform linux/amd64 \
  --provenance=false \
  --sbom=false \
  -f Dockerfile.lambda \
  -t denethor-lambda:latest \
  .
```

**Note:** The `--provenance=false --sbom=false` flags are required because Lambda doesn't support multi-platform manifests.

#### Step 5: Push Image to ECR

```bash
# Get your AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Authenticate Docker with ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com

# Tag image for ECR
docker tag denethor-lambda:latest \
  ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/denethor-lambda:latest

# Push to ECR
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/denethor-lambda:latest
```

#### Step 6: Create Lambda Function

```bash
# Get your AWS account ID and IAM role ARN
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/DenethorLambdaRole"
IMAGE_URI="${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/denethor-lambda:latest"

# Create Lambda function
aws lambda create-function \
  --function-name denethor-game-qa \
  --package-type Image \
  --code ImageUri=${IMAGE_URI} \
  --role ${ROLE_ARN} \
  --timeout 300 \
  --memory-size 2048 \
  --environment file://lambda-env.json
```

#### Step 7: Test Your Deployment

```bash
# Create test event
cat > test-event.json << 'EOF'
{
  "body": "{\"gameUrl\":\"https://meiri.itch.io/doce-fim\",\"maxActions\":5}"
}
EOF

# Invoke Lambda function
aws lambda invoke \
  --function-name denethor-game-qa \
  --cli-binary-format raw-in-base64-out \
  --payload file://test-event.json \
  response.json

# View results
cat response.json | jq '.'
```

#### Updating Your Deployment

When you make code changes:

```bash
# Rebuild Docker image
docker build --platform linux/amd64 --provenance=false --sbom=false \
  -f Dockerfile.lambda -t denethor-lambda:latest .

# Tag with new version (optional but recommended)
docker tag denethor-lambda:latest \
  ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/denethor-lambda:v2

# Push to ECR
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/denethor-lambda:v2

# Update Lambda function
aws lambda update-function-code \
  --function-name denethor-game-qa \
  --image-uri ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/denethor-lambda:v2
```

#### Updating Environment Variables

If you need to update API keys:

```bash
# Update lambda-env.json with new keys
# Then update Lambda configuration
aws lambda update-function-configuration \
  --function-name denethor-game-qa \
  --environment file://lambda-env.json
```

---

### Method 2: AWS Console with ZIP (Alternative)

This method works for smaller projects but has limitations (250MB unzipped limit).

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
