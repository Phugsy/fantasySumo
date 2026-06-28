import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_DATABASE_URL,
  getDatabaseProvider,
  resolveSqlitePath,
} from "./config.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const originalVercel = process.env.VERCEL;

afterEach(() => {
  process.env.VERCEL = originalVercel;
});

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

  it("rejects file-backed SQLite on Vercel", () => {
    process.env.VERCEL = "1";

    expect(() => resolveSqlitePath("file:/tmp/fantasy-sumo.sqlite")).toThrow(
      "Vercel deployments must use a managed DATABASE_URL",
    );
  });

  it("rejects in-memory SQLite on Vercel", () => {
    process.env.VERCEL = "1";

    expect(() => getDatabaseProvider(":memory:")).toThrow(
      "Vercel deployments must use a managed postgres/postgresql DATABASE_URL",
    );
    expect(() => resolveSqlitePath(":memory:")).toThrow(
      "Vercel deployments must use a managed DATABASE_URL",
    );
  });

  it("detects SQLite and Postgres database providers", () => {
    expect(getDatabaseProvider(":memory:")).toBe("sqlite");
    expect(getDatabaseProvider("file:/tmp/fantasy-sumo.sqlite")).toBe("sqlite");
    expect(
      getDatabaseProvider("postgres://user:pass@example.com:5432/fantasy_sumo"),
    ).toBe("postgres");
    expect(
      getDatabaseProvider(
        "postgresql://user:pass@example.com:5432/fantasy_sumo",
      ),
    ).toBe("postgres");
  });
});
