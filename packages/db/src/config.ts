import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

export const DEFAULT_DATABASE_URL = "file:./data/fantasy-sumo.sqlite";

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

  return resolve(databaseUrl.slice("file:".length));
}

export function ensureSqliteDirectory(databasePath: string): void {
  if (databasePath === ":memory:") {
    return;
  }

  mkdirSync(dirname(databasePath), { recursive: true });
}
