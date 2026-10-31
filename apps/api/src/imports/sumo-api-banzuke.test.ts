import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createDatabaseClient,
  createRepositories,
  runMigrations,
} from "@fantasy-sumo/db";
import {
  fetchSumoApiBanzukeImport,
  mapSumoApiBanzukePayload,
} from "./sumo-api-banzuke.js";
import { importBanzuke } from "./service.js";

// Reduced synthetic fixture matching the provider contract checked 2026-10-31.
const basho = {
  date: "202605",
  startDate: "2026-05-10T00:00:00Z",
  endDate: "2026-05-24T00:00:00Z",
};
const snapshot = {
  bashoId: "202605",
  division: "Makuuchi",
  east: [
    {
      rikishiID: 2,
      shikonaEn: "Onosato",
      rank: "Yokozuna 1 East",
      rankValue: 101,
      side: "East",
    },
    {
      rikishiID: 3,
      shikonaEn: "East Maegashira",
      rank: "Maegashira 1 East",
      rankValue: 501,
      side: "East",
    },
  ],
  west: [
    {
      rikishiID: 4,
      shikonaEn: "Kotozakura",
      rank: "Ozeki 1 West",
      rankValue: 201,
      side: "West",
    },
    {
      rikishiID: 1,
      shikonaEn: "Hoshoryu",
      rank: "Yokozuna 1 West",
      rankValue: 101,
      side: "West",
    },
  ],
};
const options = { bashoId: "2026-05", now: new Date("2026-05-01T12:00:00Z") };
const map = (tournament: unknown = basho, roster: unknown = snapshot) =>
  mapSumoApiBanzukePayload(tournament, roster, options);

