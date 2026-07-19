import { createHash } from "node:crypto";
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
      "checksum" text,
      "applied_at" text NOT NULL
    )
  `;

  await database.sql`
    ALTER TABLE "__fantasy_sumo_migrations"
    ADD COLUMN IF NOT EXISTS "checksum" text
  `;

  const appliedRows = await database.sql<
    { id: string; checksum: string | null }[]
  >`
    SELECT "id", "checksum" FROM "__fantasy_sumo_migrations"
  `;
  const applied = new Map(
    appliedRows.map((row) => [row.id, row.checksum] as const),
  );
  const migrationFiles = readdirSync(migrationsFolder)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const migrationSql = readFileSync(join(migrationsFolder, file), "utf8");
    const checksum = getMigrationChecksum(migrationSql);

    if (applied.has(file)) {
      const state = resolveAppliedMigration(file, checksum, applied.get(file)!);

      if (state === "backfill") {
        const updatedRows = await database.sql<{ checksum: string }[]>`
          UPDATE "__fantasy_sumo_migrations"
          SET "checksum" = ${checksum}
          WHERE "id" = ${file} AND "checksum" IS NULL
          RETURNING "checksum"
        `;

        if (updatedRows.length === 0) {
          const currentRows = await database.sql<{ checksum: string | null }[]>`
            SELECT "checksum" FROM "__fantasy_sumo_migrations"
            WHERE "id" = ${file}
          `;
          resolveAppliedMigration(file, checksum, currentRows[0]?.checksum);
        }
      }

      continue;
    }

    await database.sql.begin(async (transaction) => {
      for (const statement of splitSqlStatements(migrationSql)) {
        await transaction.unsafe(statement);
      }

      await transaction`
        INSERT INTO "__fantasy_sumo_migrations" ("id", "checksum", "applied_at")
        VALUES (${file}, ${checksum}, ${new Date().toISOString()})
      `;
    });
  }
}

export function getMigrationChecksum(migrationSql: string): string {
  return createHash("sha256").update(migrationSql).digest("hex");
}

export function resolveAppliedMigration(
  file: string,
  expectedChecksum: string,
  appliedChecksum: string | null | undefined,
): "applied" | "backfill" {
  if (appliedChecksum === null) {
    return "backfill";
  }

  if (appliedChecksum === expectedChecksum) {
    return "applied";
  }

  throw new Error(
    `Migration checksum mismatch for "${file}". The database recorded different SQL under the same migration filename.`,
  );
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
