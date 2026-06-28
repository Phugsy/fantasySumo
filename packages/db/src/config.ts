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
  if (databaseUrl === ":memory:" || databaseUrl.startsWith("file:")) {
    return "sqlite";
  }

  if (
    databaseUrl.startsWith("postgres://") ||
    databaseUrl.startsWith("postgresql://")
  ) {
    return "postgres";
  }

  throw new Error(
    `Unsupported DATABASE_URL "${databaseUrl}". Use a file: SQLite URL locally or a postgres/postgresql URL for production.`,
  );
}

export function resolveSqlitePath(databaseUrl = getDatabaseUrl()): string {
  if (databaseUrl === ":memory:") {
    return databaseUrl;
  }

  if (process.env.VERCEL === "1") {
    if (databaseUrl.startsWith("file:")) {
      throw new Error(
        "Vercel deployments must use a managed DATABASE_URL. File-backed SQLite is only supported for local development.",
      );
    }

    throw new Error(
      `Unsupported Vercel DATABASE_URL "${databaseUrl}". Use a managed postgres/postgresql URL.`,
    );
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

export function ensureSqliteDirectory(databasePath: string): void {
  if (databasePath === ":memory:") {
    return;
  }

  mkdirSync(dirname(databasePath), { recursive: true });
}
