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
  importScheduledBoutsAndBoutResults,
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

  it("preserves a known banzuke heya when a reimport omits it", async () => {
    const repositories = createRepositories(client);
    const withIdentitySnapshots: BanzukeImportCommand = {
      ...banzukeCommand,
      banzukeEntries: banzukeCommand.banzukeEntries.map((entry, index) => ({
        ...entry,
        shikona: banzukeCommand.rikishi[index]!.shikona,
        heya: banzukeCommand.rikishi[index]!.heya,
      })),
    };
    await importBanzuke(repositories, withIdentitySnapshots);
    const withoutHeya: BanzukeImportCommand = {
      ...withIdentitySnapshots,
      rikishi: withIdentitySnapshots.rikishi.map(({ id, shikona }) => ({
        id,
        shikona,
      })),
      banzukeEntries: withIdentitySnapshots.banzukeEntries.map(
        ({ id, bashoId, rikishiId, shikona, rank, rankOrder }) => ({
          id,
          bashoId,
          rikishiId,
          ...(shikona === undefined ? {} : { shikona }),
          rank,
          rankOrder,
        }),
      ),
    };

    const result = await importBanzuke(repositories, withoutHeya);
    const repeatedDryRun = await importBanzuke(repositories, withoutHeya, {
      dryRun: true,
    });

    expect(result.summary.banzuke).toMatchObject({ skipped: 2, updated: 0 });
    expect(repeatedDryRun.summary.banzuke).toMatchObject({
      skipped: 2,
      updated: 0,
    });
    expect(await repositories.listBanzukeEntriesForBasho("2026-05")).toEqual(
      withIdentitySnapshots.banzukeEntries,
    );
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
      await repositories.applyScheduledBoutsImport({
        publication: {
          id: `2026-05-day-${day}-prior-schedule`,
          bashoId: "2026-05",
          day,
          source: "test-schedule:complete",
          publishedAt: "2026-05-23T09:00:00.000Z",
        },
        bouts: [
          {
            id: `2026-05-day-${day}-prior-bout`,
            bashoId: "2026-05",
            day,
            eastRikishiId: "onosato",
            westRikishiId: "kotozakura",
            status: "scheduled",
          },
        ],
      });
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
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          day: 15,
          source: "test-schedule:complete",
        }),
      ]),
    );

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

  it("does not complete when a confirmed earlier card has a missing result", async () => {
    const repositories = createRepositories(client);
    await importBanzuke(repositories, {
      ...banzukeCommand,
      basho: {
        ...banzukeCommand.basho,
        currentDay: 14,
        status: "active",
      },
    });
    await repositories.upsertRikishi({
      id: "juryo-east",
      shikona: "Juryo East",
    });
    await repositories.upsertRikishi({
      id: "juryo-west",
      shikona: "Juryo West",
    });

    for (let day = 1; day <= 15; day += 1) {
      await repositories.applyScheduledBoutsImport({
        publication: {
          id: `2026-05-day-${day}-coverage-schedule`,
          bashoId: "2026-05",
          day,
          source: "test-schedule:complete",
          publishedAt: "2026-05-24T09:00:00.000Z",
        },
        bouts: [
          {
            id: `2026-05-day-${day}-coverage-bout`,
            bashoId: "2026-05",
            day,
            eastRikishiId: "onosato",
            westRikishiId: "kotozakura",
            status: "scheduled",
          },
          ...(day === 7
            ? [
                {
                  id: "2026-05-day-7-missing-bout",
                  bashoId: "2026-05",
                  day: 7,
                  eastRikishiId: "juryo-east",
                  westRikishiId: "juryo-west",
                  status: "scheduled" as const,
                },
              ]
            : []),
        ],
      });
      await repositories.insertBoutResult({
        id: `2026-05-day-${day}-coverage-result`,
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
          id: "2026-05-day-15-coverage-result",
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

  it("rejects an unattested partial card before importing results", async () => {
    const repositories = createRepositories(client);
    await importBanzuke(repositories, banzukeCommand);

    await expect(
      importScheduledBoutsAndBoutResults(
        repositories,
        {
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
        },
        {
          source: "test-results",
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
        },
      ),
    ).rejects.toMatchObject({
      issues: [expect.objectContaining({ path: "schedule.isComplete" })],
    });
    expect(await repositories.listBoutResultsForBasho("2026-05")).toEqual([]);
  });

  it("preserves a confirmed card across a weaker schedule retry", async () => {
    const repositories = createRepositories(client);
    await importBanzuke(repositories, banzukeCommand);
    await importScheduledBouts(repositories, {
      source: "test-schedule",
      bashoId: "2026-05",
      day: 4,
      isComplete: true,
      bouts: [
        {
          id: "2026-05-day-4-confirmed-match",
          bashoId: "2026-05",
          day: 4,
          eastRikishiId: "onosato",
          westRikishiId: "kotozakura",
          status: "scheduled",
        },
      ],
    });

    const retry = await importScheduledBouts(repositories, {
      source: "test-schedule",
      bashoId: "2026-05",
      day: 4,
      isComplete: false,
      bouts: [],
    });

    expect(retry.summary.scheduledBouts).toMatchObject({ skipped: 1 });
    expect(
      await repositories.listScheduledBoutPublicationsForBasho("2026-05"),
    ).toEqual([expect.objectContaining({ source: "test-schedule:complete" })]);
    expect(await repositories.listScheduledBoutsForBasho("2026-05")).toEqual([
      expect.objectContaining({ id: "2026-05-day-4-confirmed-match" }),
    ]);
  });

  it("keeps a concurrent complete-card retry consistent", async () => {
    const repositories = createRepositories(client);
    const additionalRikishi = [
      { id: "hoshoryu", shikona: "Hoshoryu" },
      { id: "kirishima", shikona: "Kirishima" },
    ];
    await importBanzuke(repositories, {
      ...banzukeCommand,
      rikishi: [...banzukeCommand.rikishi, ...additionalRikishi],
      banzukeEntries: [
        ...banzukeCommand.banzukeEntries,
        ...additionalRikishi.map((rikishi, index) => ({
          id: `2026-05-${rikishi.id}`,
          bashoId: "2026-05",
          rikishiId: rikishi.id,
          rank: "Maegashira",
          rankOrder: index + 3,
        })),
      ],
    });
    const completeSchedule: ScheduledBoutsImportCommand = {
      source: "test-schedule",
      bashoId: "2026-05",
      day: 4,
      isComplete: true,
      bouts: [
        {
          id: "2026-05-day-4-match-1",
          bashoId: "2026-05",
          day: 4,
          eastRikishiId: "onosato",
          westRikishiId: "kotozakura",
          status: "scheduled",
        },
        {
          id: "2026-05-day-4-match-2",
          bashoId: "2026-05",
          day: 4,
          eastRikishiId: "hoshoryu",
          westRikishiId: "kirishima",
          status: "scheduled",
        },
      ],
    };
    const completeResults = {
      source: "test-results",
      bashoId: "2026-05",
      results: [
        {
          id: "2026-05-day-4-match-1",
          bashoId: "2026-05",
          day: 4,
          winnerRikishiId: "onosato",
          loserRikishiId: "kotozakura",
        },
        {
          id: "2026-05-day-4-match-2",
          bashoId: "2026-05",
          day: 4,
          winnerRikishiId: "hoshoryu",
          loserRikishiId: "kirishima",
        },
      ],
    };

    const racingRepositories = {
      ...repositories,
      applyScheduledBoutsAndBoutResultsImport: async (
        importData: Parameters<
          typeof repositories.applyScheduledBoutsAndBoutResultsImport
        >[0],
      ) => {
        await repositories.applyScheduledBoutsAndBoutResultsImport({
          scheduledBouts: {
            publication: {
              id: "2026-05-day-4-concurrent-schedule",
              bashoId: "2026-05",
              day: 4,
              source: "test-schedule:complete",
              publishedAt: "2026-05-13T09:00:00.000Z",
            },
            bouts: completeSchedule.bouts,
          },
          boutResults: {
            bashoId: "2026-05",
            day: 4,
            results: completeResults.results,
          },
        });

        return repositories.applyScheduledBoutsAndBoutResultsImport(importData);
      },
    };
    const retry = await importScheduledBoutsAndBoutResults(
      racingRepositories,
      completeSchedule,
      completeResults,
    );

    expect(retry.summary.scheduledBouts).toMatchObject({ created: 2 });
    expect(retry.summary.results).toMatchObject({ created: 2 });
    expect(
      await repositories.listScheduledBoutsForBasho("2026-05"),
    ).toHaveLength(2);
    expect(await repositories.listBoutResultsForBasho("2026-05")).toHaveLength(
      2,
    );
  });

  it("rejects schedule and result snapshots with different matchups", async () => {
    const repositories = createRepositories(client);
    await importBanzuke(repositories, banzukeCommand);

    await expect(
      importScheduledBoutsAndBoutResults(
        repositories,
        {
          source: "test-schedule",
          bashoId: "2026-05",
          day: 4,
          isComplete: true,
          bouts: [
            {
              id: "schedule-match",
              bashoId: "2026-05",
              day: 4,
              eastRikishiId: "onosato",
              westRikishiId: "kotozakura",
              status: "scheduled",
            },
          ],
        },
        {
          source: "test-results",
          bashoId: "2026-05",
          rikishi: [{ id: "juryo-east", shikona: "Juryo East" }],
          results: [
            {
              id: "different-match",
              bashoId: "2026-05",
              day: 4,
              winnerRikishiId: "onosato",
              loserRikishiId: "juryo-east",
            },
          ],
        },
      ),
    ).rejects.toMatchObject({
      issues: [
        {
          path: "schedule.bouts",
          message:
            "Schedule and result imports must describe the same set of matchups.",
        },
      ],
    });
    expect(await repositories.listScheduledBoutsForBasho("2026-05")).toEqual(
      [],
    );
    expect(await repositories.listBoutResultsForBasho("2026-05")).toEqual([]);
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
