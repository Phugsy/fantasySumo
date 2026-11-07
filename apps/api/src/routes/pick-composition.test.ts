import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDatabaseClient,
  createRepositories,
  runMigrations,
  demoBasho,
  demoRikishi,
  demoBanzukeEntries,
  type DatabaseClient,
} from "@fantasy-sumo/db";
import { buildApp } from "../app.js";

const basho = {
  ...demoBasho,
  id: "2027-01",
  isDemo: false,
  startDate: "2027-01-10",
  endDate: "2027-01-24",
};
let client: DatabaseClient;
let directory: string;
let app: ReturnType<typeof buildApp>;
let headers: { cookie: string };
const roster = demoBanzukeEntries.map((entry) => ({
  ...entry,
  id: `${basho.id}-${entry.rikishiId}`,
  bashoId: basho.id,
}));

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "selection-api-"));
  client = createDatabaseClient(`file:${join(directory, "test.sqlite")}`);
  await runMigrations(client);
  await createRepositories(client).applyBanzukeImport({
    basho,
    rikishi: demoRikishi,
    banzukeEntries: roster,
  });
  app = buildApp({
    db: client,
    teamSize: 3,
    now: () => new Date("2027-01-01T12:00:00Z"),
  });
  const session = await app.inject({
    method: "POST",
    url: "/api/session",
    payload: {
      email: "selection@example.com",
      displayName: "Selection Player",
    },
  });
  const cookie = session.headers["set-cookie"]!;
  headers = { cookie: Array.isArray(cookie) ? cookie[0]! : cookie };
});
afterEach(async () => {
  await app.close();
  await client.close();
  rmSync(directory, { recursive: true, force: true });
});

describe("selection limits API", () => {
  it("publishes the rules and tournament-snapshot facts used by the editor", async () => {
    expect((await app.inject("/api/basho/current")).json()).toMatchObject({
      pickCompositionMode: "heya-sanyaku-v1",
    });
    await createRepositories(client).applyBanzukeImport({
      basho,
      rikishi: [],
      banzukeEntries: roster.filter((entry) => entry.rikishiId !== "ura"),
    });
    await createRepositories(client).applyBanzukeImport({
      basho,
      rikishi: [],
      banzukeEntries: roster.map((entry) =>
        entry.rikishiId === "ura" ? { ...entry, heya: undefined } : entry,
      ),
    });
    const body = (await app.inject(`/api/basho/${basho.id}/rikishi`)).json();
    expect(body.basho.pickCompositionMode).toBe("heya-sanyaku-v1");
    expect(
      body.rikishi.find((entry: { id: string }) => entry.id === "ura").heya,
    ).toBeUndefined();
  });

  it.each([
    { ids: ["onosato", "hoshoryu", "kotozakura"], code: "sanyaku-limit" },
    { ids: ["kirishima", "tobizaru", "ura"], code: "duplicate-heya" },
  ])(
    "rejects $code for create and replacement without losing the existing team",
    async ({ ids, code }) => {
      const post = (rikishiIds: string[], displayName = "Original") =>
        app.inject({
          method: "POST",
          url: `/api/basho/${basho.id}/teams`,
          headers,
          payload: { displayName, rikishiIds },
        });
      const rejected = await post(ids);
      expect(rejected.statusCode).toBe(400);
      expect(rejected.json()).toMatchObject({
        error: "invalid-picks",
        details: [{ code }],
      });
      expect(
        (await app.inject({ url: `/api/basho/${basho.id}/my-team`, headers }))
          .statusCode,
      ).toBe(404);
      const created = await post(["onosato", "hoshoryu", "ura"]);
      expect(created.statusCode).toBe(201);
      for (const method of ["POST", "PUT"] as const) {
        const response = await app.inject({
          method,
          url: `/api/basho/${basho.id}/${method === "POST" ? "teams" : "my-team"}`,
          headers,
          payload: { displayName: "Rejected", rikishiIds: ids },
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toMatchObject({
          error: "invalid-picks",
          details: [{ code }],
        });
        const saved = (
          await app.inject({ url: `/api/basho/${basho.id}/my-team`, headers })
        ).json();
        expect(saved.team.displayName).toBe("Original");
        expect(
          saved.picks
            .map((pick: { rikishiId: string }) => pick.rikishiId)
            .sort(),
        ).toEqual(["hoshoryu", "onosato", "ura"]);
      }
      await createRepositories(client).updateBasho({
        ...basho,
        status: "locked",
      });
      expect((await post(["onosato", "hoshoryu", "ura"])).statusCode).toBe(409);
    },
  );

  it("preserves current-basho creation and editing under its existing rules", async () => {
    const legacy = {
      ...basho,
      id: "2026-11",
      startDate: "2026-11-08",
      endDate: "2026-11-22",
    };
    await createRepositories(client).applyBanzukeImport({
      basho: legacy,
      rikishi: [],
      banzukeEntries: roster.map((entry) => ({
        ...entry,
        id: `legacy-${entry.rikishiId}`,
        bashoId: legacy.id,
      })),
    });
    for (const method of ["POST", "PUT"] as const) {
      const response = await app.inject({
        method,
        url: `/api/basho/${legacy.id}/${method === "POST" ? "teams" : "my-team"}`,
        headers,
        payload: {
          displayName: "Legacy",
          rikishiIds: ["onosato", "hoshoryu", "kotozakura"],
        },
      });
      expect(response.statusCode).toBe(method === "POST" ? 201 : 200);
    }
    expect(
      (await app.inject(`/api/basho/${legacy.id}/rikishi`)).json().basho
        .pickCompositionMode,
    ).toBe("open-v0");
  });
});
