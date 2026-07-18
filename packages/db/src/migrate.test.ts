import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

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
