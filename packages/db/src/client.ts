import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ensureSqliteDirectory, resolveSqlitePath } from "./config.js";
import { getDatabaseProvider } from "./config.js";
import * as pgSchema from "./schema.pg.js";
import * as sqliteSchema from "./schema.js";

export type SqliteDatabase = ReturnType<typeof createSqliteDrizzleDatabase>;
export type PostgresDatabase = ReturnType<typeof createPostgresDrizzleDatabase>;
export type AppDatabase = SqliteAppDatabase | PostgresAppDatabase;

export interface SqliteAppDatabase {
  provider: "sqlite";
  db: SqliteDatabase;
}

export interface PostgresAppDatabase {
  provider: "postgres";
  db: PostgresDatabase;
  sql: postgres.Sql;
}

export type DatabaseClient = SqliteDatabaseClient | PostgresDatabaseClient;

export interface SqliteDatabaseClient extends SqliteAppDatabase {
  sqlite: Database.Database;
  close: () => void | Promise<void>;
}

export interface PostgresDatabaseClient extends PostgresAppDatabase {
  close: () => void | Promise<void>;
}

export function createDatabaseClient(databaseUrl?: string): DatabaseClient {
  if (getDatabaseProvider(databaseUrl) === "postgres") {
    return createPostgresDatabaseClient(databaseUrl);
  }

  return createSqliteDatabaseClient(databaseUrl);
}

function createSqliteDatabaseClient(
  databaseUrl?: string,
): SqliteDatabaseClient {
  const databasePath = resolveSqlitePath(databaseUrl);
  ensureSqliteDirectory(databasePath);

  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");

  const db = createSqliteDrizzleDatabase(sqlite);

  return {
    provider: "sqlite",
    sqlite,
    db,
    close: () => {
      sqlite.close();
    },
  };
}

function createPostgresDatabaseClient(
  databaseUrl?: string,
): PostgresDatabaseClient {
  const sql = postgres(databaseUrl ?? process.env.DATABASE_URL!, {
    max: 1,
    prepare: false,
  });
  const db = createPostgresDrizzleDatabase(sql);

  return {
    provider: "postgres",
    sql,
    db,
    close: () => sql.end(),
  };
}

function createSqliteDrizzleDatabase(sqlite: Database.Database) {
  return drizzle(sqlite, { schema: sqliteSchema });
}

function createPostgresDrizzleDatabase(sql: postgres.Sql) {
  return drizzlePostgres(sql, { schema: pgSchema });
}
