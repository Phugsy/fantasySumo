import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDatabaseClient,
  createRepositories,
  runMigrations,
  type DatabaseClient,
} from "@fantasy-sumo/db";
import { calculateTeamScore } from "@fantasy-sumo/domain";
import type {
  BanzukeImportCommand,
  ScheduledBoutsImportCommand,
} from "./types.js";
import {
  importBanzuke,
  importBoutResults,
  importScheduledBouts,
  ImportValidationError,
} from "./service.js";

let client: DatabaseClient;
let tmpRoot: string;

const banzukeCommand: BanzukeImportCommand = {
  source: "test",
  basho: {
    id: "2026-05",
    isDemo: false,
    name: "May 2026",
    startDate: "2026-05-10",
    endDate: "2026-05-24",
    status: "active",
  },
  rikishi: [
    {
      id: "onosato",
      shikona: "Onosato",
      heya: "Nishonoseki",
    },
    {
      id: "kotozakura",
      shikona: "Kotozakura",
      heya: "Sadogatake",
    },
  ],
  banzukeEntries: [
    {
      id: "2026-05-onosato",
      bashoId: "2026-05",
      rikishiId: "onosato",
      rank: "Ozeki",
      rankOrder: 1,
    },
    {
      id: "2026-05-kotozakura",
      bashoId: "2026-05",
      rikishiId: "kotozakura",
      rank: "Ozeki",
      rankOrder: 2,
    },
  ],
};

beforeEach(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), "fantasy-sumo-import-"));
  client = createDatabaseClient(`file:${join(tmpRoot, "test.sqlite")}`);
  await runMigrations(client);
});

afterEach(async () => {
  await client.close();
  rmSync(tmpRoot, { force: true, recursive: true });
});

