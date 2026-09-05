import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { getMigrationChecksum, resolveAppliedMigration } from "./migrate.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("demo flag migration", () => {
  it("leaves every existing basho classified as live", () => {
    const database = new Database(":memory:");
    database.exec(`
      CREATE TABLE basho (
        id text PRIMARY KEY NOT NULL,
        name text NOT NULL,
        start_date text NOT NULL,
        end_date text NOT NULL,
        status text NOT NULL,
        current_day integer DEFAULT 0 NOT NULL
      );
      INSERT INTO basho VALUES
        ('demo-2026-05', 'Unverified collision', '2026-05-10', '2026-05-24', 'upcoming', 0),
        ('2026-05', 'Live basho', '2026-05-10', '2026-05-24', 'upcoming', 0);
    `);

    const migration = readFileSync(
      join(packageRoot, "drizzle", "0002_rainy_madame_hydra.sql"),
      "utf8",
    ).replaceAll("--> statement-breakpoint", "");
    database.exec(migration);

    expect(
      database
        .prepare("SELECT id, is_demo AS isDemo FROM basho ORDER BY id")
        .all(),
    ).toEqual([
      { id: "2026-05", isDemo: 0 },
      { id: "demo-2026-05", isDemo: 0 },
    ]);

    database.close();
  });
});

describe("banzuke identity snapshot migration", () => {
  it("backfills existing banzuke names and heya", () => {
    const database = new Database(":memory:");
    database.exec(`
      CREATE TABLE rikishi (
        id text PRIMARY KEY NOT NULL,
        shikona text NOT NULL,
        heya text
      );
      CREATE TABLE banzuke_entries (
        id text PRIMARY KEY NOT NULL,
        basho_id text NOT NULL,
        rikishi_id text NOT NULL,
        rank text NOT NULL,
        rank_order integer NOT NULL
      );
      INSERT INTO rikishi VALUES ('kirishima', 'Kirishima', 'Oitekaze');
      INSERT INTO banzuke_entries VALUES
        ('2026-07-kirishima', '2026-07', 'kirishima', 'Maegashira', 1);
    `);

    const migration = readFileSync(
      join(packageRoot, "drizzle", "0006_good_guardsmen.sql"),
      "utf8",
    ).replaceAll("--> statement-breakpoint", "");
    database.exec(migration);

    expect(
      database
        .prepare(
          "SELECT shikona, heya FROM banzuke_entries WHERE id = '2026-07-kirishima'",
        )
        .get(),
    ).toEqual({ shikona: "Kirishima", heya: "Oitekaze" });

    database.close();
  });
});

describe("Postgres migration ledger", () => {
  it("preserves the deployed production migration identities and order", () => {
    const migrationsFolder = join(packageRoot, "drizzle-pg");
    const migrationFiles = readdirSync(migrationsFolder)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    expect(migrationFiles).toEqual([
      "0000_initial.sql",
      "0001_team_owner_user.sql",
      "0002_basho_demo_flag.sql",
      "0003_scheduled_bouts.sql",
      "0004_basho_game_config.sql",
      "0005_banzuke_identity_snapshot.sql",
    ]);
    const initialMigration = readFileSync(
      join(migrationsFolder, "0000_initial.sql"),
      "utf8",
    );
    const ownerMigration = readFileSync(
      join(migrationsFolder, "0001_team_owner_user.sql"),
      "utf8",
    );
    const demoMigration = readFileSync(
      join(migrationsFolder, "0002_basho_demo_flag.sql"),
      "utf8",
    );
    const scheduleMigration = readFileSync(
      join(migrationsFolder, "0003_scheduled_bouts.sql"),
      "utf8",
    );
    const identitySnapshotMigration = readFileSync(
      join(migrationsFolder, "0005_banzuke_identity_snapshot.sql"),
      "utf8",
    );

    expect(getMigrationChecksum(initialMigration)).toBe(
      "355dc080c83437a8a07343062a0d60be1513c3c2c03f0602aaff4fc3963d2ad8",
    );
    expect(getMigrationChecksum(ownerMigration)).toBe(
      "c16e0d8c8951cc4f8b1e0e2fd961a07934249f8d81416ec7a8fa8853a66f1c76",
    );
    expect(getMigrationChecksum(demoMigration)).toBe(
      "c71762adeff7df2b1d4e9f92dfc4773291fb9b33ee25518b22aac7edd0d6ea42",
    );
    expect(demoMigration).toContain("ADD COLUMN IF NOT EXISTS");
    expect(getMigrationChecksum(scheduleMigration)).toBe(
      "af3fb3690d94ec2a0b69ce4b7f13537c9660936cbf24f8866d6f80313e019e4e",
    );
    expect(identitySnapshotMigration).toContain('UPDATE "banzuke_entries"');
    expect(identitySnapshotMigration).toContain(
      'AND "banzuke_entries"."shikona" IS NULL',
    );
  });

  it("uses stable content checksums and detects changed SQL", () => {
    const checksum = getMigrationChecksum("SELECT 1;\n");

    expect(checksum).toBe(getMigrationChecksum("SELECT 1;\n"));
    expect(checksum).toBe(getMigrationChecksum("SELECT 1;\r\n"));
    expect(checksum).toBe(getMigrationChecksum("SELECT 1;\r"));
    expect(checksum).not.toBe(getMigrationChecksum("SELECT 2;\n"));
    expect(
      resolveAppliedMigration("0002_example.sql", checksum, checksum),
    ).toBe("applied");
    expect(() =>
      resolveAppliedMigration("0002_example.sql", checksum, null),
    ).toThrow(
      `Migration checksum is missing for "0002_example.sql". The database cannot verify which SQL was applied. Inspect the schema, then explicitly record trusted checksum "${checksum}" before retrying.`,
    );
    expect(() =>
      resolveAppliedMigration("0002_example.sql", checksum, undefined),
    ).toThrow(
      `Migration checksum is missing for "0002_example.sql". The database cannot verify which SQL was applied. Inspect the schema, then explicitly record trusted checksum "${checksum}" before retrying.`,
    );
    expect(() =>
      resolveAppliedMigration("0002_example.sql", checksum, "other-checksum"),
    ).toThrow(
      'Migration checksum mismatch for "0002_example.sql". The database recorded different SQL under the same migration filename.',
    );
  });
});
