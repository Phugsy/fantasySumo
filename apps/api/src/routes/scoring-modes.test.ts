import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDatabaseClient,
  createRepositories,
  runMigrations,
  type DatabaseClient,
  type Repositories,
} from "@fantasy-sumo/db";
import {
  toCompleteScheduledBoutPublicationSource,
  type Basho,
} from "@fantasy-sumo/domain";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { importSpecialPrizes } from "../imports/special-prizes.js";

const basho: Basho = {
  id: "2026-07",
  isDemo: false,
  name: "July",
  startDate: "2026-07-12",
  endDate: "2026-07-26",
  status: "upcoming",
  currentDay: 0,
};
const adminId = `local-${createHash("sha256").update("admin@example.com").digest("base64url").slice(0, 24)}`;
let client: DatabaseClient;
let repositories: Repositories;
let app: FastifyInstance;
let cookie: string;
let payload: unknown;
let unavailable: boolean;
let sourceFetch: typeof fetch;

beforeEach(async () => {
  client = createDatabaseClient(":memory:");
  await runMigrations(client);
  repositories = createRepositories(client);
  await repositories.applyBanzukeImport({
    basho,
    rikishi: [
      { id: "m", shikona: "M" },
      { id: "y", shikona: "Y" },
    ],
    banzukeEntries: [
      {
        id: "m-rank",
        bashoId: basho.id,
        rikishiId: "m",
        rank: "Maegashira 1",
        rankOrder: 2,
      },
      {
        id: "y-rank",
        bashoId: basho.id,
        rikishiId: "y",
        rank: "Yokozuna",
        rankOrder: 1,
      },
    ],
  });
  unavailable = false;
  payload = {
    date: "202607",
    yusho: [{ type: "Makuuchi" }],
    specialPrizes: [
      { type: "Gino-sho", rikishiId: 1, shikonaEn: "M" },
      { type: "Kanto-sho", rikishiId: 1, shikonaEn: "M" },
    ],
  };
  sourceFetch = vi.fn(async () => {
    if (unavailable) throw new Error("Source unavailable");
    return new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json" },
    });
  });
  app = buildApp({
    db: client,
    authMode: "local",
    adminUserIds: [adminId],
    teamSize: 1,
    sourceFetch,
    cronSecret: "cron",
    now: () => new Date("2026-07-28T12:00:00.000Z"),
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/session",
    payload: { email: "admin@example.com", displayName: "Admin" },
  });
  cookie = String(login.headers["set-cookie"]).split(";")[0]!;
});
afterEach(async () => {
  await app.close();
  await client.close();
});

async function selectMode(mode: string) {
  return app.inject({
    method: "PUT",
    url: `/api/admin/basho/${basho.id}/game-config/scoring`,
    headers: { cookie },
    payload: { scoringMode: mode },
  });
}
async function complete() {
  for (let day = 1; day <= 15; day++) {
    await repositories.applyScheduledBoutsImport({
      publication: {
        id: `card-${day}`,
        bashoId: basho.id,
        day,
        source: toCompleteScheduledBoutPublicationSource("test"),
        publishedAt: "2026-07-26T12:00:00.000Z",
      },
      bouts: [
        {
          id: `bout-${day}`,
          bashoId: basho.id,
          day,
          eastRikishiId: "m",
          westRikishiId: "y",
          status: "scheduled",
        },
      ],
    });
    await repositories.insertBoutResult({
      id: `result-${day}`,
      bashoId: basho.id,
      day,
      winnerRikishiId: day <= 8 ? "m" : "y",
      loserRikishiId: day <= 8 ? "y" : "m",
    });
  }
  await repositories.updateBasho({
    ...basho,
    status: "complete",
    currentDay: 15,
  });
}

