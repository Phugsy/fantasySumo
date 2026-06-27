import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calculateLeaderboard } from "@fantasy-sumo/domain";
import { createDatabaseClient, type DatabaseClient } from "./client.js";
import {
  DEMO_FINAL_DAY,
  advanceDemoBashoDay,
  completeDemoBasho,
  resetDemoProgression,
  startDemoBasho,
} from "./demo-progression.js";
import {
  demoBanzukeEntries,
  demoBasho,
  demoBoutResults,
  demoFantasyTeams,
  demoRikishi,
} from "./demo-seed-data.js";
import { runMigrations } from "./migrate.js";
import { createRepositories } from "./repositories.js";
import { seedDatabase, seedDemoDatabase } from "./seed.js";
import { sampleBasho, sampleFantasyTeams, sampleRikishi } from "./seed-data.js";

let tmpRoot: string;
let client: DatabaseClient;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "fantasy-sumo-db-"));
  client = createDatabaseClient(`file:${join(tmpRoot, "test.sqlite")}`);
  runMigrations(client.db);
});

afterEach(() => {
  client.close();
  rmSync(tmpRoot, { force: true, recursive: true });
});

describe("repositories", () => {
  it("reads seeded basho, rikishi, teams, picks, and bout results", () => {
    seedDatabase(client.db);
    const repositories = createRepositories(client.db);

    expect(repositories.listBashos()).toEqual([sampleBasho]);
    expect(repositories.listRikishi()).toHaveLength(sampleRikishi.length);
    expect(
      repositories.listBanzukeEntriesForBasho(sampleBasho.id).map((entry) => ({
        rikishiId: entry.rikishiId,
        rankOrder: entry.rankOrder,
      })),
    ).toEqual([
      {
        rikishiId: "onosato",
        rankOrder: 1,
      },
      {
        rikishiId: "kotozakura",
        rankOrder: 2,
      },
      {
        rikishiId: "hoshoryu",
        rankOrder: 3,
      },
      {
        rikishiId: "kirishima",
        rankOrder: 4,
      },
    ]);
    expect(repositories.listFantasyTeamsForBasho(sampleBasho.id)).toEqual(
      sampleFantasyTeams,
    );
    expect(repositories.listFantasyPicksForTeam("team-east")).toEqual([
      {
        id: "pick-east-kirishima",
        teamId: "team-east",
        rikishiId: "kirishima",
      },
      {
        id: "pick-east-onosato",
        teamId: "team-east",
        rikishiId: "onosato",
      },
    ]);
    expect(repositories.listBoutResultsForBasho(sampleBasho.id)).toHaveLength(
      3,
    );
  });

  it("writes and reads a new fantasy team", () => {
    seedDatabase(client.db);
    const repositories = createRepositories(client.db);

    repositories.insertFantasyTeam({
      id: "team-north",
      bashoId: sampleBasho.id,
      displayName: "North Side",
      ownerName: "New Player",
      createdAt: "2026-05-02T10:00:00.000Z",
    });

    expect(
      repositories
        .listFantasyTeamsForBasho(sampleBasho.id)
        .map((team) => team.id),
    ).toContain("team-north");
  });

  it("rolls back team creation when a pick insert fails", () => {
    seedDatabase(client.db);
    const repositories = createRepositories(client.db);

    expect(() =>
      repositories.insertFantasyTeamWithPicks(
        {
          id: "team-rollback",
          bashoId: sampleBasho.id,
          displayName: "Rollback Team",
        },
        [
          {
            teamId: "team-rollback",
            rikishiId: "onosato",
          },
          {
            teamId: "team-rollback",
            rikishiId: "onosato",
          },
        ],
      ),
    ).toThrow();

    expect(repositories.getFantasyTeam("team-rollback")).toBeUndefined();
    expect(repositories.listFantasyPicksForTeam("team-rollback")).toEqual([]);
  });

  it("loads deterministic demo data for local demos and E2E fixtures", () => {
    seedDemoDatabase(client.db);
    const repositories = createRepositories(client.db);

    expect(repositories.listBashos()).toEqual([demoBasho]);
    expect(repositories.listRikishi()).toHaveLength(demoRikishi.length);
    expect(repositories.listBanzukeEntriesForBasho(demoBasho.id)).toHaveLength(
      demoBanzukeEntries.length,
    );
    expect(repositories.listFantasyTeamsForBasho(demoBasho.id)).toHaveLength(
      demoFantasyTeams.length,
    );
    expect(repositories.listBoutResultsForBasho(demoBasho.id)).toEqual([]);

    const leaderboard = calculateLeaderboard(
      repositories.listFantasyTeamsForBasho(demoBasho.id),
      repositories.listFantasyPicksForBasho(demoBasho.id),
      repositories.listBoutResultsForBasho(demoBasho.id),
    );

    expect(
      leaderboard.map((entry) => ({
        rank: entry.rank,
        displayName: entry.displayName,
        score: entry.score,
      })),
    ).toEqual([
      {
        rank: 1,
        displayName: "Dohyo Dreamers",
        score: 0,
      },
      {
        rank: 2,
        displayName: "Salt Circle",
        score: 0,
      },
      {
        rank: 3,
        displayName: "Tachiai Titans",
        score: 0,
      },
      {
        rank: 4,
        displayName: "Yusho Hunters",
        score: 0,
      },
    ]);
  });

  it("resets demo progression to a deterministic pre-basho state", () => {
    seedDemoDatabase(client.db);
    const repositories = createRepositories(client.db);

    completeDemoBasho(repositories, () => new Date("2026-05-10T00:00:00.000Z"));
    resetDemoProgression(client.db);

    expect(repositories.getBasho(demoBasho.id)).toEqual(demoBasho);
    expect(repositories.listBoutResultsForBasho(demoBasho.id)).toEqual([]);
    expect(
      repositories
        .listFantasyTeamsForBasho(demoBasho.id)
        .every((team) => team.lockedAt === undefined),
    ).toBe(true);
  });

  it("starts and advances demo scoring one day at a time", () => {
    seedDemoDatabase(client.db);
    const repositories = createRepositories(client.db);
    const now = () => new Date("2026-05-10T00:00:00.000Z");

    const started = startDemoBasho(repositories, now);

    expect(started.basho).toMatchObject({
      status: "active",
      currentDay: 0,
    });
    expect(started.appliedResults).toBe(0);
    expect(
      repositories
        .listFantasyTeamsForBasho(demoBasho.id)
        .every((team) => team.lockedAt === "2026-05-10T00:00:00.000Z"),
    ).toBe(true);

    const dayOne = advanceDemoBashoDay(repositories, now);

    expect(dayOne.basho).toMatchObject({
      status: "active",
      currentDay: 1,
    });
    expect(
      repositories
        .listBoutResultsForBasho(demoBasho.id)
        .map((result) => result.day),
    ).toEqual([1, 1, 1, 1]);
    expect(
      dayOne.leaderboard.map((entry) => ({
        displayName: entry.displayName,
        score: entry.score,
      })),
    ).toEqual([
      { displayName: "Dohyo Dreamers", score: 1 },
      { displayName: "Salt Circle", score: 1 },
      { displayName: "Tachiai Titans", score: 1 },
      { displayName: "Yusho Hunters", score: 1 },
    ]);

    const dayTwo = advanceDemoBashoDay(repositories, now);

    expect(dayTwo.basho.currentDay).toBe(2);
    expect(dayTwo.appliedResults).toBe(8);
    expect(
      repositories
        .listBoutResultsForBasho(demoBasho.id)
        .map((result) => result.day),
    ).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
  });

  it("can complete demo progression through the final day", () => {
    seedDemoDatabase(client.db);
    const repositories = createRepositories(client.db);

    const completed = completeDemoBasho(
      repositories,
      () => new Date("2026-05-10T00:00:00.000Z"),
    );

    expect(completed.basho).toMatchObject({
      status: "complete",
      currentDay: DEMO_FINAL_DAY,
    });
    expect(completed.appliedResults).toBe(demoBoutResults.length);
    expect(
      repositories.listBoutResultsForBasho(demoBasho.id).at(-1),
    ).toMatchObject({
      day: DEMO_FINAL_DAY,
    });
    expect(completed.leaderboard[0]).toMatchObject({
      displayName: "Yusho Hunters",
      score: 22,
    });
  });
});
