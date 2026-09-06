import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "./client.js";
import { runMigrations } from "./migrate.js";
import { createRepositories, type Repositories } from "./repositories.js";
import type { Basho } from "@fantasy-sumo/domain";

let database: DatabaseClient;
let repositories: Repositories;
const basho: Basho = {
  id: "2026-07",
  isDemo: false,
  name: "Test",
  startDate: "2026-07-12",
  endDate: "2026-07-26",
  status: "upcoming",
  currentDay: 0,
};
beforeEach(async () => {
  database = createDatabaseClient(":memory:");
  await runMigrations(database);
  repositories = createRepositories(database);
  await repositories.upsertBasho(basho);
});
afterEach(async () => {
  await database.close();
});

describe("persisted scoring rules", () => {
  it("defaults each new basho to wins and keeps changes scoped", async () => {
    expect(await repositories.getBashoScoringConfig(basho.id)).toEqual({
      bashoId: basho.id,
      mode: "wins-v0",
      locked: false,
    });
    await repositories.setBashoScoringMode(basho.id, "achievements-v1");
    await repositories.upsertBasho({ ...basho, id: "2026-09" });
    expect((await repositories.getBashoScoringConfig("2026-09"))?.mode).toBe(
      "wins-v0",
    );
    await repositories.upsertBasho({ ...basho, name: "Source refresh" });
    expect((await repositories.getBashoScoringConfig(basho.id))?.mode).toBe(
      "achievements-v1",
    );
  });
  it("locks irreversibly on every lifecycle write, including direct updates without teams", async () => {
    await repositories.setBashoScoringMode(basho.id, "achievements-v1");
    await repositories.lockBashoAndFantasyTeams(
      basho.id,
      "2026-07-10T12:00:00.000Z",
    );
    expect(await repositories.setBashoScoringMode(basho.id, "wins-v0")).toBe(
      "locked",
    );
    await repositories.transitionBashoLifecycle(
      basho.id,
      "open-picks",
      "2026-07-10T13:00:00.000Z",
    );
    expect(await repositories.setBashoScoringMode(basho.id, "wins-v0")).toBe(
      "locked",
    );
    expect(
      await repositories.setBashoScoringMode(basho.id, "achievements-v1"),
    ).toBe("updated");
    await repositories.upsertBasho({
      ...basho,
      id: "another",
      status: "complete",
    });
    expect(
      await repositories.setBashoScoringMode("another", "achievements-v1"),
    ).toBe("locked");
  });
  it("replaces confirmed awards atomically, rejects invalid recipients, and ignores older responses", async () => {
    await repositories.upsertRikishi({ id: "m", shikona: "M" });
    await repositories.upsertBanzukeEntry({
      id: "rank-m",
      bashoId: basho.id,
      rikishiId: "m",
      rank: "Maegashira 1",
      rankOrder: 1,
    });
    const snapshot = {
      bashoId: basho.id,
      source: "test",
      fetchedAt: "2026-07-26T12:00:00.000Z",
      awards: [{ rikishiId: "m", type: "technique" as const }],
    };
    await expect(
      repositories.replaceSpecialPrizeSnapshot(snapshot),
    ).rejects.toThrow("completed");
    await repositories.updateBasho({
      ...basho,
      status: "complete",
      currentDay: 15,
    });
    await repositories.replaceSpecialPrizeSnapshot(snapshot);
    await repositories.replaceSpecialPrizeSnapshot(snapshot);
    await expect(
      repositories.replaceSpecialPrizeSnapshot({
        ...snapshot,
        fetchedAt: "2026-07-26T13:00:00.000Z",
        awards: [{ rikishiId: "missing", type: "technique" }],
      }),
    ).rejects.toThrow("Invalid");
    expect(await repositories.getSpecialPrizeSnapshot(basho.id)).toEqual(
      snapshot,
    );
    const correction = {
      ...snapshot,
      fetchedAt: "2026-07-26T14:00:00.000Z",
      awards: [],
    };
    await repositories.replaceSpecialPrizeSnapshot(correction);
    await repositories.replaceSpecialPrizeSnapshot(snapshot);
    expect(await repositories.getSpecialPrizeSnapshot(basho.id)).toEqual(
      correction,
    );
  });
});
