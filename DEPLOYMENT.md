# Denethor Deployment Guide

This guide helps you choose the best deployment strategy for your use case.

---

## 🎯 Quick Recommendation

**Choose based on your use case:**

| Use Case | Recommended Deployment | Why |
|----------|----------------------|-----|
| **Individual developer** | Local CLI | Simple, fast, no setup |
| **Team CI/CD pipeline** | GitHub Actions | Automated on every commit |
| **Production service** | AWS Lambda | Serverless, scales to zero, pay-per-use |
| **Scheduled batch testing** | Docker + Cron/ECS | Predictable, containerized |
| **On-premise/private** | Docker Compose | Full control, no cloud dependency |

---

## Deployment Options

### 1. Local CLI (Simplest)

**Best for:** Individual developers, quick testing, development

**Pros:**
- ✅ Zero setup beyond installing Bun
- ✅ Instant feedback
- ✅ Full control and debugging
- ✅ No infrastructure costs

**Cons:**
- ❌ Requires your machine to be running
- ❌ Not automated
- ❌ Can't scale to multiple tests simultaneously

**Setup:**
```bash
# Already done if you followed QUICKSTART.md!
bun run cli test https://example.com/game
```

**Cost:** Free (only API usage: ~$0.10/test)

**When to use:**
- Testing games during development
- Ad-hoc QA checks
- Learning how Denethor works
- Debugging test failures

---

### 2. GitHub Actions / CI/CD (Recommended for Teams)

**Best for:** Automated testing on code changes, continuous integration

**Pros:**
- ✅ Fully automated
- ✅ Tests run on every commit/PR
- ✅ Built-in parallelization
- ✅ Free tier: 2,000 minutes/month
- ✅ Results in GitHub UI

**Cons:**
- ❌ Requires GitHub repository
- ❌ 6-minute timeout per job (can be worked around)
- ❌ Public visibility (unless private repo)

**Setup:**

Create `.github/workflows/qa-test.yml`:

```yaml
name: Game QA Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  # Run daily at 2 AM UTC
  schedule:
    - cron: '0 2 * * *'
  # Allow manual triggers
  workflow_dispatch:
    inputs:
      game_url:
        description: 'Game URL to test'
        required: true
        default: 'https://example.com/game'

jobs:
  qa-test:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Run QA Test
        env:
          BROWSERBASE_API_KEY: ${{ secrets.BROWSERBASE_API_KEY }}
          BROWSERBASE_PROJECT_ID: ${{ secrets.BROWSERBASE_PROJECT_ID }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          bun run cli test ${{ github.event.inputs.game_url || 'https://example.com/game' }} \
            --output ./qa-results \
            --max-duration 180000 \
            --max-actions 15

      - name: Upload QA Reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: qa-reports
          path: qa-results/
          retention-days: 30

      - name: Comment PR with Results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('qa-results/test-*/reports/report.json'));

            const comment = `## 🎮 QA Test Results

            **Overall Playability:** ${report.scores.overallPlayability}/100

            | Dimension | Score |
            |-----------|-------|
            | Load Success | ${report.scores.loadSuccess}/100 |
            | Responsiveness | ${report.scores.responsiveness}/100 |
            | Stability | ${report.scores.stability}/100 |

            **Issues:** ${report.issues.length} detected
            - Critical: ${report.issues.filter(i => i.severity === 'critical').length}
            - Major: ${report.issues.filter(i => i.severity === 'major').length}
            - Minor: ${report.issues.filter(i => i.severity === 'minor').length}

            [View Full Report](Download artifacts from this run)
            `;

            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: comment
            });
```

**Add secrets to GitHub:**
1. Go to Settings > Secrets and variables > Actions
2. Add three secrets:
   - `BROWSERBASE_API_KEY`
   - `BROWSERBASE_PROJECT_ID`
   - `OPENAI_API_KEY`

**Cost:**
- GitHub Actions: Free for public repos, 2,000 min/month for private
- API costs: ~$0.10/test

**When to use:**
- Testing games on every commit
- Scheduled daily/weekly tests
- Integration with PR reviews
- Team collaboration with shared results

---

### 3. AWS Lambda (Recommended for Production)

**Best for:** Production services, on-demand testing, scaling to many games

**Pros:**
- ✅ **Serverless** - no servers to manage
- ✅ **Scales to zero** - pay only when running
- ✅ **Auto-scaling** - handles 1 or 10,000 tests
- ✅ **15-minute timeout** - longer than GitHub Actions
- ✅ **API Gateway integration** - HTTP endpoint for testing

**Cons:**
- ❌ More complex setup
- ❌ Cold start latency (~2-5s)
- ❌ AWS knowledge required
- ❌ Debugging is harder

**Setup:**

#### Step 1: Package the Lambda

