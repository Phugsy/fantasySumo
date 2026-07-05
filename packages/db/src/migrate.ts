import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDatabaseClient } from "./client.js";
import type { AppDatabase } from "./client.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sqliteMigrationsFolder = join(packageRoot, "drizzle");
const postgresMigrationsFolder = join(packageRoot, "drizzle-pg");

export async function runMigrations(database: AppDatabase): Promise<void> {
  if (database.provider === "postgres") {
    await runPostgresMigrations(database, postgresMigrationsFolder);
    return;
  }

  migrate(database.db, { migrationsFolder: sqliteMigrationsFolder });
}

async function runPostgresMigrations(
  database: Extract<AppDatabase, { provider: "postgres" }>,
  migrationsFolder: string,
): Promise<void> {
  await database.sql`
    CREATE TABLE IF NOT EXISTS "__fantasy_sumo_migrations" (
      "id" text PRIMARY KEY NOT NULL,
      "applied_at" text NOT NULL
    )
  `;

  const appliedRows = await database.sql<{ id: string }[]>`
    SELECT "id" FROM "__fantasy_sumo_migrations"
  `;
  const applied = new Set(appliedRows.map((row) => row.id));
  const migrationFiles = readdirSync(migrationsFolder)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    if (applied.has(file)) {
      continue;
    }

    const migrationSql = readFileSync(join(migrationsFolder, file), "utf8");

    await database.sql.begin(async (transaction) => {
      for (const statement of splitSqlStatements(migrationSql)) {
        await transaction.unsafe(statement);
      }

      await transaction`
        INSERT INTO "__fantasy_sumo_migrations" ("id", "applied_at")
        VALUES (${file}, ${new Date().toISOString()})
      `;
    });
  }
}

function splitSqlStatements(migrationSql: string): string[] {
  return migrationSql
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

export async function migrateDatabase(databaseUrl?: string): Promise<void> {
  const client = createDatabaseClient(databaseUrl);

  try {
    await runMigrations(client);
  } finally {
    await client.close();
  }
}
