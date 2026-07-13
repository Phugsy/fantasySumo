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
import type { BanzukeImportCommand } from "./types.js";
import {
  importBanzuke,
  importBoutResults,
  ImportValidationError,
} from "./service.js";

let client: DatabaseClient;
let tmpRoot: string;

const banzukeCommand: BanzukeImportCommand = {
  source: "test",
  basho: {
    id: "2026-05",
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
});