```bash
# Install dependencies
bun install --production

# Create deployment package
zip -r lambda-deployment.zip . \
  -x "*.git*" \
  -x "*.env*" \
  -x "qa-tests/*" \
  -x "my-results/*" \
  -x "node_modules/.cache/*"
```

#### Step 2: Create IAM Role

```bash
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

aws iam attach-role-policy \
  --role-name DenethorLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

#### Step 3: Create Lambda Function

```bash
aws lambda create-function \
  --function-name denethor-game-qa \
  --runtime nodejs20.x \
  --handler src/lambda/handler.handler \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/DenethorLambdaRole \
  --zip-file fileb://lambda-deployment.zip \
  --timeout 300 \
  --memory-size 2048 \
  --environment Variables="{
    BROWSERBASE_API_KEY=your_key,
    BROWSERBASE_PROJECT_ID=your_project,
    OPENAI_API_KEY=your_key
  }"
```

#### Step 4: Create API Gateway (Optional)

```bash
# Create REST API
aws apigateway create-rest-api \
  --name "Denethor QA API" \
  --description "Browser game QA testing API"

# Get the API ID from output, then create resource and method
# See AWS documentation for full API Gateway setup
```

#### Step 5: Invoke Lambda

```bash
# CLI invocation
aws lambda invoke \
  --function-name denethor-game-qa \
  --payload '{
    "body": "{\"gameUrl\":\"https://example.com/game\",\"maxActions\":15}"
  }' \
  response.json

# Via HTTP (if API Gateway configured)
curl -X POST https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/test \
  -H "Content-Type: application/json" \
  -d '{"gameUrl":"https://example.com/game","maxActions":15}'
```

**Cost Estimate:**
- Lambda: $0.0000166667 per GB-second
- API Gateway: $3.50 per million requests
- **Example:** 100 tests/day @ 2min each = ~$1-2/month + API costs (~$0.10/test)

**When to use:**
- Building a QA service
- Need HTTP API for testing
- Sporadic test runs (benefits from scale-to-zero)
- Integration with other AWS services

---

### 4. Docker + ECS/Fargate (Best for Scheduled/Batch)

**Best for:** Scheduled batch testing, predictable workloads, corporate environments

**Pros:**
- ✅ **Consistent environment** everywhere
- ✅ **ECS scheduling** for daily/weekly tests
- ✅ **Resource control** (CPU/memory limits)
- ✅ **Logging** via CloudWatch
- ✅ **No cold starts** (always warm)

**Cons:**
- ❌ More infrastructure to manage
- ❌ Costs even when idle (unless using Fargate Spot)
- ❌ Slower iteration vs local dev

**Setup:**

#### Step 1: Create Dockerfile (Already exists!)

```dockerfile
# See DOCKER.md for details
FROM oven/bun:1-slim

WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .

CMD ["bun", "run", "cli", "test"]
```

#### Step 2: Build and Push to ECR

```bash
# Build image
docker build -t denethor:latest .

# Create ECR repository
aws ecr create-repository --repository-name denethor

# Get ECR login
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag denethor:latest \
  YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/denethor:latest

docker push \
  YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/denethor:latest