describe("Sumo API banzuke backup", () => {
  it("orders rank bands and east/west ties independently of provider array order", () => {
    const command = map();
    expect(command.source).toBe("sumo-api-banzuke");
    expect(command.basho).toEqual({
      id: "2026-05",
      isDemo: false,
      name: "2026 May Grand Sumo Tournament",
      startDate: "2026-05-10",
      endDate: "2026-05-24",
      status: "upcoming",
      currentDay: 0,
    });
    expect(
      command.banzukeEntries.map(({ rikishiId, rankOrder }) => [
        rikishiId,
        rankOrder,
      ]),
    ).toEqual([
      ["sumo-api:2", 1],
      ["sumo-api:1", 2],
      ["sumo-api:4", 3],
      ["sumo-api:3", 4],
    ]);
    expect(command.rikishi[0]).toEqual({
      id: "sumo-api:2",
      shikona: "Onosato",
      sourceIdentity: { source: "sumo-api", sourceRikishiId: "2" },
    });
    expect(command).not.toHaveProperty("results");
  });

  it("uses the existing 20:00 JST lock boundary and never infers scored days or completion", () => {
    for (const [time, status] of [
      ["2026-05-08T10:59:59Z", "upcoming"],
      ["2026-05-08T11:00:00Z", "locked"],
      ["2026-06-01T00:00:00Z", "locked"],
    ]) {
      expect(
        mapSumoApiBanzukePayload(basho, snapshot, {
          ...options,
          now: new Date(time!),
        }).basho,
      ).toMatchObject({ status, currentDay: 0 });
    }
  });

  it("rejects wrong tournament/division, empty sides, and malformed rows", () => {
    for (const invalid of [
      { ...snapshot, bashoId: "202607" },
      { ...snapshot, division: "Juryo" },
      { ...snapshot, east: [] },
      { ...snapshot, west: undefined },
      { ...snapshot, east: [null] },
      { ...snapshot, east: [{ ...snapshot.east[0], shikonaEn: " " }] },
      { ...snapshot, east: [{ ...snapshot.east[0], side: "West" }] },
      { ...snapshot, east: [{ ...snapshot.east[0], rank: "Juryo 1 East" }] },
      { ...snapshot, east: [{ ...snapshot.east[0], rankValue: 201 }] },
    ])
      expect(() => map(basho, invalid)).toThrow();
    expect(() => map({ ...basho, date: "202607" })).toThrow(
      /requested tournament/,
    );
  });

  it("rejects invalid dates, wrong start month, and an inverted calendar", () => {
    for (const invalid of [
      { ...basho, startDate: "2026-05-32T00:00:00Z" },
      { ...basho, startDate: "2026-04-30T00:00:00Z" },
      { ...basho, endDate: "2026-05-01T00:00:00Z" },
      { ...basho, endDate: "2026-05-24T12:00:00Z" },
    ])
      expect(() => map(invalid)).toThrow();
  });

  it("rejects duplicated provider IDs, normalized names, and rank slots", () => {
    for (const row of [
      { ...snapshot.east[1], rikishiID: 2 },
      { ...snapshot.east[1], shikonaEn: "Onosato" },
      { ...snapshot.east[1], shikonaEn: "Ｏｎｏｓａｔｏ" },
      { ...snapshot.east[1], rank: "Yokozuna 1 East", rankValue: 101 },
    ])
      expect(() =>
        map(basho, { ...snapshot, east: [snapshot.east[0], row] }),
      ).toThrow(/duplicate or ambiguous/);
  });

  it("fetches only the explicitly requested basho and rejects a failed source", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url) =>
        Response.json(String(url).endsWith("/Makuuchi") ? snapshot : basho),
      );
    expect((await fetchSumoApiBanzukeImport(fetchFn, options)).basho.id).toBe(
      "2026-05",
    );
    expect(fetchFn.mock.calls.map(([url]) => url)).toEqual([
      "https://sumo-api.com/api/basho/202605",
      "https://sumo-api.com/api/basho/202605/banzuke/Makuuchi",
    ]);
    await expect(
      fetchSumoApiBanzukeImport(
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response("down", { status: 503 })),
        options,
      ),
    ).rejects.toThrow(/503/);
    fetchFn.mockClear();
    await expect(
      fetchSumoApiBanzukeImport(fetchFn, { bashoId: "../unexpected" }),
    ).rejects.toThrow();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("dry runs, preserves locked progress/heya, retries idempotently, and rejects invalid snapshots without writes", async () => {
    const directory = mkdtempSync(join(tmpdir(), "sumo-banzuke-backup-"));
    const client = createDatabaseClient(
      `file:${join(directory, "test.sqlite")}`,
    );
    try {
      await runMigrations(client);
      const repositories = createRepositories(client);
      const initial = map();
      initial.basho.status = "active";
      initial.basho.currentDay = 5;
      initial.rikishi[0]!.heya = "Known Heya";
      initial.banzukeEntries[0]!.heya = "Known Heya";
      await importBanzuke(repositories, initial);
      const existing = await repositories.listBanzukeEntriesForBasho(
        options.bashoId,
      );
      const modified = map();
      modified.banzukeEntries[0]!.rank = "Yokozuna 2 East";
      await importBanzuke(repositories, modified, { dryRun: true });
      expect(
        await repositories.listBanzukeEntriesForBasho(options.bashoId),
      ).toEqual(existing);
      await importBanzuke(repositories, map());
      const repeated = await importBanzuke(repositories, map());
      expect(repeated.summary.rikishi).toMatchObject({
        updated: 0,
        skipped: 4,
      });
      expect(repeated.summary.banzuke).toMatchObject({
        updated: 0,
        skipped: 4,
      });
      expect(await repositories.getBasho(options.bashoId)).toMatchObject({
        status: "active",
        currentDay: 5,
      });
      expect(
        (await repositories.listRikishi()).find(
          (row) => row.shikona === "Onosato",
        )?.heya,
      ).toBe("Known Heya");
      expect(
        (await repositories.listBanzukeEntriesForBasho(options.bashoId))[0]
          ?.heya,
      ).toBe("Known Heya");
      const before = await repositories.listBanzukeEntriesForBasho(
        options.bashoId,
      );
      await expect(
        Promise.resolve()
          .then(() => map(basho, { ...snapshot, east: [] }))
          .then((command) => importBanzuke(repositories, command)),
      ).rejects.toThrow();
      expect(
        await repositories.listBanzukeEntriesForBasho(options.bashoId),
      ).toEqual(before);
    } finally {
      await client.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("keeps the canonical identity and alias when a fallback source shikona changes", async () => {
    const client = createDatabaseClient(":memory:");
    try {
      await runMigrations(client);
      const repositories = createRepositories(client);
      await importBanzuke(repositories, map());
      const original = (await repositories.listRikishi()).find(
        (row) => row.shikona === "Onosato",
      )!;
      expect(original.id).toMatch(/^rk_/);
      const renamed = {
        ...snapshot,
        east: [
          { ...snapshot.east[0], shikonaEn: "Renamed Onosato" },
          snapshot.east[1],
        ],
      };
      await importBanzuke(repositories, map(basho, renamed));
      await importBanzuke(repositories, map(basho, renamed));
      expect(await repositories.listRikishi()).toHaveLength(4);
      expect(
        (await repositories.listRikishi()).find(
          (row) => row.id === original.id,
        ),
      ).toMatchObject({
        id: original.id,
        shikona: "Renamed Onosato",
      });
      expect(await repositories.listRikishiSourceIdentities()).toHaveLength(4);
      expect(await repositories.listRikishiSourceIdentities()).toContainEqual({
        source: "sumo-api",
        sourceRikishiId: "2",
        rikishiId: original.id,
      });
      expect(
        (await repositories.listBanzukeEntriesForBasho(options.bashoId))[0],
      ).toMatchObject({ rikishiId: original.id, shikona: "Renamed Onosato" });
    } finally {
      await client.close();
    }
  });
});
