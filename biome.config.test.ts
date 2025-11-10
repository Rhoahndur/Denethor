import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("Biome Configuration", () => {
  let biomeConfig: Record<string, unknown>;

  test("biome.json file should exist and be valid JSON", () => {
    const biomeJsonPath = join(__dirname, "biome.json");
    const fileContent = readFileSync(biomeJsonPath, "utf-8");
    biomeConfig = JSON.parse(fileContent);
    expect(biomeConfig).toBeDefined();
    expect(typeof biomeConfig).toBe("object");
  });

  test("should have correct schema version", () => {
    expect(biomeConfig.$schema).toBe(
      "https://biomejs.dev/schemas/2.3.2/schema.json",
    );
  });

  describe("File Configuration", () => {
    test("should have includes pattern configured", () => {
      const files = biomeConfig.files as Record<string, unknown>;
      expect(files).toBeDefined();
      expect(files.includes).toBeDefined();
      expect(Array.isArray(files.includes)).toBe(true);
    });

    test("should exclude node_modules directory", () => {
      const files = biomeConfig.files as Record<string, string[]>;
      expect(files.includes).toContain("!**/node_modules");
    });

    test("should exclude .git directory", () => {
      const files = biomeConfig.files as Record<string, string[]>;
      expect(files.includes).toContain("!**/.git");
    });

    test("should exclude build and dist directories", () => {
      const files = biomeConfig.files as Record<string, string[]>;
      expect(files.includes).toContain("!**/build");
      expect(files.includes).toContain("!**/dist");
    });

    test("should exclude coverage directory", () => {
      const files = biomeConfig.files as Record<string, string[]>;
      expect(files.includes).toContain("!**/coverage");
    });

    test("should exclude bun.lock file", () => {
      const files = biomeConfig.files as Record<string, string[]>;
      expect(files.includes).toContain("!**/bun.lock");
    });
  });

  describe("Formatter Configuration", () => {
    test("formatter should be enabled", () => {
      const formatter = biomeConfig.formatter as Record<string, unknown>;
      expect(formatter.enabled).toBe(true);
    });

    test("should use space indentation", () => {
      const formatter = biomeConfig.formatter as Record<string, unknown>;
      expect(formatter.indentStyle).toBe("space");
    });

    test("should use 2 spaces for indentation", () => {
      const formatter = biomeConfig.formatter as Record<string, unknown>;
      expect(formatter.indentWidth).toBe(2);
    });

    test("should use 80 character line width", () => {
      const formatter = biomeConfig.formatter as Record<string, unknown>;
      expect(formatter.lineWidth).toBe(80);
    });
  });

  describe("Linter Configuration", () => {
    test("linter should be enabled", () => {
      const linter = biomeConfig.linter as Record<string, unknown>;
      expect(linter.enabled).toBe(true);
    });

    test("should have recommended rules enabled", () => {
      const linter = biomeConfig.linter as Record<
        string,
        Record<string, unknown>
      >;
      expect(linter.rules).toBeDefined();
      expect(linter.rules.recommended).toBe(true);
    });
  });

  describe("JavaScript/TypeScript Configuration", () => {
    test("should use double quotes", () => {
      const javascript = biomeConfig.javascript as Record<
        string,
        Record<string, unknown>
      >;
      expect(javascript.formatter).toBeDefined();
      expect(javascript.formatter.quoteStyle).toBe("double");
    });

    test("should always use semicolons", () => {
      const javascript = biomeConfig.javascript as Record<
        string,
        Record<string, unknown>
      >;
      expect(javascript.formatter).toBeDefined();
      expect(javascript.formatter.semicolons).toBe("always");
    });
  });

  describe("Package.json Scripts", () => {
    test("should have lint script", () => {
      const packageJson = JSON.parse(
        readFileSync(join(__dirname, "package.json"), "utf-8"),
      );
      expect(packageJson.scripts.lint).toBe("bun biome check .");
    });

    test("should have lint:fix script", () => {
      const packageJson = JSON.parse(
        readFileSync(join(__dirname, "package.json"), "utf-8"),
      );
      expect(packageJson.scripts["lint:fix"]).toBe("bun biome check --write .");
    });

    test("should have format script", () => {
      const packageJson = JSON.parse(
        readFileSync(join(__dirname, "package.json"), "utf-8"),
      );
      expect(packageJson.scripts.format).toBe("bun biome format --write .");
    });
  });
});
