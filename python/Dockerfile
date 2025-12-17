# Use x86_64 platform for pufferlib compatibility (includes precompiled raylib/box2d for amd64)
FROM --platform=linux/amd64 python:3.11-slim

# Install system dependencies (including build tools for pufferlib native extensions)
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    build-essential \
    g++ \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

# Configure uv/pip to use CPU-only PyTorch globally (including for build dependencies)
# This prevents pufferlib from downloading 7GB CUDA torch during its build
ENV UV_EXTRA_INDEX_URL="https://download.pytorch.org/whl/cpu"
ENV PIP_EXTRA_INDEX_URL="https://download.pytorch.org/whl/cpu"

# Set working directory
WORKDIR /app

# Copy project files
COPY pyproject.toml .
COPY requirements.txt .
COPY src/ src/

# Install dependencies (use CPU-only PyTorch to save ~6GB disk space)
# Also clean uv cache after each step to avoid disk space issues
RUN uv venv && \
    uv pip install -e ".[logging]" && \
    rm -rf /root/.cache/uv

# Set up environment to use the venv directly (avoid uv run re-resolving dependencies)
ENV PATH="/app/.venv/bin:$PATH"
ENV VIRTUAL_ENV="/app/.venv"

# Install Playwright browsers
RUN playwright install chromium && \
    playwright install-deps chromium

# Default command
ENTRYPOINT ["python", "-m", "denethor_rl.training.train"]
