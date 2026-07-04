import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_DATABASE_URL,
  getDatabaseProvider,
  resolveSqlitePath,
} from "./config.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
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

  it("rejects file-backed SQLite in production", () => {
    process.env.NODE_ENV = "production";

    expect(() => resolveSqlitePath("file:/tmp/fantasy-sumo.sqlite")).toThrow(
      "Production deployments must use a managed DATABASE_URL",
    );
  });

  it("rejects in-memory SQLite in production", () => {
    process.env.NODE_ENV = "production";

    expect(() => getDatabaseProvider(":memory:")).toThrow(
      "Production deployments must use a managed postgres/postgresql DATABASE_URL",
    );
    expect(() => resolveSqlitePath(":memory:")).toThrow(
      "Production deployments must use a managed DATABASE_URL",
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
