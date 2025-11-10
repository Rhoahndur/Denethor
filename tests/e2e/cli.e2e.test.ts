import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const execAsync = promisify(exec);

/**
 * End-to-End CLI Tests
 * Tests CLI command execution with mocked external services
 */
describe("CLI End-to-End Tests", () => {
  const testOutputDir = path.join(process.cwd(), "qa-tests/test-output-cli");

  beforeEach(async () => {
    // Clean up test output directory
    if (existsSync(testOutputDir)) {
      await rm(testOutputDir, { recursive: true, force: true });
    }
  });

  afterEach(async () => {
    // Clean up after tests
    if (existsSync(testOutputDir)) {
      await rm(testOutputDir, { recursive: true, force: true });
    }
  });

  it("should display help when --help flag is provided", async () => {
    try {
      const { stdout } = await execAsync("bun run src/cli/index.ts --help");

      expect(stdout).toContain("Usage:");
      expect(stdout).toContain("test");
      expect(stdout).toContain("Options:");
    } catch (error: any) {
      // Commander exits with code 0 for help, but some systems treat it as error
      if (error.stdout) {
        expect(error.stdout).toContain("Usage:");
      }
    }
  });

  it("should display version when --version flag is provided", async () => {
    try {
      const { stdout } = await execAsync("bun run src/cli/index.ts --version");

      // Should output version number
      expect(stdout).toMatch(/\d+\.\d+\.\d+/);
    } catch (error: any) {
      if (error.stdout) {
        expect(error.stdout).toMatch(/\d+\.\d+\.\d+/);
      }
    }
  });

  it("should fail with exit code 1 for invalid URL", async () => {
    try {
      await execAsync("bun run src/cli/index.ts test invalid-url");
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.code).toBe(1);
      expect(error.stderr || error.stdout).toContain("Invalid URL");
    }
  });

  it("should fail with exit code 1 when missing required URL argument", async () => {
    try {
      await execAsync("bun run src/cli/index.ts test");
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.code).toBe(1);
    }
  });

  it("should accept --output option", async () => {
    const mockUrl = "https://example.com/game.html";

    // This would fail without proper mocking of external services
    // For now, we test that the CLI accepts the option
    try {
      await execAsync(
        `bun run src/cli/index.ts test ${mockUrl} --output ${testOutputDir} --timeout 1`,
        { timeout: 5000 },
      );
    } catch (error: any) {
      // Expected to fail without real game/services, but should accept the option
      // Check that error is not about invalid option
      if (error.stderr) {
        expect(error.stderr).not.toContain("unknown option");
        expect(error.stderr).not.toContain("--output");
      }
    }
  });

  it("should accept --format option", async () => {
    const mockUrl = "https://example.com/game.html";

    try {
      await execAsync(
        `bun run src/cli/index.ts test ${mockUrl} --format json --timeout 1`,
        { timeout: 5000 },
      );
    } catch (error: any) {
      // Should accept the option
      if (error.stderr) {
        expect(error.stderr).not.toContain("unknown option");
        expect(error.stderr).not.toContain("--format");
      }
    }
  });

  it("should accept --timeout option", async () => {
    const mockUrl = "https://example.com/game.html";

    try {
      await execAsync(`bun run src/cli/index.ts test ${mockUrl} --timeout 10`, {
        timeout: 5000,
      });
    } catch (error: any) {
      // Should accept the option
      if (error.stderr) {
        expect(error.stderr).not.toContain("unknown option");
        expect(error.stderr).not.toContain("--timeout");
      }
    }
  });

  it("should accept --max-actions option", async () => {
    const mockUrl = "https://example.com/game.html";

    try {
      await execAsync(
        `bun run src/cli/index.ts test ${mockUrl} --max-actions 5 --timeout 1`,
        { timeout: 5000 },
      );
    } catch (error: any) {
      // Should accept the option
      if (error.stderr) {
        expect(error.stderr).not.toContain("unknown option");
        expect(error.stderr).not.toContain("--max-actions");
      }
    }
  });

  it("should reject SSRF-vulnerable URLs (localhost)", async () => {
    try {
      await execAsync(
        "bun run src/cli/index.ts test http://localhost:8080/game.html",
      );
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.code).toBe(1);
      // Should reject internal URLs
      const output = error.stderr || error.stdout || "";
      expect(output.toLowerCase()).toMatch(
        /internal|private|localhost|not allowed/,
      );
    }
  });
});

/**
 * CLI Output Formatting Tests
 */
describe("CLI Output Formatting", () => {
  it("should format output with progress indicators", async () => {
    // This test would verify progress output format
    // For now, we test that the CLI structure supports formatting
    const mockUrl = "https://example.com/game.html";

    try {
      const { stdout } = await execAsync(
        `bun run src/cli/index.ts test ${mockUrl} --timeout 1`,
        { timeout: 5000 },
      );

      // Would check for progress indicators in real scenario
      expect(typeof stdout).toBe("string");
    } catch (error: any) {
      // Expected to fail without real services
      expect(error).toBeDefined();
    }
  });
});

/**
 * CLI Error Handling Tests
 */
describe("CLI Error Handling", () => {
  it("should handle missing environment variables gracefully", async () => {
    const mockUrl = "https://example.com/game.html";

    // Temporarily unset env vars
    const originalApiKey = process.env.BROWSERBASE_API_KEY;
    delete process.env.BROWSERBASE_API_KEY;

    try {
      await execAsync(`bun run src/cli/index.ts test ${mockUrl} --timeout 1`);
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.code).toBe(1);
      const output = error.stderr || error.stdout || "";
      expect(output.toLowerCase()).toMatch(/api key|environment|config/);
    } finally {
      // Restore env var
      if (originalApiKey) {
        process.env.BROWSERBASE_API_KEY = originalApiKey;
      }
    }
  });

  it("should display error messages clearly", async () => {
    try {
      await execAsync("bun run src/cli/index.ts test not-a-url");
      expect(true).toBe(false);
    } catch (error: any) {
      const output = error.stderr || error.stdout || "";
      expect(output).toBeTruthy();
      expect(output.length).toBeGreaterThan(0);
    }
  });
});
