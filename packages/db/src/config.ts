import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_DATABASE_URL = "file:./data/fantasy-sumo.sqlite";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export type DatabaseProvider = "sqlite" | "postgres";

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

export function getDatabaseProvider(
  databaseUrl = getDatabaseUrl(),
): DatabaseProvider {
  if (process.env.VERCEL === "1" && !isPostgresUrl(databaseUrl)) {
    throw new Error(
      "Vercel deployments must use a managed postgres/postgresql DATABASE_URL.",
    );
  }

  if (databaseUrl === ":memory:" || databaseUrl.startsWith("file:")) {
    return "sqlite";
  }

  if (isPostgresUrl(databaseUrl)) {
    return "postgres";
  }

  throw new Error(
    `Unsupported DATABASE_URL "${databaseUrl}". Use a file: SQLite URL locally or a postgres/postgresql URL for production.`,
  );
}

export function resolveSqlitePath(databaseUrl = getDatabaseUrl()): string {
  if (process.env.VERCEL === "1") {
    if (databaseUrl === ":memory:" || databaseUrl.startsWith("file:")) {
      throw new Error(
        "Vercel deployments must use a managed DATABASE_URL. SQLite is only supported for local development.",
      );
    }

    throw new Error(
      `Unsupported Vercel DATABASE_URL "${databaseUrl}". Use a managed postgres/postgresql URL.`,
    );
  }

  if (databaseUrl === ":memory:") {
    return databaseUrl;
  }

  if (!databaseUrl.startsWith("file:")) {
    throw new Error(
      `Unsupported DATABASE_URL "${databaseUrl}". Use a file: SQLite URL.`,
    );
  }

  const sqlitePath = databaseUrl.slice("file:".length);

  if (isAbsolute(sqlitePath)) {
    return sqlitePath;
  }

  return resolve(packageRoot, sqlitePath);
}

function isPostgresUrl(databaseUrl: string): boolean {
  return (
    databaseUrl.startsWith("postgres://") ||
    databaseUrl.startsWith("postgresql://")
  );
}

export function ensureSqliteDirectory(databasePath: string): void {
  if (databasePath === ":memory:") {
    return;
  }

  mkdirSync(dirname(databasePath), { recursive: true });
}
