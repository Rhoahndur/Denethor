# Docker Setup Guide

This guide shows you how to run Denethor using Docker for easy setup and consistent environments.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 20.10+
- [Docker Compose](https://docs.docker.com/compose/install/) 2.0+ (included with Docker Desktop)
- Your `.env` file with API keys (see [main README](README.md))

## Quick Start

### 1. Build the Image

```bash
# Build the Docker image
docker-compose build

# Or build directly
docker build -t denethor-qa .
```

### 2. Run a Test

```bash
# Quick test (recommended for first run)
docker-compose run denethor npx tsx -r dotenv/config quick-test.ts https://meiri.itch.io/doce-fim

# Full test
docker-compose run denethor npx tsx -r dotenv/config src/cli/index.ts test https://example.com/game.html

# With custom options
docker-compose run denethor npx tsx -r dotenv/config src/cli/index.ts test https://example.com/game.html \
  --timeout 120000 \
  --max-actions 10 \
  --output /app/output/my-test
```

### 3. View Results

Results are automatically saved to your local `./output` directory:

```bash
# View reports (from your host machine)
ls -la output/

# Open HTML report
open output/test-*/reports/report.html
```

## Usage Examples

### Run Demo (Offline, No API Calls)

```bash
docker-compose --profile demo up demo
```

### Run Quick Test

```bash
# Set game URL and run
GAME_URL=https://meiri.itch.io/doce-fim docker-compose --profile quick up quick-test
```

### Interactive Shell

```bash
# Start container with shell access
docker-compose run denethor bash

# Inside container, run commands:
npx tsx src/cli/index.ts test https://example.com/game.html
bun run demo
bun test
exit
```

### Run Multiple Tests in Sequence

```bash
# Test multiple games
for game in \
  "https://meiri.itch.io/doce-fim" \
  "https://js13kgames.com/games/xx142-b2exe/index.html"
do
  echo "Testing: $game"
  docker-compose run --rm denethor \
    npx tsx -r dotenv/config src/cli/index.ts test "$game" \
    --timeout 120000 \
    --max-actions 10
done
```

## Development Workflow

### Build and Test Locally

```bash
# Rebuild after code changes
docker-compose build --no-cache

# Run tests
docker-compose run denethor bun test

# Run type checking
docker-compose run denethor npm run type-check

# Run linting
docker-compose run denethor bun run lint
```

### Mount Source Code for Live Development

For live code changes without rebuilding:

```bash
# Add this to docker-compose.yml under denethor service:
volumes:
  - ./src:/app/src  # Live source code
  - ./output:/app/output

# Then run
docker-compose up denethor
```

## Environment Variables

Pass environment variables via `.env` file (recommended) or command line:

```bash
# Via .env file (automatically loaded)
cp .env.example .env
# Edit .env with your API keys

# Or via command line
docker-compose run \
  -e BROWSERBASE_API_KEY=your_key \
  -e OPENAI_API_KEY=your_key \
  denethor npx tsx src/cli/index.ts test https://example.com/game
```

## Production Deployment

### Build Production Image

```bash
# Build optimized production image
docker build -t denethor-qa:1.0.0 .

# Tag for registry
docker tag denethor-qa:1.0.0 yourusername/denethor-qa:1.0.0

# Push to Docker Hub
docker push yourusername/denethor-qa:1.0.0
```

### Run in Production

```bash
# Pull image
docker pull yourusername/denethor-qa:1.0.0

# Run with production settings
docker run --rm \
  -e BROWSERBASE_API_KEY=$BROWSERBASE_API_KEY \
  -e BROWSERBASE_PROJECT_ID=$BROWSERBASE_PROJECT_ID \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -v $(pwd)/output:/app/output \
  yourusername/denethor-qa:1.0.0 \
  npx tsx src/cli/index.ts test https://example.com/game.html
```

### Deploy to AWS ECS/Fargate

```bash
# Tag for ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker tag denethor-qa:1.0.0 <account-id>.dkr.ecr.us-east-1.amazonaws.com/denethor-qa:1.0.0
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/denethor-qa:1.0.0

# Create ECS task definition using this image
# See AWS ECS documentation for details
```

## Cleanup

```bash
# Stop all containers
docker-compose down

# Remove containers and volumes
docker-compose down -v

# Remove image
docker rmi denethor-qa:latest

# Clean up dangling images
docker image prune -f
```

## Troubleshooting

### Issue: "Cannot find module"

**Solution:** Rebuild the image
```bash
docker-compose build --no-cache
```

### Issue: "Permission denied" on output files

**Solution:** Fix volume permissions
```bash
# Change ownership of output directory
sudo chown -R $USER:$USER output/

# Or run container with your user ID
docker-compose run --user $(id -u):$(id -g) denethor ...
```

### Issue: Out of memory

**Solution:** Increase Docker memory limit
```bash
# Update docker-compose.yml
deploy:
  resources:
    limits:
      memory: 4G  # Increase from 2G
```

### Issue: Slow builds

**Solution:** Use BuildKit
```bash
# Enable BuildKit for faster builds
DOCKER_BUILDKIT=1 docker-compose build
```

### View Logs

```bash
# View container logs
docker-compose logs denethor

# Follow logs in real-time
docker-compose logs -f denethor

# View logs from specific run
docker logs <container-id>
```

## Advanced Usage

### Custom Dockerfile for Lambda

Create `Dockerfile.lambda` for AWS Lambda deployment:

```dockerfile
FROM public.ecr.aws/lambda/nodejs:20

# Copy package files
COPY package.json ./
RUN npm install --omit=dev

# Copy source code
COPY src ./src

# Set Lambda handler
CMD [ "src/lambda/handler.handler" ]
```

Build and deploy:
```bash
docker build -f Dockerfile.lambda -t denethor-lambda .
# Push to ECR and deploy to Lambda (see AWS Lambda docs)
```

### Run with Different Node Versions

```bash
# Use Node.js 18
docker build --build-arg NODE_VERSION=18 -t denethor-qa:node18 .

# Use Node.js 21
docker build --build-arg NODE_VERSION=21 -t denethor-qa:node21 .
```

## Best Practices

1. **Always use .env file** - Never hardcode API keys
2. **Mount output directory** - Access reports on host machine
3. **Use --rm flag** - Auto-remove containers after run
4. **Tag images with versions** - Track deployments easily
5. **Clean up regularly** - Remove unused images and containers
6. **Use multi-stage builds** - Smaller production images
7. **Set resource limits** - Prevent container from consuming all resources

## Reference

- [Dockerfile Reference](https://docs.docker.com/engine/reference/builder/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Main README](README.md)
- [AWS Lambda Deployment](docs/deployment/aws-lambda.md)
