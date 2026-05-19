import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_DATABASE_URL, resolveSqlitePath } from "./config.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("database config", () => {
  it("resolves the default SQLite path from the package root", () => {
    expect(resolveSqlitePath(DEFAULT_DATABASE_URL)).toBe(
      join(packageRoot, "data/fantasy-sumo.sqlite"),
    );
  });

  it("preserves absolute SQLite file paths", () => {
    expect(resolveSqlitePath("file:/tmp/fantasy-sumo.sqlite")).toBe(
      "/tmp/fantasy-sumo.sqlite",
    );
  });
});