describe("official scoring and prize imports", () => {
  it("protects encoded admin routes for anonymous and non-admin callers", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/session",
      payload: { email: "player@example.com", displayName: "Player" },
    });
    const playerCookie = String(login.headers["set-cookie"]).split(";")[0]!;
    for (const headers of [{}, { cookie: playerCookie }]) {
      for (const path of [
        `admin/basho/${basho.id}/game-config/%73coring`,
        `admin/basho/${basho.id}/game-%63onfig/scoring`,
        `%61dmin/basho/${basho.id}/game-config/scoring`,
      ]) {
        expect(
          (
            await app.inject({
              method: "PUT",
              url: `/api/${path}`,
              headers,
              payload: { scoringMode: "achievements-v1" },
            })
          ).statusCode,
        ).toBe(403);
      }
      for (const path of [
        `admin/basho/${basho.id}/import-%70rizes`,
        `%61dmin/basho/${basho.id}/import-prizes`,
        `admin/basho/${basho.id}/import-%72esults`,
        `admin/basho/${basho.id}/import-%73chedule`,
        "admin/import-%62anzuke",
      ]) {
        expect(
          (
            await app.inject({
              method: "POST",
              url: `/api/${path}`,
              headers,
            })
          ).statusCode,
        ).toBe(403);
      }
    }
    expect(sourceFetch).not.toHaveBeenCalled();
    expect((await repositories.getBashoScoringConfig(basho.id))?.mode).toBe(
      "wins-v0",
    );
    expect(
      await repositories.getSpecialPrizeSnapshot(basho.id),
    ).toBeUndefined();
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/api/admin/basho/${basho.id}/game-config/%73coring`,
          headers: { cookie },
          payload: { scoringMode: "achievements-v1" },
        })
      ).statusCode,
    ).toBe(200);
    await complete();
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/admin/basho/${basho.id}/import-%70rizes`,
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(200);
    expect(await repositories.getSpecialPrizeSnapshot(basho.id)).toBeDefined();
  });
  it("authorizes scoring changes and allows changes after team creation but never after locking", async () => {
    const url = `/api/admin/basho/${basho.id}/game-config/scoring`;
    expect(
      (
        await app.inject({
          method: "PUT",
          url,
          payload: { scoringMode: "achievements-v1" },
        })
      ).statusCode,
    ).toBe(403);
    expect((await selectMode("unknown")).statusCode).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/basho/${basho.id}/teams`,
          headers: { cookie },
          payload: { displayName: "Stable", rikishiIds: ["m"] },
        })
      ).statusCode,
    ).toBe(201);
    expect((await selectMode("achievements-v1")).statusCode).toBe(200);
    expect((await app.inject(`/api/basho/current`)).json().scoringMode).toBe(
      "achievements-v1",
    );
    await repositories.lockBashoAndFantasyTeams(
      basho.id,
      "2026-07-10T12:00:00.000Z",
    );
    expect((await selectMode("wins-v0")).statusCode).toBe(409);
    await repositories.transitionBashoLifecycle(
      basho.id,
      "open-picks",
      "2026-07-10T13:00:00.000Z",
    );
    expect((await selectMode("wins-v0")).statusCode).toBe(409);
  });
  it("uses the saved mode for leaderboard, private stable, historical and all-time scores", async () => {
    await selectMode("achievements-v1");
    await app.inject({
      method: "POST",
      url: `/api/basho/${basho.id}/teams`,
      headers: { cookie },
      payload: { displayName: "Stable", rikishiIds: ["m"] },
    });
    await complete();
    await importSpecialPrizes(repositories, sourceFetch, basho.id);
    const board = (
      await app.inject(`/api/basho/${basho.id}/leaderboard`)
    ).json();
    expect(board).toMatchObject({
      scoringMode: "achievements-v1",
      specialPrizesStatus: "confirmed",
      leaderboard: [
        {
          score: 29,
          breakdown: {
            wins: 8,
            kinboshi: 16,
            kachiKoshi: 3,
            fightingSpirit: 1,
            technique: 1,
          },
        },
      ],
    });
    expect(board.leaderboard[0].scoreHistory.at(-1).cumulativeScore).toBe(29);
    expect(
      (
        await app.inject({
          url: `/api/basho/${basho.id}/my-team`,
          headers: { cookie },
        })
      ).json().totalScore,
    ).toBe(29);
    expect(
      (await app.inject({ url: "/api/my-history", headers: { cookie } })).json()
        .history[0].score,
    ).toBe(29);
    expect(
      (await app.inject("/api/leaderboard/all-time")).json().leaderboard[0]
        .score,
    ).toBe(29);
    await repositories.upsertBasho({ ...basho, id: "2026-09" });
    expect((await repositories.getBashoScoringConfig("2026-09"))?.mode).toBe(
      "wins-v0",
    );
    expect(
      (
        await app.inject(
          `/api/basho/${basho.id}/leaderboard?scoringMode=wins-v0`,
        )
      ).json().leaderboard[0].score,
    ).toBe(29);
  });
  it("protects imports, dry-runs without writes, and rejects malformed or mismatched awards without erasing a snapshot", async () => {
    const url = `/api/admin/basho/${basho.id}/import-prizes`;
    expect((await app.inject({ method: "POST", url })).statusCode).toBe(403);
    await complete();
    expect(
      (
        await app.inject({
          method: "POST",
          url: `${url}?dryRun=true`,
          headers: { cookie },
        })
      ).json(),
    ).toMatchObject({ count: 2, dryRun: true });
    expect(
      await repositories.getSpecialPrizeSnapshot(basho.id),
    ).toBeUndefined();
    expect(
      (await app.inject({ method: "POST", url, headers: { cookie } }))
        .statusCode,
    ).toBe(200);
    const saved = await repositories.getSpecialPrizeSnapshot(basho.id);
    for (const invalid of [
      {},
      { date: "202609", yusho: [{ type: "Makuuchi" }], specialPrizes: [] },
      {
        date: "202607",
        yusho: [{ type: "Makuuchi" }],
        specialPrizes: [
          { type: "Gino-sho", rikishiId: 2, shikonaEn: "Unknown" },
        ],
      },
    ]) {
      payload = invalid;
      await expect(
        importSpecialPrizes(repositories, sourceFetch, basho.id),
      ).rejects.toThrow();
      expect(await repositories.getSpecialPrizeSnapshot(basho.id)).toEqual(
        saved,
      );
    }
  });
  it("recovers prizes after the completed basho has left the result-import window", async () => {
    await complete();
    unavailable = true;
    const failed = await app.inject({
      url: "/api/cron/import-results",
      headers: { authorization: "Bearer cron" },
    });
    expect(failed.json()).toMatchObject({
      status: "partial",
      prizeRecovery: { bashoId: basho.id, status: "pending" },
    });
    expect((await repositories.getBasho(basho.id))?.status).toBe("complete");
    unavailable = false;
    const recovered = await app.inject({
      url: "/api/cron/import-results",
      headers: { authorization: "Bearer cron" },
    });
    expect(recovered.json()).toMatchObject({
      prizeRecovery: { status: "confirmed", count: 2 },
    });
    expect(
      (await repositories.getSpecialPrizeSnapshot(basho.id))?.awards,
    ).toHaveLength(2);
    expect(sourceFetch).toHaveBeenCalledTimes(2);
  });
});
