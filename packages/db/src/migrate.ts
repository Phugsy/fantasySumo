import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDatabaseClient } from "./client.js";
import type { SqliteDatabase } from "./client.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsFolder = join(packageRoot, "drizzle");

export function runMigrations(db: SqliteDatabase): void {
  migrate(db, { migrationsFolder });
}

export function migrateDatabase(databaseUrl?: string): void {
  const client = createDatabaseClient(databaseUrl);

  try {
    runMigrations(client.db);
  } finally {
    client.close();
  }
}
