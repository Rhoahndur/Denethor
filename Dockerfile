# Denethor QA Agent - Docker Image
# Multi-stage build for optimized production image

# Stage 1: Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies for building
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies using npm (for better compatibility)
RUN npm install

# Copy source code
COPY . .

# Build TypeScript (if needed)
RUN npm run type-check

# Stage 2: Production image
FROM node:20-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.json ./

# Create output directory
RUN mkdir -p /app/output

# Set environment variables
ENV NODE_ENV=production
ENV OUTPUT_DIR=/app/output

# Expose port (if adding web API later)
EXPOSE 3000

# Default command - run CLI
# Override this with docker run arguments
CMD ["npx", "tsx", "src/cli/index.ts", "--help"]
