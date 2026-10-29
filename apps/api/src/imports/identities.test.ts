import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDatabaseClient,
  createRepositories,
  runMigrations,
  seedDatabase,
  sampleBasho,
  type DatabaseClient,
  type Repositories,
} from "@fantasy-sumo/db";
import { buildApp } from "../app.js";
import {
  mapJsaBanzukePayload,
  mapSumoApiSchedulePayload,
  mapSumoApiTorikumiPayload,
} from "./adapters.js";
import {
  importBanzuke,
  importBoutResults,
  importScheduledBouts,
  importScheduledBoutsAndBoutResults,
} from "./service.js";
import { importSpecialPrizes } from "./special-prizes.js";

const postgresUrl = process.env.IDENTITY_TEST_POSTGRES_URL;
const providers = ["sqlite", ...(postgresUrl ? ["postgres"] : [])];

// PostgreSQL is opt-in and always creates a disposable database. Never reads DATABASE_URL.
for (const provider of providers) {
  describe(`canonical rikishi identities (${provider})`, () => {
    let client: DatabaseClient;
    let repositories: Repositories;
    let testDatabase: string;
    let admin: DatabaseClient | undefined;
    beforeEach(async () => {
      if (provider === "postgres") {
        admin = createDatabaseClient(postgresUrl);
        if (admin.provider !== "postgres")
          throw new Error("Expected a PostgreSQL test URL.");
        testDatabase = `identity_test_${randomUUID().replaceAll("-", "")}`;
        await admin.sql.unsafe(`CREATE DATABASE "${testDatabase}"`);
        const url = new URL(postgresUrl!);
        url.pathname = `/${testDatabase}`;
        client = createDatabaseClient(url.toString());
      } else {
        client = createDatabaseClient(":memory:");
      }
      await runMigrations(client);
      repositories = createRepositories(client);
    });
    afterEach(async () => {
      await client?.close();
      if (admin?.provider === "postgres") {
        await admin.sql.unsafe(`DROP DATABASE IF EXISTS "${testDatabase}"`);
        await admin.close();
      }
    });

    it("keeps one canonical identity over a rename and links distinct provider IDs", async () => {
      await importBanzuke(repositories, banzuke("2026-05", "Oldname"));
      const original = (await repositories.listRikishi()).find(
        (entry) => entry.shikona === "Oldname",
      )!;
      expect(original.id).toMatch(/^rk_/);
      await importBanzuke(repositories, banzuke("2026-07", "Newname"));
      await importScheduledBouts(repositories, schedule("Newname"));
      await importBoutResults(repositories, results("Newname"));
      expect(
        (await repositories.listRikishi()).filter(
          (entry) => entry.id === original.id,
        ),
      ).toEqual([{ ...original, shikona: "Newname", heya: "Test stable" }]);
      expect(await repositories.listRikishi()).toHaveLength(2);
      expect(await repositories.listRikishiSourceIdentities()).toEqual(
        expect.arrayContaining([
          { source: "jsa", sourceRikishiId: "11", rikishiId: original.id },
          {
            source: "sumo-api",
            sourceRikishiId: "987",
            rikishiId: original.id,
          },
        ]),
      );
      expect(
        (await repositories.listBanzukeEntriesForBasho("2026-05"))[0],
      ).toMatchObject({ rikishiId: original.id, shikona: "Oldname" });
      expect(
        (await repositories.listBanzukeEntriesForBasho("2026-07"))[0],
      ).toMatchObject({ rikishiId: original.id, shikona: "Newname" });
      expect(
        (await repositories.listScheduledBoutsForBasho("2026-07"))[0],
      ).toMatchObject({ eastRikishiId: original.id });
      expect(
        (await repositories.listBoutResultsForBasho("2026-07"))[0],
      ).toMatchObject({ winnerRikishiId: original.id });
      // A changed display name in a later source response still uses its alias.
      await importScheduledBouts(repositories, schedule("Newestname"));
      expect(await repositories.listRikishi()).toHaveLength(2);
      expect(
        (await repositories.listScheduledBoutsForBasho("2026-07"))[0]
          ?.eastRikishiId,
      ).toBe(original.id);
    });

    it("keeps a reused historical shikona separate and never equates numeric IDs across providers", async () => {
      await importBanzuke(repositories, banzuke("2026-05", "Oldname"));
      const original = (await repositories.listRikishi()).find(
        (entry) => entry.shikona === "Oldname",
      )!;
      await importBanzuke(repositories, banzuke("2026-07", "Newname"));
      const card = mapSumoApiSchedulePayload(
        {
          torikumi: [
            {
              eastId: 22,
              eastShikona: "Newname",
              westId: 11,
              westShikona: "Opponent",
            },
          ],
        },
        { bashoId: "2026-07", day: 1 },
      );
      await importScheduledBouts(repositories, card);
      expect(await repositories.listRikishiSourceIdentities()).toContainEqual({
        source: "sumo-api",
        sourceRikishiId: "22",
        rikishiId: original.id,
      });
      const next = banzuke("2026-09", "Oldname");
      next.rikishi[0]!.id = "jsa:33";
      next.rikishi[0]!.sourceIdentity!.sourceRikishiId = "33";
      next.banzukeEntries[0]!.rikishiId = "jsa:33";
      await importBanzuke(repositories, next);
      const reused = (
        await repositories.listBanzukeEntriesForBasho("2026-09")
      ).find((entry) => entry.shikona === "Oldname")!;
      expect(reused.rikishiId).not.toBe(original.id);
      expect(
        (await repositories.listBanzukeEntriesForBasho("2026-05"))[0],
      ).toMatchObject({ shikona: "Oldname", rikishiId: original.id });
    });

    it("adopts legacy same-basho rows without rewriting picks, results, or historical displays", async () => {
      await seedDatabase(repositories);
      const picksBefore = await repositories.listFantasyPicksForBasho(
        sampleBasho.id,
      );
      const resultsBefore = await repositories.listBoutResultsForBasho(
        sampleBasho.id,
      );
      const ranks = await repositories.listBanzukeEntriesForBasho(
        sampleBasho.id,
      );
      const known = await repositories.listRikishi();
      const command = {
        source: "verified-test",
        basho: sampleBasho,
        rikishi: known
          .filter((entry) => ranks.some((rank) => rank.rikishiId === entry.id))
          .map((entry) =>
            entry.id === "onosato"
              ? {
                  ...entry,
                  id: "jsa:11",
                  sourceIdentity: {
                    source: "jsa" as const,
                    sourceRikishiId: "11",
                  },
                }
              : entry,
          ),
        banzukeEntries: ranks.map((entry) =>
          entry.rikishiId === "onosato"
            ? { ...entry, rikishiId: "jsa:11" }
            : entry,
        ),
      };
      await importBanzuke(repositories, command);
      // Reimport after the source renames the same wrestler.
      command.rikishi = command.rikishi.map((entry) =>
        entry.id === "jsa:11" ? { ...entry, shikona: "New Onosato" } : entry,
      );
      command.banzukeEntries = command.banzukeEntries.map((entry) =>
        entry.rikishiId === "jsa:11"
          ? { ...entry, shikona: "New Onosato" }
          : entry,
      );
      await importBanzuke(repositories, command);
      expect(
        await repositories.listFantasyPicksForBasho(sampleBasho.id),
      ).toEqual(picksBefore);
      expect(
        await repositories.listBoutResultsForBasho(sampleBasho.id),
      ).toEqual(resultsBefore);
      expect(
        (await repositories.listBanzukeEntriesForBasho("2026-03")).find(
          (entry) => entry.rikishiId === "onosato",
        )?.shikona,
      ).toBe("Onosato");
      const app = buildApp({ db: client });
      try {
        const response = await app.inject({
          method: "GET",
          url: `/api/basho/${sampleBasho.id}/rikishi`,
        });
        expect(response.statusCode).toBe(200);
        expect(
          response
            .json()
            .rikishi.find((entry: { id: string }) => entry.id === "onosato"),
        ).toMatchObject({
          shikona: "New Onosato",
          previousBashoRecord: { status: "available", wins: 10, losses: 5 },
        });
      } finally {
        await app.close();
      }
    });

    it("rejects reused names with a different provider ID and preserves the prior snapshot", async () => {
      await importBanzuke(repositories, banzuke("2026-07", "Oldname"));
      await importScheduledBouts(repositories, schedule("Oldname"));
      const before = await repositories.listScheduledBoutsForBasho("2026-07");
      const reused = schedule("Oldname", 555);
      await expect(
        importScheduledBouts(repositories, reused),
      ).rejects.toMatchObject({
        issues: [
          {
            path: "rikishi.sourceIdentity",
            message: expect.stringContaining("collision"),
          },
        ],
      });
      expect(await repositories.listScheduledBoutsForBasho("2026-07")).toEqual(
        before,
      );
      expect(
        (await repositories.listRikishiSourceIdentities()).some(
          (alias) => alias.sourceRikishiId === "555",
        ),
      ).toBe(false);
    });

    it("fails closed on ambiguous names or a name known only outside the roster", async () => {
      await repositories.upsertRikishi({ id: "legacy", shikona: "Oldname" });
      await expect(
        importBanzuke(repositories, banzuke("2026-07", "Oldname")),
      ).rejects.toMatchObject({
        issues: [
          { message: expect.stringContaining("outside the target roster") },
        ],
      });
      expect(await repositories.listBashos()).toEqual([]);
      await repositories.applyBanzukeImport({
        basho: banzuke("2026-07", "Oldname").basho,
        rikishi: [
          { id: "legacy", shikona: "Oldname" },
          { id: "other", shikona: "Oldname" },
        ],
        banzukeEntries: ["legacy", "other"].map((id, index) => ({
          id,
          rikishiId: id,
          bashoId: "2026-07",
          shikona: "Oldname",
          rank: "Maegashira",
          rankOrder: index + 1,
        })),
      });
      await expect(
        importScheduledBouts(repositories, schedule("Oldname")),
      ).rejects.toMatchObject({
        issues: [{ message: expect.stringContaining("Ambiguous") }],
      });
      expect(await repositories.listRikishiSourceIdentities()).toEqual([]);
    });

    it("rejects stale same-basho identity evidence before attaching aliases", async () => {
      await importBanzuke(repositories, banzuke("2026-07", "Oldname"));
      const rank = (
        await repositories.listBanzukeEntriesForBasho("2026-07")
      )[0]!;
      const racingRepositories: Repositories = {
        ...repositories,
        applyScheduledBoutsImport: async (data) => {
          await repositories.upsertBanzukeEntry({
            ...rank,
            shikona: "Amended source name",
          });
          return repositories.applyScheduledBoutsImport(data);
        },
      };
      await expect(
        importScheduledBouts(racingRepositories, schedule("Oldname")),
      ).rejects.toThrow("Identity roster changed");
      expect(await repositories.listRikishiSourceIdentities()).toHaveLength(2);
      expect(await repositories.listScheduledBoutsForBasho("2026-07")).toEqual(
        [],
      );
    });

    it("does not persist identity plans on dry run or failed validation", async () => {
      const command = banzuke("2026-07", "Oldname");
      await importBanzuke(repositories, command, { dryRun: true });
      expect(await repositories.listRikishiSourceIdentities()).toEqual([]);
      expect(await repositories.listRikishi()).toEqual([]);
      command.banzukeEntries[1]!.rankOrder = 1;
      await expect(importBanzuke(repositories, command)).rejects.toThrow(
        "Import validation failed",
      );
      expect(await repositories.listRikishiSourceIdentities()).toEqual([]);
      expect(await repositories.listBashos()).toEqual([]);
    });

    it("enforces immutable aliases and rolls back an entire conflicting repository import", async () => {
      await repositories.upsertRikishi({ id: "legacy", shikona: "Oldname" });
      const alias = {
        source: "jsa" as const,
        sourceRikishiId: "11",
        rikishiId: "legacy",
      };
      await repositories.attachRikishiSourceIdentity(alias);
      await repositories.attachRikishiSourceIdentity(alias);
      const command = banzuke("2026-07", "Oldname");
      await expect(
        repositories.applyBanzukeImport({
          basho: command.basho,
          rikishi: [{ id: "wrong", shikona: "Different" }],
          banzukeEntries: [],
          sourceIdentities: [{ ...alias, rikishiId: "wrong" }],
        }),
      ).rejects.toThrow("aliases cannot be reassigned");
      expect(await repositories.listBashos()).toEqual([]);
      expect(await repositories.listRikishi()).toEqual([
        { id: "legacy", shikona: "Oldname" },
      ]);
      await expect(
        repositories.attachRikishiSourceIdentity({
          ...alias,
          sourceRikishiId: "12",
        }),
      ).rejects.toThrow();
      await expect(
        repositories.attachRikishiSourceIdentity({
          ...alias,
          source: "sumo-api",
          rikishiId: "missing",
        }),
      ).rejects.toThrow();
      expect(await repositories.listRikishiSourceIdentities()).toEqual([alias]);
    });

    it("checks complete-card roster coverage after canonical reconciliation", async () => {
      await importBanzuke(repositories, banzuke("2026-07", "Oldname"));
      const roster = (
        await repositories.listBanzukeEntriesForBasho("2026-07")
      ).map((entry) => entry.rikishiId);
      const card = {
        ...schedule("Oldname"),
        isComplete: true,
        attestedRikishiIds: ["sumo-api:987"],
      };
      await expect(
        importScheduledBoutsAndBoutResults(
          repositories,
          card,
          results("Oldname"),
          { expectedBanzukeRikishiIds: roster },
        ),
      ).rejects.toMatchObject({
        issues: [{ path: "schedule.attestedRikishiIds" }],
      });
      expect(await repositories.listRikishiSourceIdentities()).toHaveLength(2);
      card.attestedRikishiIds.push("sumo-api:654");
      await importScheduledBoutsAndBoutResults(
        repositories,
        card,
        results("Oldname"),
        { expectedBanzukeRikishiIds: roster },
      );
      expect(
        await repositories.listBoutResultsForBasho("2026-07"),
      ).toHaveLength(1);
      expect(await repositories.listRikishiSourceIdentities()).toHaveLength(4);
    });

    it.each([
      { establishedAlias: true, historicalOldName: false },
      { establishedAlias: false, historicalOldName: false },
      { establishedAlias: false, historicalOldName: true },
    ])(
      "imports differing endpoint names with alias=$establishedAlias and historical old name=$historicalOldName",
      async ({ establishedAlias, historicalOldName }) => {
        await importBanzuke(repositories, banzuke("2026-07", "Newname"));
        if (establishedAlias)
          await importScheduledBouts(repositories, schedule("Newname"));
        if (historicalOldName)
          await repositories.upsertRikishi({
            id: "historical-old",
            shikona: "Oldname",
          });
        const original = (await repositories.listRikishi()).find(
          (entry) => entry.shikona === "Newname",
        )!;
        const aliasesBefore = await repositories.listRikishiSourceIdentities();
        const schedulesBefore =
          await repositories.listScheduledBoutsForBasho("2026-07");
        const card = mapSumoApiSchedulePayload(
          torikumi("Oldname"),
          { bashoId: "2026-07", day: 1 },
          {
            bashoId: "202607",
            division: "Makuuchi",
            east: [
              {
                rikishiID: 987,
                shikonaEn: "Newname",
                record: [{ result: "win" }],
              },
            ],
            west: [
              {
                rikishiID: 654,
                shikonaEn: "Opponent",
                record: [{ result: "loss" }],
              },
            ],
          },
        );
        expect(card.isComplete).toBe(true);
        expect(
          card.rikishi?.find((entry) => entry.id === "sumo-api:987")?.shikona,
        ).toBe("Newname");
        const expectedBanzukeRikishiIds = (
          await repositories.listBanzukeEntriesForBasho("2026-07")
        ).map((entry) => entry.rikishiId);
        await importScheduledBoutsAndBoutResults(
          repositories,
          card,
          results("Oldname"),
          { expectedBanzukeRikishiIds, dryRun: true },
        );
        expect(await repositories.listRikishiSourceIdentities()).toEqual(
          aliasesBefore,
        );
        expect(
          await repositories.listScheduledBoutsForBasho("2026-07"),
        ).toEqual(schedulesBefore);
        expect(await repositories.listBoutResultsForBasho("2026-07")).toEqual(
          [],
        );
        expect((await repositories.getBasho("2026-07"))?.status).toBe(
          "upcoming",
        );
        await importScheduledBoutsAndBoutResults(
          repositories,
          card,
          results("Oldname"),
          { expectedBanzukeRikishiIds },
        );
        // A retry after the first atomic attachment must reuse exactly those aliases.
        await importScheduledBoutsAndBoutResults(
          repositories,
          card,
          results("Oldname"),
          { expectedBanzukeRikishiIds },
        );
        expect(
          (await repositories.listBoutResultsForBasho("2026-07"))[0]
            ?.winnerRikishiId,
        ).toBe(original.id);
        expect(
          (await repositories.listScheduledBoutsForBasho("2026-07"))[0]
            ?.eastRikishiId,
        ).toBe(original.id);
        expect(
          (await repositories.listBanzukeEntriesForBasho("2026-07")).find(
            (entry) => entry.rikishiId === original.id,
          )?.shikona,
        ).toBe("Newname");
        expect(await repositories.listRikishiSourceIdentities()).toHaveLength(
          4,
        );
        expect(await repositories.listRikishiSourceIdentities()).toContainEqual(
          {
            source: "sumo-api",
            sourceRikishiId: "987",
            rikishiId: original.id,
          },
        );
        expect(await repositories.listRikishi()).toHaveLength(
          historicalOldName ? 3 : 2,
        );
      },
    );

    it("rejects contradictory provider identities across a paired import without writes", async () => {
      await importBanzuke(repositories, banzuke("2026-07", "Newname"));
      const card = { ...schedule("Newname"), isComplete: true };
      const resultCommand = results("Newname");
      resultCommand.rikishi![0]!.sourceIdentity!.sourceRikishiId = "999";
      await expect(
        importScheduledBoutsAndBoutResults(repositories, card, resultCommand),
      ).rejects.toMatchObject({ issues: [{ path: "rikishi.sourceIdentity" }] });
      expect(await repositories.listRikishiSourceIdentities()).toHaveLength(2);
      expect(await repositories.listScheduledBoutsForBasho("2026-07")).toEqual(
        [],
      );
      expect(await repositories.listBoutResultsForBasho("2026-07")).toEqual([]);
    });

    it("uses provider identity for prizes even when the displayed shikona changes", async () => {
      await importBanzuke(repositories, banzuke("2026-07", "Oldname"));
      await importScheduledBouts(repositories, schedule("Oldname"));
      const basho = (await repositories.getBasho("2026-07"))!;
      await repositories.updateBasho({
        ...basho,
        status: "complete",
        currentDay: 15,
      });
      const payload = {
        date: "202607",
        yusho: [{ type: "Makuuchi" }],
        specialPrizes: [
          { type: "Gino-sho", rikishiId: 987, shikonaEn: "Different spelling" },
        ],
      };
      await expect(
        importSpecialPrizes(
          repositories,
          async () => new Response(JSON.stringify(payload)),
          "2026-07",
        ),
      ).resolves.toMatchObject({ status: "confirmed", count: 1 });
      payload.specialPrizes[0]!.rikishiId = 999;
      payload.specialPrizes[0]!.shikonaEn = "Oldname";
      await expect(
        importSpecialPrizes(
          repositories,
          async () => new Response(JSON.stringify(payload)),
          "2026-07",
        ),
      ).rejects.toThrow("unmatched");
    });
  });
}

function banzuke(month: string, name: string) {
  return mapJsaBanzukePayload({
    BashoInfo: { start_date: `${month}-10`, end_date: `${month}-24` },
    BanzukeTable: [
      {
        rikishi_id: 11,
        shikona: name,
        heya_name: "Test stable",
        banzuke_id: 1,
        banzuke_name: "Maegashira #1",
      },
      {
        rikishi_id: 22,
        shikona: "Opponent",
        banzuke_id: 2,
        banzuke_name: "Yokozuna",
      },
    ],
  });
}
function torikumi(name: string, firstId = 987) {
  return {
    torikumi: [
      {
        eastId: firstId,
        eastShikona: name,
        westId: 654,
        westShikona: "Opponent",
        winnerId: firstId,
        kimarite: "yorikiri",
      },
    ],
  };
}
function schedule(name: string, firstId = 987) {
  return mapSumoApiSchedulePayload(torikumi(name, firstId), {
    bashoId: "2026-07",
    day: 1,
  });
}
function results(name: string) {
  return mapSumoApiTorikumiPayload(torikumi(name), {
    bashoId: "2026-07",
    day: 1,
  });
}
