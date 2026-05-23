import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "./client.js";
import { runMigrations } from "./migrate.js";
import { createRepositories } from "./repositories.js";
import { seedDatabase } from "./seed.js";
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
});
