import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_DATABASE_URL = "file:./data/fantasy-sumo.sqlite";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

export function resolveSqlitePath(databaseUrl = getDatabaseUrl()): string {
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

export function ensureSqliteDirectory(databasePath: string): void {
  if (databasePath === ":memory:") {
    return;
  }

  mkdirSync(dirname(databasePath), { recursive: true });
}