```

#### Step 3: Create ECS Task Definition

```json
{
  "family": "denethor-qa",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [{
    "name": "denethor",
    "image": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/denethor:latest",
    "environment": [
      {"name": "BROWSERBASE_API_KEY", "value": "your_key"},
      {"name": "BROWSERBASE_PROJECT_ID", "value": "your_project"},
      {"name": "OPENAI_API_KEY", "value": "your_key"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/denethor",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }]
}
```

#### Step 4: Schedule with EventBridge

```bash
# Create rule to run daily at 2 AM
aws events put-rule \
  --name "daily-game-qa" \
  --schedule-expression "cron(0 2 * * ? *)"

# Add ECS task as target
aws events put-targets \
  --rule daily-game-qa \
  --targets "Id"="1","Arn"="arn:aws:ecs:us-east-1:ACCOUNT:cluster/default","RoleArn"="arn:aws:iam::ACCOUNT:role/ecsEventsRole","EcsParameters"={"TaskDefinitionArn"="arn:aws:ecs:us-east-1:ACCOUNT:task-definition/denethor-qa","LaunchType"="FARGATE"}
```

**Cost Estimate:**
- Fargate: $0.04048 per vCPU-hour, $0.004445 per GB-hour
- **Example:** 1 test/day @ 5min = ~$3-5/month + API costs

**When to use:**
- Daily/weekly scheduled testing
- Need persistent storage (EFS mount)
- Batch testing multiple games
- Corporate environments (on-premise Docker)

---

### 5. Docker Compose (Local/On-Premise)

**Best for:** Development, on-premise deployment, full control

**Pros:**
- ✅ Full local control
- ✅ No cloud dependencies
- ✅ Easy debugging
- ✅ Persistent storage

**Cons:**
- ❌ Your machine must be always on
- ❌ Manual scaling
- ❌ No built-in scheduling

**Setup:**

```yaml
# docker-compose.yml (already exists!)
version: '3.8'

services:
  denethor:
    build: .
    environment:
      - BROWSERBASE_API_KEY=${BROWSERBASE_API_KEY}
      - BROWSERBASE_PROJECT_ID=${BROWSERBASE_PROJECT_ID}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./qa-tests:/app/qa-tests
    command: bun run cli test https://example.com/game
```

**Run:**
```bash
docker-compose up
```

**Cost:** Free (only API costs)

**When to use:**
- Local development
- On-premise deployment
- Air-gapped environments
- Learning Docker

---

## Cost Comparison

| Deployment | Infrastructure Cost/Month | API Cost/Test | Best For |
|------------|--------------------------|---------------|----------|
| **Local CLI** | $0 | ~$0.10 | Individual dev |
| **GitHub Actions** | $0 (free tier) | ~$0.10 | Team CI/CD |
| **AWS Lambda** | ~$1-5 | ~$0.10 | Production service |
| **ECS/Fargate** | ~$10-30 | ~$0.10 | Batch/scheduled |
| **Docker Compose** | $0 (your machine) | ~$0.10 | On-premise |

**Note:** API costs (Browserbase + OpenAI) are ~$0.10 per test regardless of deployment method.

---

## Scaling Comparison

| Deployment | Concurrent Tests | Setup Time | Maintenance |
|------------|------------------|------------|-------------|
| **Local CLI** | 1 | 5 minutes | None |
| **GitHub Actions** | 20 (free tier) | 30 minutes | Low |
| **AWS Lambda** | 1,000+ (auto) | 2 hours | Low |
| **ECS/Fargate** | Custom (manual) | 3 hours | Medium |
| **Docker Compose** | 1 (unless clustered) | 10 minutes | Medium |

---

## Recommended Deployment Progression

### Phase 1: Development (Week 1)
- Start with **Local CLI**
- Learn how Denethor works
- Test a few games manually

### Phase 2: Team Integration (Week 2-3)
- Add **GitHub Actions** workflow
- Automate testing on commits
- Share results with team

### Phase 3: Production (Month 2+)
- Deploy to **AWS Lambda** or **ECS**
- Set up monitoring (CloudWatch)
- Create HTTP API for external access
- Implement batch testing for multiple games

---

## Security Best Practices

### All Deployments:
1. **Never commit .env files**
2. **Use secrets management**:
   - GitHub: Repository Secrets
   - AWS: Secrets Manager or SSM Parameter Store
   - Docker: Environment variables or Docker Secrets

### Example: AWS Secrets Manager

```bash
# Store secret
aws secretsmanager create-secret \
  --name denethor/api-keys \
  --secret-string '{
    "BROWSERBASE_API_KEY":"your_key",
    "BROWSERBASE_PROJECT_ID":"your_project",
    "OPENAI_API_KEY":"your_key"
  }'

# Lambda can read from Secrets Manager
# Add permission to Lambda role, then read in code
```

---

## Monitoring & Logging

### CloudWatch (AWS)
```bash
# View logs
aws logs tail /aws/lambda/denethor-game-qa --follow

# Create metric filter for errors
aws logs put-metric-filter \
  --log-group-name /aws/lambda/denethor-game-qa \
  --filter-name Errors \
  --filter-pattern "ERROR" \
  --metric-transformations \
    metricName=ErrorCount,metricNamespace=Denethor,metricValue=1
```

### GitHub Actions
- Logs automatically available in Actions UI
- Download artifacts for reports

### Local
- Set `LOG_LEVEL=debug` in .env
- Check `qa-tests/*/logs/errors.log`

---

## Troubleshooting

### Lambda timeout?
- Increase timeout: `--timeout 600` (max 15 minutes)
- Or reduce test duration: `--max-duration 120000`

### Out of memory?
- Increase Lambda memory: `--memory-size 4096`
- Or reduce concurrent actions

### GitHub Actions timeout?
- Tests must complete in 6 minutes (hard limit)
- Use `--max-duration 300000` (5 minutes)
- Or split into multiple jobs

### Docker build fails?
- Check Bun version: `bun --version`
- Try: `docker build --no-cache`

---

## Next Steps

1. **Choose your deployment** from the table above
2. **Follow the setup steps** for your chosen method
3. **Test with a simple game** first
4. **Set up monitoring** and alerts
5. **Scale gradually** as needed

## Further Reading

- [QUICKSTART.md](QUICKSTART.md) - Initial setup
- [DOCKER.md](DOCKER.md) - Docker details
- [README.md](README.md) - Full documentation
- [AWS Lambda Guide](docs/deployment/aws-lambda.md) - Lambda deep-dive

---

**Questions?** Open an [issue](https://github.com/yourusername/Denethor/issues) or check the [FAQ](README.md#faq).
