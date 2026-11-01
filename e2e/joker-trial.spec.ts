import { expect, test } from "@playwright/test";

test("plays the demo joker journey through edits, deadline, refund, budget and gold-star scoring", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const id = "demo-2026-05";
  const token = process.env.DEMO_ADMIN_TOKEN ?? "playwright-demo-admin-token";
  expect(
    (
      await request.post("/api/admin/demo/reset", {
        headers: { "x-demo-admin-token": token },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/login?returnTo=%2Fadmin");
  await page.getByLabel("Email").fill("e2e-admin@example.com");
  await page.getByLabel("Display name").fill("Joker Player");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  expect(
    (
      await page.request.put(`/api/admin/basho/${id}/game-config/scoring`, {
        data: { scoringMode: "achievements-v1" },
      })
    ).ok(),
  ).toBeTruthy();
  await page.getByText("Joker trial controls", { exact: true }).click();
  await page
    .getByRole("button", { name: "Enable demo jokers", exact: true })
    .click();
  await expect(page.getByText(/Demo server time: 2026-05-10/)).toBeVisible();
  await page.goto("/team");
  await page.getByRole("button", { name: /Yokozuna Onosato/ }).click();
  await page.getByRole("button", { name: /Maegashira #10 Ura/ }).click();
  await page.getByLabel("Team name").fill("Joker Stable");
  await page.getByRole("button", { name: "Submit team", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Joker Stable", exact: true }),
  ).toBeVisible();
  expect((await page.request.post("/api/admin/demo/start")).ok()).toBeTruthy();
  await page.goto("/stable");
  const panel = page.getByRole("region", { name: "Daily joker" });
  await expect(
    panel.getByText("Pick Window: Open", { exact: true }),
  ).toBeVisible();
  async function snapshot() {
    return (await (await page.request.get(`/api/basho/${id}/my-jokers`)).json())
      .snapshot;
  }
  async function select(rikishiId: string) {
    const s = await snapshot();
    const day = Number(await panel.getByLabel("Basho day").inputValue());
    const target = s.windows[day - 1].targets.find(
      (t: { rikishiId: string }) => t.rikishiId === rikishiId,
    );
    await panel
      .getByLabel("Joker rikishi")
      .selectOption(JSON.stringify([target.boutId, target.rikishiId]));
    await panel
      .getByRole("button", { name: "Save joker", exact: true })
      .click();
    await expect(
      panel.getByText(new RegExp(`Day ${day} selection:`)),
    ).toContainText("reserved");
  }
  async function clock(value: string) {
    expect(
      (
        await page.request.put("/api/admin/demo/jokers", {
          data: { clock: value },
        })
      ).ok(),
    ).toBeTruthy();
    await page.reload();
    await expect(panel).toBeVisible();
  }
  async function advance() {
    expect(
      (await page.request.post("/api/admin/demo/advance-day")).ok(),
    ).toBeTruthy();
    await page.reload();
    await expect(panel).toBeVisible();
  }
  await select("onosato");
  await expect(panel.getByText(/2 of 3 jokers remaining/)).toBeVisible();
  await select("ura");
  await expect(panel.getByText(/2 of 3 jokers remaining/)).toBeVisible();
  await panel
    .getByRole("button", { name: "Remove joker", exact: true })
    .click();
  await expect(panel.getByText(/3 of 3 jokers remaining/)).toBeVisible();
  await select("onosato");
  await clock("2026-05-10T03:00:00.000Z");
  await panel.getByLabel("Basho day").selectOption("1");
  await expect(
    panel.getByText("Pick Window: Closed", { exact: true }),
  ).toBeVisible();
  const late = await snapshot();
  const allocation = late.allocations.find((a: { day: number }) => a.day === 1);
  expect(
    (
      await page.request.put(`/api/basho/${id}/my-jokers`, {
        data: {
          day: 1,
          rikishiId: null,
          boutId: null,
          opponentId: null,
          expectedRevision: allocation.revision,
          requestId: "late",
        },
      })
    ).status(),
  ).toBe(409);
  await advance();
  await expect(
    page.getByLabel("2 total points", { exact: true }),
  ).toBeVisible();
  await clock("2026-05-11T02:00:00.000Z");
  await select("onosato");
  await clock("2026-05-11T04:00:00.000Z");
  await advance();
  await expect(
    panel.getByRole("list", { name: "Joker allocation history" }),
  ).toContainText("Day 2: Onosato · refunded");
  await expect(panel.getByText(/2 of 3 jokers remaining/)).toBeVisible();
  await clock("2026-05-12T02:00:00.000Z");
  await select("onosato");
  await clock("2026-05-12T04:00:00.000Z");
  await advance();
  await expect(panel.getByText(/1 of 3 jokers remaining/)).toBeVisible();
  await clock("2026-05-13T02:00:00.000Z");
  await select("ura");
  await expect(panel.getByText(/0 of 3 jokers remaining/)).toBeVisible();
  await clock("2026-05-13T04:00:00.000Z");
  await advance();
  await expect(
    page.getByLabel("11 total points", { exact: true }),
  ).toBeVisible();
  const standings = await (
    await page.request.get(`/api/basho/${id}/leaderboard`)
  ).json();
  const team = standings.leaderboard.find(
    (t: { displayName: string }) => t.displayName === "Joker Stable",
  );
  expect(team.score).toBe(11);
  expect(
    team.scoreHistory.map((d: { dailyScore: number }) => d.dailyScore),
  ).toEqual([2, 2, 1, 6]);
  await clock("2026-05-14T02:00:00.000Z");
  await expect(
    panel.getByRole("button", { name: "Save joker", exact: true }),
  ).toBeDisabled();
  const exhausted = await snapshot();
  const target = exhausted.windows[4].targets[0];
  expect(
    (
      await page.request.put(`/api/basho/${id}/my-jokers`, {
        data: {
          ...target,
          day: 5,
          expectedRevision: 0,
          requestId: "exhausted",
        },
      })
    ).status(),
  ).toBe(409);
});
