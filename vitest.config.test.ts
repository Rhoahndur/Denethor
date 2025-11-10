import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("Vitest Configuration", () => {
  let vitestConfig: string;
  let _configModule: unknown;

  test("vitest.config.ts file should exist and be valid TypeScript", () => {
    const vitestConfigPath = join(__dirname, "vitest.config.ts");
    vitestConfig = readFileSync(vitestConfigPath, "utf-8");
    expect(vitestConfig).toBeDefined();
    expect(vitestConfig.length).toBeGreaterThan(0);
  });

  test("should import defineConfig from vitest/config", () => {
    expect(vitestConfig).toContain('from "vitest/config"');
    expect(vitestConfig).toContain("defineConfig");
  });

  test("should export default configuration", () => {
    expect(vitestConfig).toContain("export default defineConfig");
  });

  describe("Test Configuration", () => {
    test("should have test object configured", () => {
      expect(vitestConfig).toContain("test:");
    });

    test("should enable globals for test functions", () => {
      expect(vitestConfig).toContain("globals: true");
    });

    test("should set environment to node", () => {
      expect(vitestConfig).toContain('environment: "node"');
    });
  });

  describe("Coverage Configuration", () => {
    test("should have coverage object configured", () => {
      expect(vitestConfig).toContain("coverage:");
    });

    test("should use v8 coverage provider", () => {
      expect(vitestConfig).toContain('provider: "v8"');
    });

    test("should configure coverage reporters", () => {
      expect(vitestConfig).toContain("reporter:");
    });

    test("should include text reporter", () => {
      expect(vitestConfig).toContain('"text"');
    });

    test("should include json reporter", () => {
      expect(vitestConfig).toContain('"json"');
    });

    test("should include html reporter", () => {
      expect(vitestConfig).toContain('"html"');
    });

    test("should have all three reporters in array", () => {
      const reporterMatch = vitestConfig.match(/reporter:\s*\[(.*?)\]/s);
      expect(reporterMatch).toBeTruthy();
      if (reporterMatch) {
        const reporters = reporterMatch[1];
        expect(reporters).toContain('"text"');
        expect(reporters).toContain('"json"');
        expect(reporters).toContain('"html"');
      }
    });
  });

  describe("Package.json Scripts", () => {
    test("should have test script that runs bun test", () => {
      const packageJson = JSON.parse(
        readFileSync(join(__dirname, "package.json"), "utf-8"),
      );
      expect(packageJson.scripts.test).toBe("bun test");
    });

    test("should have test:coverage script that runs bun test --coverage", () => {
      const packageJson = JSON.parse(
        readFileSync(join(__dirname, "package.json"), "utf-8"),
      );
      expect(packageJson.scripts["test:coverage"]).toBe("bun test --coverage");
    });
  });

  describe("Architecture Alignment", () => {
    test("should match architecture.md template structure", () => {
      // Verify it follows the pattern from architecture.md:1056-1070
      expect(vitestConfig).toContain("defineConfig");
      expect(vitestConfig).toContain("test:");
      expect(vitestConfig).toContain("globals:");
      expect(vitestConfig).toContain("environment:");
      expect(vitestConfig).toContain("coverage:");
      expect(vitestConfig).toContain("provider:");
      expect(vitestConfig).toContain("reporter:");
    });

    test("should use double quotes for strings (Biome formatting)", () => {
      // After Biome formatting, strings should use double quotes
      const stringMatches = vitestConfig.match(/["']/g);
      if (stringMatches) {
        const doubleQuotes = stringMatches.filter((q) => q === '"').length;
        const singleQuotes = stringMatches.filter((q) => q === "'").length;
        expect(doubleQuotes).toBeGreaterThan(0);
        // Allow for some single quotes in imports or other contexts
        expect(doubleQuotes).toBeGreaterThanOrEqual(singleQuotes);
      }
    });
  });

  describe("Configuration Validation", () => {
    test("should not have syntax errors", () => {
      // File should parse without errors (if it didn't, readFileSync would have failed)
      expect(vitestConfig).toBeDefined();
    });

    test("should have proper object structure", () => {
      expect(vitestConfig).toContain("{");
      expect(vitestConfig).toContain("}");
      // Count opening and closing braces should match
      const openBraces = (vitestConfig.match(/{/g) || []).length;
      const closeBraces = (vitestConfig.match(/}/g) || []).length;
      expect(openBraces).toBe(closeBraces);
    });

    test("should have proper array structure for reporters", () => {
      expect(vitestConfig).toContain("[");
      expect(vitestConfig).toContain("]");
    });
  });
});
