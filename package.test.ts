import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("Package Dependencies", () => {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, "package.json"), "utf-8"),
  );

  describe("Production Dependencies", () => {
    test("should include @browserbasehq/sdk@2.6.0", () => {
      expect(packageJson.dependencies?.["@browserbasehq/sdk"]).toBe("2.6.0");
    });

    test("should include @browserbasehq/stagehand@2.5.0", () => {
      expect(packageJson.dependencies?.["@browserbasehq/stagehand"]).toBe(
        "2.5.0",
      );
    });

    test("should include ai@5.0.86", () => {
      expect(packageJson.dependencies?.ai).toBe("5.0.86");
    });

    test("should include @ai-sdk/openai@2.0.59", () => {
      expect(packageJson.dependencies?.["@ai-sdk/openai"]).toBe("2.0.59");
    });

    test("should include commander@14.0.2", () => {
      expect(packageJson.dependencies?.commander).toBe("14.0.2");
    });

    test("should include pino@10.1.0", () => {
      expect(packageJson.dependencies?.pino).toBe("10.1.0");
    });
  });

  describe("Development Dependencies", () => {
    test("should include vitest@4.0", () => {
      const version = packageJson.devDependencies?.vitest;
      expect(version).toMatch(/^4\.0/);
    });

    test("should include @biomejs/biome@2.3.2", () => {
      const version = packageJson.devDependencies?.["@biomejs/biome"];
      expect(version).toMatch(/^2\.3/);
    });

    test("should include @types/bun", () => {
      expect(packageJson.devDependencies?.["@types/bun"]).toBeDefined();
    });
  });

  describe("Installation Verification", () => {
    test("bun.lock file should exist", () => {
      const bunLockExists = require("node:fs").existsSync(
        join(__dirname, "bun.lock"),
      );
      expect(bunLockExists).toBe(true);
    });

    test("package.json should be valid JSON", () => {
      expect(packageJson).toBeDefined();
      expect(typeof packageJson).toBe("object");
    });

    test("package.json should have required metadata", () => {
      expect(packageJson.name).toBe("browsergameqa");
      expect(packageJson.type).toBe("module");
      expect(packageJson.private).toBe(true);
    });
  });
});
