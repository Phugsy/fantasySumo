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

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "fantasy-sumo-import-"));
  client = createDatabaseClient(`file:${join(tmpRoot, "test.sqlite")}`);
  runMigrations(client.db);
});

afterEach(() => {
  client.close();
  rmSync(tmpRoot, { force: true, recursive: true });
});

describe("import service", () => {
  it("dry-runs banzuke imports without writing rows", () => {
    const repositories = createRepositories(client.db);
    const result = importBanzuke(repositories, banzukeCommand, {
      dryRun: true,
    });

    expect(result.summary.basho.created).toBe(1);
    expect(result.summary.rikishi.created).toBe(2);
    expect(result.summary.banzuke.created).toBe(2);
    expect(repositories.listBashos()).toEqual([]);
  });

  it("applies banzuke imports transactionally and idempotently", () => {
    const repositories = createRepositories(client.db);

    expect(importBanzuke(repositories, banzukeCommand).summary).toMatchObject({
      basho: { created: 1 },
      rikishi: { created: 2 },
      banzuke: { created: 2 },
    });
    expect(importBanzuke(repositories, banzukeCommand).summary).toMatchObject({
      basho: { skipped: 1 },
      rikishi: { skipped: 2 },
      banzuke: { skipped: 2 },
    });
  });

  it("removes stale banzuke entries without deleting rikishi", () => {
    const repositories = createRepositories(client.db);
    importBanzuke(repositories, banzukeCommand);

    const result = importBanzuke(repositories, {
      ...banzukeCommand,
      rikishi: [banzukeCommand.rikishi[0]!],
      banzukeEntries: [banzukeCommand.banzukeEntries[0]!],
    });

    expect(result.summary.banzuke.deleted).toBe(1);
    expect(repositories.listRikishi()).toHaveLength(2);
    expect(repositories.listBanzukeEntriesForBasho("2026-05")).toEqual([
      banzukeCommand.banzukeEntries[0],
    ]);
  });

  it("imports bout results after banzuke data exists", () => {
    const repositories = createRepositories(client.db);
    importBanzuke(repositories, banzukeCommand);

    const result = importBoutResults(repositories, {
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
    expect(repositories.listBoutResultsForBasho("2026-05")).toHaveLength(1);
  });

  it("replaces stale results for the imported day only", () => {
    const repositories = createRepositories(client.db);
    importBanzuke(repositories, banzukeCommand);
    importBoutResults(repositories, {
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
    importBoutResults(repositories, {
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

    const result = importBoutResults(repositories, {
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
      repositories
        .listBoutResultsForBasho("2026-05")
        .map((entry) => entry.id)
        .sort(),
    ).toEqual(["2026-05-day-1-match-1", "2026-05-day-2-match-1"]);
  });

  it("rejects invalid result imports before writing", () => {
    const repositories = createRepositories(client.db);
    importBanzuke(repositories, banzukeCommand);

    expect(() =>
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
    ).toThrow(ImportValidationError);
    expect(repositories.listBoutResultsForBasho("2026-05")).toEqual([]);
  });
});
