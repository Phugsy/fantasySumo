import { expect, test } from "@playwright/test";
import { createDatabaseClient } from "../packages/db/src/client";
import {
  DEFAULT_DATABASE_URL,
  resolveSqlitePath,
} from "../packages/db/src/config";

const bashoId = "demo-2026-05";
const adminHeaders = {
  "x-demo-admin-token":
    process.env.DEMO_ADMIN_TOKEN ?? "playwright-demo-admin-token",
};

test("explains selection limits, saves corrected picks and preserves locking", async ({
  page,
  request,
}) => {
  await expect(
    await request.post("/api/admin/demo/reset", { headers: adminHeaders }),
  ).toBeOK();
  // A three-pick fixture lets the rank cap be reached before the team is full.
  // Scope this setup to the configured test SQLite file and the flagged demo.
  const url = process.env.E2E_DATABASE_URL!;
  if (
    !url.startsWith("file:") ||
    resolveSqlitePath(url) === resolveSqlitePath(DEFAULT_DATABASE_URL)
  )
    throw new Error("Selection E2E requires a dedicated test SQLite database.");
  const client = createDatabaseClient(url);
  if (client.provider !== "sqlite") throw new Error("Expected test SQLite.");
  const original = client.sqlite
    .prepare("SELECT team_size FROM basho_game_config WHERE basho_id = ?")
    .get(bashoId) as { team_size: number } | undefined;
  client.sqlite
    .prepare(
      "INSERT INTO basho_game_config (basho_id, team_size) SELECT id, 3 FROM basho WHERE id = ? AND is_demo = 1 AND status = 'upcoming' ON CONFLICT (basho_id) DO UPDATE SET team_size = 3",
    )
    .run(bashoId);
  await client.close();
  try {
    await page.goto("/team");
    await page.getByLabel("Email").fill("selection-e2e@example.com");
    await page.getByLabel("Display name").fill("Selection Player");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText(/Choose at most two sanyaku/)).toBeVisible();
    await page.getByLabel("Team name").fill("Legal Line-up");
    const roster = page.getByRole("region", { name: "Choose rikishi" });
    const pick = (name: string) =>
      roster.getByRole("button", { name: new RegExp(name) });
    await pick("Onosato").click();
    await pick("Hoshoryu").click();
    await expect(pick("Kotozakura")).toBeDisabled();
    await expect(pick("Kotozakura")).toContainText(
      /The sanyaku limit is 2\. Please choose a Maegashira rikishi\./,
    );
    await expect(pick("Ura")).toBeEnabled();
    await page.getByRole("button", { name: "Remove Hoshoryu" }).click();
    await expect(pick("Kotozakura")).toBeEnabled();
    await pick("Kirishima").click();
    await expect(pick("Tobizaru")).toBeDisabled();
    await expect(pick("Tobizaru")).toContainText(
      /Please choose one from another stable\./,
    );
    await pick("Ura").click();
    await expect(
      page.getByRole("button", { name: "Remove Kirishima" }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Submit team" }).click();
    await expect(page).toHaveURL(/\/stable$/);
    await page.getByRole("button", { name: "Edit picks" }).click();
    await page.getByRole("button", { name: "Remove Kirishima" }).click();
    await expect(pick("Tobizaru")).toBeEnabled();
    await pick("Tobizaru").click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/stable$/);
    const before = await (
      await page.request.get(`/api/basho/${bashoId}/my-team`)
    ).json();
    const rejected = await page.request.put(`/api/basho/${bashoId}/my-team`, {
      data: {
        displayName: "Rejected",
        rikishiIds: ["onosato", "hoshoryu", "kotozakura"],
      },
    });
    expect(rejected.status()).toBe(400);
    expect((await rejected.json()).details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "sanyaku-limit" }),
      ]),
    );
    expect(
      await (await page.request.get(`/api/basho/${bashoId}/my-team`)).json(),
    ).toEqual(before);
    await expect(
      await request.post("/api/admin/demo/start", { headers: adminHeaders }),
    ).toBeOK();
    await page.goto("/team");
    await expect(page.getByLabel("Team name")).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Save changes" }),
    ).toBeDisabled();
    expect(
      (
        await page.request.put(`/api/basho/${bashoId}/my-team`, {
          data: {
            displayName: "Late",
            rikishiIds: ["onosato", "tobizaru", "ura"],
          },
        })
      ).status(),
    ).toBe(409);
  } finally {
    const cleanup = createDatabaseClient(url);
    if (cleanup.provider === "sqlite") {
      if (original === undefined)
        cleanup.sqlite
          .prepare("DELETE FROM basho_game_config WHERE basho_id = ?")
          .run(bashoId);
      else
        cleanup.sqlite
          .prepare(
            "UPDATE basho_game_config SET team_size = ? WHERE basho_id = ?",
          )
          .run(original.team_size, bashoId);
    }
    await cleanup.close();
  }
});