describe("import service", () => {
  it("dry-runs banzuke imports without writing rows", async () => {
    const repositories = createRepositories(client);
    const result = await importBanzuke(repositories, banzukeCommand, {
      dryRun: true,
    });

    expect(result.summary.basho.created).toBe(1);
    expect(result.summary.rikishi.created).toBe(2);
    expect(result.summary.banzuke.created).toBe(2);
    expect(await repositories.listBashos()).toEqual([]);
  });

  it("applies banzuke imports transactionally and idempotently", async () => {
    const repositories = createRepositories(client);

    expect(
      (await importBanzuke(repositories, banzukeCommand)).summary,
    ).toMatchObject({
      basho: { created: 1 },
      rikishi: { created: 2 },
      banzuke: { created: 2 },
    });
    expect(
      (await importBanzuke(repositories, banzukeCommand)).summary,
    ).toMatchObject({
      basho: { skipped: 1 },
      rikishi: { skipped: 2 },
      banzuke: { skipped: 2 },
    });
  });

  it("counts basho current-day changes in banzuke import summaries", async () => {
    const repositories = createRepositories(client);
    await importBanzuke(repositories, {
      ...banzukeCommand,
      basho: {
        ...banzukeCommand.basho,
        currentDay: 3,
      },
    });
    const result = await importBanzuke(
      repositories,
      {
        ...banzukeCommand,
        basho: {
          ...banzukeCommand.basho,
          currentDay: 4,
        },
      },
      {
        dryRun: true,
      },
    );

    expect(result.summary.basho.updated).toBe(1);
  });

  it("does not reopen a locked basho during a banzuke reimport", async () => {
    const repositories = createRepositories(client);
    await importBanzuke(repositories, {
      ...banzukeCommand,
      basho: {
        ...banzukeCommand.basho,
        status: "locked",
        currentDay: 0,
      },
    });

    await importBanzuke(repositories, {
      ...banzukeCommand,
      basho: {
        ...banzukeCommand.basho,
        status: "upcoming",
      },
    });

    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "locked",
      currentDay: 0,
    });
  });

  it("removes stale banzuke entries without deleting rikishi", async () => {
    const repositories = createRepositories(client);
    await importBanzuke(repositories, banzukeCommand);

    const result = await importBanzuke(repositories, {
      ...banzukeCommand,
      rikishi: [banzukeCommand.rikishi[0]!],
      banzukeEntries: [banzukeCommand.banzukeEntries[0]!],
    });

    expect(result.summary.banzuke.deleted).toBe(1);
    expect(await repositories.listRikishi()).toHaveLength(2);
    expect(await repositories.listBanzukeEntriesForBasho("2026-05")).toEqual([
      banzukeCommand.banzukeEntries[0],
    ]);
  });

  it("imports bout results after banzuke data exists", async () => {
    const repositories = createRepositories(client);
    await importBanzuke(repositories, {
      ...banzukeCommand,
      basho: {
        ...banzukeCommand.basho,
        status: "upcoming",
        currentDay: 0,
      },
    });

    const result = await importBoutResults(repositories, {
      source: "test",
      bashoId: "2026-05",
      results: [
        {
          id: "2026-05-day-1-match-1",
          bashoId: "2026-05",
          day: 1,
          winnerRikishiId: "onosato",
          loserRikishiId: "kotozakura",
          kimarite: "oshidashi",
        },
      ],
    });

    expect(result.summary.results.created).toBe(1);
    expect(await repositories.listBoutResultsForBasho("2026-05")).toHaveLength(
      1,
    );
    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "active",
      currentDay: 1,
    });
  });

  it("completes day 15 only after results cover a confirmed complete card", async () => {
    const repositories = createRepositories(client);
    const crossDivisionRikishi = [
      { id: "juryo-east", shikona: "Juryo East" },
      { id: "juryo-west", shikona: "Juryo West" },
    ];
    const finalResults = [
      {
        id: "2026-05-day-15-match-1",
        bashoId: "2026-05",
        day: 15,
        winnerRikishiId: "onosato",
        loserRikishiId: "juryo-east",
      },
      {
        id: "2026-05-day-15-match-2",
        bashoId: "2026-05",
        day: 15,
        winnerRikishiId: "kotozakura",
        loserRikishiId: "juryo-west",
      },
    ];
    const finalSchedule: ScheduledBoutsImportCommand = {
      source: "test-schedule",
      bashoId: "2026-05",
      day: 15,
      isComplete: true,
      rikishi: crossDivisionRikishi,
      bouts: [
        {
          id: "2026-05-day-15-match-1",
          bashoId: "2026-05",
          day: 15,
          eastRikishiId: "onosato",
          westRikishiId: "juryo-east",
          status: "scheduled",
        },
        {
          id: "2026-05-day-15-match-2",
          bashoId: "2026-05",
          day: 15,
          eastRikishiId: "kotozakura",
          westRikishiId: "juryo-west",
          status: "scheduled",
        },
      ],
    };

    await importBanzuke(repositories, {
      ...banzukeCommand,
      basho: {
        ...banzukeCommand.basho,
        currentDay: 14,
        status: "active",
      },
    });
    for (let day = 1; day <= 14; day += 1) {
      await repositories.insertBoutResult({
        id: `2026-05-day-${day}-prior-result`,
        bashoId: "2026-05",
        day,
        winnerRikishiId: "onosato",
        loserRikishiId: "kotozakura",
      });
    }

    await importBoutResults(repositories, {
      source: "test",
      bashoId: "2026-05",
      results: [
        {
          id: "2026-05-day-15-unverified-match",
          bashoId: "2026-05",
          day: 15,
          winnerRikishiId: "onosato",
          loserRikishiId: "kotozakura",
        },
      ],
    });

    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "active",
      currentDay: 14,
    });

    await importScheduledBouts(repositories, finalSchedule);
    expect(
      await repositories.listScheduledBoutPublicationsForBasho("2026-05"),
    ).toEqual([expect.objectContaining({ source: "test-schedule:complete" })]);

    await importBoutResults(
      repositories,
      {
        source: "test",
        bashoId: "2026-05",
        rikishi: crossDivisionRikishi,
        results: finalResults,
      },
      { completionSchedule: { ...finalSchedule, isComplete: false } },
    );

    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "active",
      currentDay: 14,
    });

    await importBoutResults(
      repositories,
      {
        source: "test",
        bashoId: "2026-05",
        rikishi: crossDivisionRikishi,
        results: [finalResults[0]!],
      },
      { completionSchedule: finalSchedule },
    );

    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "active",
      currentDay: 14,
    });

    await importBoutResults(
      repositories,
      {
        source: "test",
        bashoId: "2026-05",
        rikishi: crossDivisionRikishi,
        results: finalResults,
      },
      { completionSchedule: finalSchedule },
    );

    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "complete",
      currentDay: 15,
    });
  });

  it("does not jump from day 3 to complete when earlier result days are missing", async () => {
    const repositories = createRepositories(client);
    await importBanzuke(repositories, {
      ...banzukeCommand,
      basho: {
        ...banzukeCommand.basho,
        currentDay: 3,
        status: "active",
      },
    });
    const finalSchedule: ScheduledBoutsImportCommand = {
      source: "test-schedule",
      bashoId: "2026-05",
      day: 15,
      isComplete: true,
      bouts: [
        {
          id: "2026-05-day-15-match-1",
          bashoId: "2026-05",
          day: 15,
          eastRikishiId: "onosato",
          westRikishiId: "kotozakura",
          status: "scheduled",
        },
      ],
    };

    await importBoutResults(
      repositories,
      {
        source: "test",
        bashoId: "2026-05",
        results: [
          {
            id: "2026-05-day-15-match-1",
            bashoId: "2026-05",
            day: 15,
            winnerRikishiId: "onosato",
            loserRikishiId: "kotozakura",
          },
        ],
      },
      { completionSchedule: finalSchedule },
    );

    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "active",
      currentDay: 3,
    });
  });

  it("imports source-provided cross-division opponents without adding them to the banzuke", async () => {
    const repositories = createRepositories(client);
    await importBanzuke(repositories, banzukeCommand);

    const result = await importBoutResults(repositories, {
      source: "test",
      bashoId: "2026-05",
      rikishi: [
        {
          id: "onosato",
          shikona: "Onosato",
        },
        {
          id: "juryo-visitor",
          shikona: "Juryo Visitor",
        },
      ],
      results: [
        {
          id: "2026-05-day-1-match-1",
          bashoId: "2026-05",
          day: 1,
          winnerRikishiId: "onosato",
          loserRikishiId: "juryo-visitor",
        },
      ],
    });

    expect(result.summary.rikishi.created).toBe(1);
    expect(await repositories.listBoutResultsForBasho("2026-05")).toHaveLength(
      1,
    );
    expect(
      await repositories.listBanzukeEntriesForBasho("2026-05"),
    ).toHaveLength(2);
    expect(
      (await repositories.listRikishi()).find(
        (rikishi) => rikishi.id === "onosato",
      ),
    ).toMatchObject({
      id: "onosato",
      shikona: "Onosato",
      heya: "Nishonoseki",
    });
  });

  it("rejects source-provided results with no target banzuke rikishi", async () => {
    const repositories = createRepositories(client);
    await importBanzuke(repositories, banzukeCommand);

    await expect(
      importBoutResults(repositories, {
        source: "test",
        bashoId: "2026-05",
        rikishi: [
          {
            id: "juryo-winner",
            shikona: "Juryo Winner",
          },
          {
            id: "juryo-loser",
            shikona: "Juryo Loser",
          },
        ],
        results: [
          {
            id: "2026-05-day-1-match-1",
            bashoId: "2026-05",
            day: 1,
            winnerRikishiId: "juryo-winner",
            loserRikishiId: "juryo-loser",
          },
        ],
      }),
    ).rejects.toThrow(ImportValidationError);
    expect(await repositories.listBoutResultsForBasho("2026-05")).toEqual([]);
  });

  it("reports basho lifecycle updates during result import dry runs", async () => {
    const repositories = createRepositories(client);
    await importBanzuke(repositories, {
      ...banzukeCommand,
      basho: {
        ...banzukeCommand.basho,
        status: "locked",
        currentDay: 1,
      },
    });

    const result = await importBoutResults(
      repositories,
      {
        source: "test",
        bashoId: "2026-05",
        results: [
          {
            id: "2026-05-day-2-match-1",
            bashoId: "2026-05",
            day: 2,
            winnerRikishiId: "onosato",
            loserRikishiId: "kotozakura",
          },
        ],
      },
      {
        dryRun: true,
      },
    );

    expect(result.summary.basho.updated).toBe(1);
    expect(await repositories.getBasho("2026-05")).toMatchObject({
      status: "locked",
      currentDay: 1,
    });
  });

  it("replaces stale results for the imported day only", async () => {
    const repositories = createRepositories(client);
    await importBanzuke(repositories, banzukeCommand);
    await importBoutResults(repositories, {
      source: "test",
      bashoId: "2026-05",
      results: [
        {
          id: "2026-05-day-1-match-1",
          bashoId: "2026-05",
          day: 1,
          winnerRikishiId: "onosato",
          loserRikishiId: "kotozakura",
        },
        {
          id: "2026-05-day-1-match-2",
          bashoId: "2026-05",
          day: 1,
          winnerRikishiId: "kotozakura",
          loserRikishiId: "onosato",
        },
      ],
    });
    await importBoutResults(repositories, {
      source: "test",
      bashoId: "2026-05",
      results: [
        {
          id: "2026-05-day-2-match-1",
          bashoId: "2026-05",
          day: 2,
          winnerRikishiId: "onosato",
          loserRikishiId: "kotozakura",
        },
      ],
    });

    const result = await importBoutResults(repositories, {
      source: "test",
      bashoId: "2026-05",
      results: [
        {
          id: "2026-05-day-1-match-1",
          bashoId: "2026-05",
          day: 1,
          winnerRikishiId: "onosato",
          loserRikishiId: "kotozakura",
        },
      ],
    });

    expect(result.summary.results.deleted).toBe(1);
    expect(
      (await repositories.listBoutResultsForBasho("2026-05"))
        .map((entry) => entry.id)
        .sort(),
    ).toEqual(["2026-05-day-1-match-1", "2026-05-day-2-match-1"]);
  });

  it("rejects invalid result imports before writing", async () => {
    const repositories = createRepositories(client);
    await importBanzuke(repositories, banzukeCommand);

    await expect(
      importBoutResults(repositories, {
        source: "test",
        bashoId: "2026-05",
        results: [
          {
            id: "bad",
            bashoId: "2026-05",
            day: 16,
            winnerRikishiId: "onosato",
            loserRikishiId: "unknown",
          },
        ],
      }),
    ).rejects.toThrow(ImportValidationError);
    expect(await repositories.listBoutResultsForBasho("2026-05")).toEqual([]);
  });

  it("imports and safely amends a published schedule without affecting scores", async () => {
    const repositories = createRepositories(client);
    await importBanzuke(repositories, banzukeCommand);

    await importScheduledBouts(repositories, {
      source: "test-schedule",
      bashoId: "2026-05",
      day: 1,
      bouts: [
        {
          id: "2026-05-day-1-match-1",
          bashoId: "2026-05",
          day: 1,
          eastRikishiId: "onosato",
          westRikishiId: "kotozakura",
          status: "scheduled",
        },
      ],
    });

    const amended = await importScheduledBouts(repositories, {
      source: "test-schedule",
      bashoId: "2026-05",
      day: 1,
      bouts: [
        {
          id: "2026-05-day-1-match-1",
          bashoId: "2026-05",
          day: 1,
          eastRikishiId: "onosato",
          westRikishiId: "kotozakura",
          status: "cancelled",
          withdrawnRikishiId: "kotozakura",
        },
      ],
    });

    expect(amended.summary.scheduledBouts.updated).toBe(1);
    expect(await repositories.listScheduledBoutsForBasho("2026-05")).toEqual([
      expect.objectContaining({
        id: "2026-05-day-1-match-1",
        status: "cancelled",
        withdrawnRikishiId: "kotozakura",
      }),
    ]);
    expect(
      calculateTeamScore(
        {
          id: "stable",
          bashoId: "2026-05",
          displayName: "Stable",
        },
        [{ teamId: "stable", rikishiId: "onosato" }],
        await repositories.listBoutResultsForBasho("2026-05"),
      ).score,
    ).toBe(0);
  });

  it("records an empty published day and removes stale scheduled bouts", async () => {
    const repositories = createRepositories(client);
    await importBanzuke(repositories, banzukeCommand);
    await importScheduledBouts(repositories, {
      source: "test-schedule",
      bashoId: "2026-05",
      day: 2,
      bouts: [
        {
          id: "2026-05-day-2-match-1",
          bashoId: "2026-05",
          day: 2,
          eastRikishiId: "onosato",
          westRikishiId: "kotozakura",
          status: "scheduled",
        },
      ],
    });

    const replacement = await importScheduledBouts(repositories, {
      source: "test-schedule",
      bashoId: "2026-05",
      day: 2,
      bouts: [],
    });

    expect(replacement.summary.scheduledBouts.deleted).toBe(1);
    expect(await repositories.listScheduledBoutsForBasho("2026-05")).toEqual(
      [],
    );
    expect(
      await repositories.listScheduledBoutPublicationsForBasho("2026-05"),
    ).toEqual([
      expect.objectContaining({
        bashoId: "2026-05",
        day: 2,
        source: "test-schedule",
      }),
    ]);
  });

  it("rejects duplicate rikishi and invalid withdrawal markers", async () => {
    const repositories = createRepositories(client);
    await importBanzuke(repositories, banzukeCommand);

    await expect(
      importScheduledBouts(repositories, {
        source: "test-schedule",
        bashoId: "2026-05",
        day: 1,
        bouts: [
          {
            id: "match-1",
            bashoId: "2026-05",
            day: 1,
            eastRikishiId: "onosato",
            westRikishiId: "kotozakura",
            status: "cancelled",
            withdrawnRikishiId: "unknown",
          },
          {
            id: "match-2",
            bashoId: "2026-05",
            day: 1,
            eastRikishiId: "kotozakura",
            westRikishiId: "onosato",
            status: "scheduled",
          },
        ],
      }),
    ).rejects.toThrow(ImportValidationError);
    expect(await repositories.listScheduledBoutsForBasho("2026-05")).toEqual(
      [],
    );
  });
});
