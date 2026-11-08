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

describe("scoring migration compatibility", () => {
  it("preserves win-only rules for existing data and records previous locks", () => {
    const database = new Database(":memory:");
    database.exec(`
      CREATE TABLE basho (id text PRIMARY KEY, status text NOT NULL);
      CREATE TABLE fantasy_teams (basho_id text, locked_at text);
      INSERT INTO basho VALUES ('open', 'upcoming'), ('reopened', 'upcoming'), ('old', 'complete');
      INSERT INTO fantasy_teams VALUES ('reopened', '2026-07-10T12:00:00.000Z');
    `);
    database.exec(
      readFileSync(
        join(packageRoot, "drizzle", "0007_friendly_skreet.sql"),
        "utf8",
      ).replaceAll("--> statement-breakpoint", ""),
    );
    expect(
      database
        .prepare(
          "SELECT basho_id, mode, locked FROM basho_scoring_config ORDER BY basho_id",
        )
        .all(),
    ).toEqual([
      { basho_id: "old", mode: "wins-v0", locked: 1 },
      { basho_id: "open", mode: "wins-v0", locked: 0 },
      { basho_id: "reopened", mode: "wins-v0", locked: 1 },
    ]);
    // These writes model the older application, which knows nothing about scoring.
    database.exec(
      "INSERT INTO basho VALUES ('new', 'upcoming'); UPDATE basho SET status = 'locked' WHERE id = 'new'; UPDATE basho SET status = 'upcoming' WHERE id = 'new';",
    );
    expect(
      database
        .prepare(
          "SELECT mode, locked FROM basho_scoring_config WHERE basho_id = 'new'",
        )
        .get(),
    ).toEqual({ mode: "wins-v0", locked: 1 });
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
      "0006_scoring_modes.sql",
      "0007_rikishi_source_identities.sql",
      "0008_joker_trial.sql",
      "0009_live_joker_trial.sql",
      "0010_scoring_overrides.sql",
      "0011_achievement_focus.sql",
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

describe("achievement focus expansion", () => {
  it("preserves existing trial and audit rows, old writes, and foreign keys while accepting v2", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    const folder = join(packageRoot, "drizzle");
    for (const file of readdirSync(folder)
      .filter((file) => file.endsWith(".sql") && file < "0012")
      .sort())
      db.exec(
        readFileSync(join(folder, file), "utf8").replaceAll(
          "--> statement-breakpoint",
          "",
        ),
      );
    db.exec(`INSERT INTO basho (id,name,start_date,end_date,status,is_demo) VALUES ('demo','Demo','2026-05-10','2026-05-24','upcoming',1);
      INSERT INTO basho_joker_trial VALUES ('demo','three-joker-v1','wins-v0','2026-05-10T02:00:00.000Z','2026-05-10T02:00:00.000Z');
      INSERT INTO basho_live_joker_trial VALUES ('demo','three-joker-v1','achievements-v1','2026-05-10T02:00:00.000Z','owner');
      INSERT INTO basho_scoring_overrides VALUES ('audit','demo','wins-v0','achievements-v1','owner','Approved scoring correction','2026-05-10T02:00:00.000Z');`);
    const tables = [
      "basho_joker_trial",
      "basho_live_joker_trial",
      "basho_scoring_overrides",
    ];
    const before = tables.map((table) =>
      db.prepare(`SELECT * FROM ${table}`).all(),
    );
    db.transaction(() =>
      db.exec(
        readFileSync(
          join(folder, "0012_achievement_focus.sql"),
          "utf8",
        ).replaceAll("--> statement-breakpoint", ""),
      ),
    )();
    expect(
      tables.map((table) => db.prepare(`SELECT * FROM ${table}`).all()),
    ).toEqual(before);
    // The old application can keep reading and writing its original modes.
    db.exec(
      "UPDATE basho_joker_trial SET base_mode='achievements-v1'; UPDATE basho_live_joker_trial SET base_mode='wins-v0';",
    );
    db.exec(
      "UPDATE basho_joker_trial SET base_mode='achievements-v2'; UPDATE basho_live_joker_trial SET base_mode='achievements-v2'; INSERT INTO basho_scoring_overrides VALUES ('new-audit','demo','achievements-v1','achievements-v2','owner','Approved next scoring preset','2026-05-10T03:00:00.000Z');",
    );
    expect(db.pragma("foreign_key_check")).toEqual([]);
    expect(() =>
      db.exec("UPDATE basho_joker_trial SET base_mode='unknown'"),
    ).toThrow();
    expect(
      db
        .prepare("SELECT * FROM basho_scoring_overrides WHERE id='audit'")
        .get(),
    ).toEqual(before[2]![0]);
    db.close();
  });
});
