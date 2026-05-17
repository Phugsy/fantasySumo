import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { ensureSqliteDirectory, resolveSqlitePath } from "./config.js";
import * as schema from "./schema.js";

export type SqliteDatabase = ReturnType<typeof createDrizzleDatabase>;

export interface DatabaseClient {
  sqlite: Database.Database;
  db: SqliteDatabase;
  close: () => void;
}

export function createDatabaseClient(databaseUrl?: string): DatabaseClient {
  const databasePath = resolveSqlitePath(databaseUrl);
  ensureSqliteDirectory(databasePath);

  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");

  const db = createDrizzleDatabase(sqlite);

  return {
    sqlite,
    db,
    close: () => sqlite.close(),
  };
}

function createDrizzleDatabase(sqlite: Database.Database) {
  return drizzle(sqlite, { schema });
}
