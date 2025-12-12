# Denethor Makefile
# TypeScript QA system + Python/PufferLib RL training

.PHONY: all install test lint clean
.PHONY: py-setup py-test py-lint py-format py-train py-evaluate py-docker

# ===== TypeScript Commands =====

install:
	bun install

test:
	bun test

lint:
	bun run biome check src tests

format:
	bun run biome format --write src tests

clean:
	rm -rf node_modules coverage output .playwright

# ===== Python/PufferLib Commands =====

py-setup:
	cd python && uv venv && uv pip install -e ".[dev,logging]"
	cd python && uv run playwright install chromium

py-test:
	cd python && uv run pytest -v

py-lint:
	cd python && uv run ruff check src tests

py-format:
	cd python && uv run ruff format src tests

py-train:
	cd python && uv run python -m denethor_rl.training.train $(ARGS)

py-evaluate:
	cd python && uv run python -m denethor_rl.training.evaluate $(ARGS)

py-docker:
	cd python && docker build -t denethor-rl .

py-clean:
	rm -rf python/.venv python/.ruff_cache python/__pycache__
	find python -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find python -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true

# ===== Combined Commands =====

setup: install py-setup

all-test: test py-test

all-lint: lint py-lint

all-clean: clean py-clean
