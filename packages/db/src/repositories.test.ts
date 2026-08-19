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

beforeEach(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), "fantasy-sumo-db-"));
  client = createDatabaseClient(`file:${join(tmpRoot, "test.sqlite")}`);
  await runMigrations(client);
});

afterEach(async () => {
  await client.close();
  rmSync(tmpRoot, { force: true, recursive: true });
});

describe("repositories", () => {
  it("reads seeded basho, rikishi, teams, picks, and bout results", async () => {
    await seedDatabase(createRepositories(client));
    const repositories = createRepositories(client);

    expect(await repositories.listBashos()).toEqual([sampleBasho]);
    expect(await repositories.listRikishi()).toHaveLength(sampleRikishi.length);
    expect(
      (await repositories.listBanzukeEntriesForBasho(sampleBasho.id)).map(
        (entry) => ({
          rikishiId: entry.rikishiId,
          rankOrder: entry.rankOrder,
        }),
      ),
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
    expect(await repositories.listFantasyTeamsForBasho(sampleBasho.id)).toEqual(
      sampleFantasyTeams,
    );
    expect(await repositories.listFantasyPicksForTeam("team-east")).toEqual([
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
    expect(
      await repositories.listBoutResultsForBasho(sampleBasho.id),
    ).toHaveLength(3);
  });

  it("writes and reads a new fantasy team", async () => {
    await seedDatabase(createRepositories(client));
    const repositories = createRepositories(client);

    await repositories.insertFantasyTeam({
      id: "team-north",
      bashoId: sampleBasho.id,
      displayName: "North Side",
      ownerName: "New Player",
      createdAt: "2026-05-02T10:00:00.000Z",
    });

    expect(
      (await repositories.listFantasyTeamsForBasho(sampleBasho.id)).map(
        (team) => team.id,
      ),
    ).toContain("team-north");
  });

  it("writes and replaces one owned fantasy team for a basho", async () => {
    await seedDatabase(createRepositories(client));
    const repositories = createRepositories(client);

    await repositories.saveOwnedFantasyTeamWithPicksIfBashoUpcoming(
      {
        id: "team-owned",
        bashoId: sampleBasho.id,
        displayName: "North Side",
        ownerName: "New Player",
        ownerUserId: "user-new-player",
        createdAt: "2026-05-02T10:00:00.000Z",
      },
      [
        {
          teamId: "team-owned",
          rikishiId: "onosato",
        },
        {
          teamId: "team-owned",
          rikishiId: "kirishima",
        },
      ],
    );

    expect(
      await repositories.getFantasyTeamForOwner(
        sampleBasho.id,
        "user-new-player",
      ),
    ).toMatchObject({
      id: "team-owned",
      ownerUserId: "user-new-player",
    });

    const updatedTeam =
      await repositories.saveOwnedFantasyTeamWithPicksIfBashoUpcoming(
        {
          id: "team-racing-request",
          bashoId: sampleBasho.id,
          displayName: "North Side Updated",
          ownerName: "New Player",
          ownerUserId: "user-new-player",
          createdAt: "2026-05-02T10:00:00.000Z",
        },
        [
          {
            id: "pick-custom-kotozakura",
            teamId: "team-racing-request",
            rikishiId: "kotozakura",
          },
          {
            teamId: "team-racing-request",
            rikishiId: "hoshoryu",
          },
        ],
      );

    expect(updatedTeam).toMatchObject({
      team: {
        id: "team-owned",
        displayName: "North Side Updated",
      },
      picks: [
        {
          id: "team-owned-hoshoryu",
          teamId: "team-owned",
          rikishiId: "hoshoryu",
        },
        {
          id: "pick-custom-kotozakura",
          teamId: "team-owned",
          rikishiId: "kotozakura",
        },
      ],
    });
    expect(
      await repositories.getFantasyTeam("team-racing-request"),
    ).toBeUndefined();

    expect(
      await repositories.getFantasyTeamForOwner(
        sampleBasho.id,
        "user-new-player",
      ),
    ).toMatchObject({
      id: "team-owned",
      displayName: "North Side Updated",
    });
    expect(await repositories.listFantasyPicksForTeam("team-owned")).toEqual([
      {
        id: "pick-custom-kotozakura",
        teamId: "team-owned",
        rikishiId: "kotozakura",
      },
      {
        id: "team-owned-hoshoryu",
        teamId: "team-owned",
        rikishiId: "hoshoryu",
      },
    ]);
  });

  it("does not replace an owned team after that team has been locked", async () => {
    await seedDatabase(createRepositories(client));
    const repositories = createRepositories(client);
    const ownedTeam = {
      id: "team-owned-locked",
      bashoId: sampleBasho.id,
      displayName: "Locked Stable",
      ownerUserId: "user-locked",
      createdAt: "2026-05-02T10:00:00.000Z",
    };

    await repositories.saveOwnedFantasyTeamWithPicksIfBashoUpcoming(ownedTeam, [
      { teamId: ownedTeam.id, rikishiId: "onosato" },
      { teamId: ownedTeam.id, rikishiId: "kirishima" },
    ]);
    await repositories.lockFantasyTeamsForBasho(
      sampleBasho.id,
      "2026-05-08T02:00:00.000Z",
    );

    expect((await repositories.getBasho(sampleBasho.id))?.status).toBe(
      "upcoming",
    );
    await expect(
      repositories.saveOwnedFantasyTeamWithPicksIfBashoUpcoming(
        {
          ...ownedTeam,
          displayName: "Replacement Stable",
        },
        [
          { teamId: ownedTeam.id, rikishiId: "kotozakura" },
          { teamId: ownedTeam.id, rikishiId: "hoshoryu" },
        ],
      ),
    ).resolves.toBeUndefined();
    expect(await repositories.getFantasyTeam(ownedTeam.id)).toMatchObject({
      displayName: "Locked Stable",
      lockedAt: "2026-05-08T02:00:00.000Z",
    });
    expect(
      (await repositories.listFantasyPicksForTeam(ownedTeam.id)).map(
        (pick) => pick.rikishiId,
      ),
    ).toEqual(["kirishima", "onosato"]);
  });

  it("rolls back team creation when a pick insert fails", async () => {
    await seedDatabase(createRepositories(client));
    const repositories = createRepositories(client);

    await expect(
      repositories.insertFantasyTeamWithPicksIfBashoUpcoming(
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
    ).rejects.toThrow();

    expect(await repositories.getFantasyTeam("team-rollback")).toBeUndefined();
    expect(await repositories.listFantasyPicksForTeam("team-rollback")).toEqual(
      [],
    );
  });

  it("checks the basho status inside guarded team creation", async () => {
    await seedDatabase(createRepositories(client));
    const repositories = createRepositories(client);

    await repositories.updateBasho({ ...sampleBasho, status: "locked" });

    const inserted =
      await repositories.insertFantasyTeamWithPicksIfBashoUpcoming(
        {
          id: "team-after-lock",
          bashoId: sampleBasho.id,
          displayName: "After Lock",
        },
        [
          { teamId: "team-after-lock", rikishiId: "onosato" },
          { teamId: "team-after-lock", rikishiId: "kotozakura" },
        ],
      );

    expect(inserted).toBe(false);
    expect(
      await repositories.getFantasyTeam("team-after-lock"),
    ).toBeUndefined();
    expect(
      await repositories.listFantasyPicksForTeam("team-after-lock"),
    ).toEqual([]);
  });

  it("does not regress lifecycle state inside a banzuke import transaction", async () => {
    await seedDatabase(createRepositories(client));
    const repositories = createRepositories(client);

    await repositories.lockBashoAndFantasyTeams(
      sampleBasho.id,
      "2026-05-08T02:00:00.000Z",
    );
    await repositories.applyBanzukeImport({
      basho: {
        ...sampleBasho,
        name: "Refreshed May Basho",
        status: "upcoming",
        currentDay: 3,
      },
      rikishi: [],
      banzukeEntries: [],
    });

    expect(await repositories.getBasho(sampleBasho.id)).toMatchObject({
      name: "Refreshed May Basho",
      status: "locked",
      currentDay: 3,
    });
  });

  it("does not let a stale result import undo an admin close", async () => {
    await seedDatabase(createRepositories(client));
    const repositories = createRepositories(client);
    const staleImportBasho = {
      ...sampleBasho,
      status: "active" as const,
      currentDay: 2,
    };

    await repositories.updateBasho(staleImportBasho);
    await repositories.transitionBashoLifecycle(
      sampleBasho.id,
      "close",
      "2026-05-12T02:00:00.000Z",
    );
    await repositories.applyBoutResultsImport({
      basho: staleImportBasho,
      bashoId: sampleBasho.id,
      day: 2,
      results: [],
    });

    expect(await repositories.getBasho(sampleBasho.id)).toMatchObject({
      status: "complete",
      currentDay: 2,
    });
  });

  it("loads deterministic demo data for local demos and E2E fixtures", async () => {
    await seedDemoDatabase(createRepositories(client));
    const repositories = createRepositories(client);

    expect(await repositories.listBashos()).toEqual([demoBasho]);
    expect(await repositories.listRikishi()).toHaveLength(demoRikishi.length);
    expect(
      await repositories.listBanzukeEntriesForBasho(demoBasho.id),
    ).toHaveLength(demoBanzukeEntries.length);
    expect(
      await repositories.listFantasyTeamsForBasho(demoBasho.id),
    ).toHaveLength(demoFantasyTeams.length);
    expect(await repositories.listBoutResultsForBasho(demoBasho.id)).toEqual(
      [],
    );
    expect(
      await repositories.listScheduledBoutPublicationsForBasho(demoBasho.id),
    ).toHaveLength(15);
    expect(
      await repositories.listScheduledBoutsForBasho(demoBasho.id),
    ).toHaveLength(demoBoutResults.length);
    expect(
      (await repositories.listScheduledBoutsForBasho(demoBasho.id)).find(
        (bout) => bout.id === "demo-2026-05-day-15-match-4",
      ),
    ).toMatchObject({
      day: 15,
      status: "cancelled",
      withdrawnRikishiId: "tobizaru",
    });

    const leaderboard = calculateLeaderboard(
      await repositories.listFantasyTeamsForBasho(demoBasho.id),
      await repositories.listFantasyPicksForBasho(demoBasho.id),
      await repositories.listBoutResultsForBasho(demoBasho.id),
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

  it("resets demo data without changing live basho data or shared rikishi", async () => {
    const repositories = createRepositories(client);
    await seedDatabase(repositories);
    await repositories.upsertRikishi({
      id: "onosato",
      shikona: "Onosato",
      heya: "Live Metadata Stable",
    });

    await seedDemoDatabase(repositories);
    await completeDemoBasho(repositories);
    await resetDemoProgression(repositories);

    expect(await repositories.getBasho(sampleBasho.id)).toEqual(sampleBasho);
    expect(
      await repositories.listBanzukeEntriesForBasho(sampleBasho.id),
    ).toHaveLength(4);
    expect(await repositories.listFantasyTeamsForBasho(sampleBasho.id)).toEqual(
      sampleFantasyTeams,
    );
    expect(
      await repositories.listFantasyPicksForBasho(sampleBasho.id),
    ).toHaveLength(4);
    expect(
      await repositories.listBoutResultsForBasho(sampleBasho.id),
    ).toHaveLength(3);
    expect(
      (await repositories.listRikishi()).find(
        (rikishi) => rikishi.id === "onosato",
      ),
    ).toMatchObject({ heya: "Live Metadata Stable" });
    expect(await repositories.getBasho(demoBasho.id)).toEqual(demoBasho);
    expect(
      await repositories.listScheduledBoutsForBasho(demoBasho.id),
    ).toHaveLength(demoBoutResults.length);
  });

  it("fails closed when the demo id belongs to a live basho", async () => {
    const repositories = createRepositories(client);
    const collidingLiveBasho = {
      ...demoBasho,
      isDemo: false,
      name: "Live Basho With Colliding ID",
    };
    await repositories.insertBasho(collidingLiveBasho);

    await expect(seedDemoDatabase(repositories)).rejects.toThrow(
      `Refusing to replace live basho ${demoBasho.id} with demo data.`,
    );

    expect(await repositories.getBasho(demoBasho.id)).toEqual(
      collidingLiveBasho,
    );
  });

  it("rejects resets for any other demo basho id", async () => {
    const repositories = createRepositories(client);

    await expect(
      repositories.replaceDemoBashoData({
        basho: { ...demoBasho, id: "demo-other" },
        rikishi: [],
        banzukeEntries: [],
        fantasyTeams: [],
        fantasyPicks: [],
        boutResults: [],
        scheduledBoutPublications: [],
        scheduledBouts: [],
      }),
    ).rejects.toThrow(
      `Demo reset may only replace the fixed basho ${demoBasho.id}.`,
    );
  });

  it("resets demo progression to a deterministic pre-basho state", async () => {
    await seedDemoDatabase(createRepositories(client));
    const repositories = createRepositories(client);

    await completeDemoBasho(
      repositories,
      () => new Date("2026-05-10T00:00:00.000Z"),
    );
    await resetDemoProgression(createRepositories(client));

    expect(await repositories.getBasho(demoBasho.id)).toEqual(demoBasho);
    expect(await repositories.listBoutResultsForBasho(demoBasho.id)).toEqual(
      [],
    );
    expect(
      (await repositories.listFantasyTeamsForBasho(demoBasho.id)).every(
        (team) => team.lockedAt === undefined,
      ),
    ).toBe(true);
  });

  it("starts and advances demo scoring one day at a time", async () => {
    await seedDemoDatabase(createRepositories(client));
    const repositories = createRepositories(client);
    const now = () => new Date("2026-05-10T00:00:00.000Z");

    const started = await startDemoBasho(repositories, now);

    expect(started.basho).toMatchObject({
      status: "active",
      currentDay: 0,
    });
    expect(started.appliedResults).toBe(0);
    expect(
      (await repositories.listFantasyTeamsForBasho(demoBasho.id)).every(
        (team) => team.lockedAt === "2026-05-10T00:00:00.000Z",
      ),
    ).toBe(true);

    const dayOne = await advanceDemoBashoDay(repositories, now);

    expect(dayOne.basho).toMatchObject({
      status: "active",
      currentDay: 1,
    });
    expect(
      (await repositories.listBoutResultsForBasho(demoBasho.id)).map(
        (result) => result.day,
      ),
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

    const dayTwo = await advanceDemoBashoDay(repositories, now);

    expect(dayTwo.basho.currentDay).toBe(2);
    expect(dayTwo.appliedResults).toBe(8);
    expect(
      (await repositories.listBoutResultsForBasho(demoBasho.id)).map(
        (result) => result.day,
      ),
    ).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
  });

  it("can complete demo progression through the final day", async () => {
    await seedDemoDatabase(createRepositories(client));
    const repositories = createRepositories(client);

    const completed = await completeDemoBasho(
      repositories,
      () => new Date("2026-05-10T00:00:00.000Z"),
    );

    expect(completed.basho).toMatchObject({
      status: "complete",
      currentDay: DEMO_FINAL_DAY,
    });
    expect(completed.appliedResults).toBe(demoBoutResults.length);
    expect(
      (await repositories.listBoutResultsForBasho(demoBasho.id)).at(-1),
    ).toMatchObject({
      day: DEMO_FINAL_DAY,
    });
    expect(completed.leaderboard[0]).toMatchObject({
      displayName: "Yusho Hunters",
      score: 22,
    });
  });
});
