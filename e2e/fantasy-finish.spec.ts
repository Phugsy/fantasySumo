import { expect, test } from "@playwright/test";

test("announces a verified completed fantasy basho once and retains final standings and title counts", async ({
  page,
}) => {
  let ready = false;
  const current = {
    id: "2026-11",
    name: "November",
    isDemo: false,
    startDate: "2026-11-08",
    endDate: "2026-11-22",
    status: "active",
    currentDay: 1,
    teamSize: 5,
    scoringMode: "wins-v0",
  };
  const completed = {
    ...current,
    id: "2026-09",
    name: "September",
    startDate: "2026-09-13",
    endDate: "2026-09-27",
    status: "complete",
    currentDay: 15,
  };
  const winner = {
    teamId: "winner",
    displayName: "First Stable",
    ownerName: "Alice",
    score: 40,
  };
  const second = {
    teamId: "second",
    displayName: "Second Stable",
    ownerName: "Bob",
    score: 37,
  };
  const finish = {
    bashoId: completed.id,
    bashoName: completed.name,
    startDate: completed.startDate,
    endDate: completed.endDate,
    outcome: { status: "confirmed", yusho: [winner], junYusho: [second] },
  };
  const standings = [winner, second].map((row, index) => ({
    ...row,
    rank: index + 1,
    rikishiScores: [],
    scoreHistory: [],
  }));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown;
    if (path === "/api/session")
      body = {
        mode: "local",
        user: {
          id: "alice",
          email: "alice@example.com",
          displayName: "Alice",
          isAdmin: false,
        },
      };
    else if (path === "/api/basho/current") body = current;
    else if (path === "/api/bashos") body = { bashos: [completed, current] };
    else if (path === "/api/my-history")
      body = {
        score: 40,
        history: [
          {
            basho: completed,
            team: { id: "winner", displayName: "First Stable" },
            score: 40,
            picks: [],
          },
        ],
      };
    else if (path === "/api/leaderboard/all-time")
      body = {
        bashoCount: 1,
        honoursBashoCount: ready ? 1 : 0,
        latestFinish: ready ? finish : null,
        finishes: ready ? [finish] : [],
        leaderboard: [
          {
            rank: 1,
            displayName: "First Stable",
            ownerName: "Alice",
            score: 40,
            tournamentsPlayed: 1,
            yushoCount: ready ? 1 : 0,
            junYushoCount: 0,
            bashos: [],
          },
        ],
      };
    else if (path === `/api/basho/${completed.id}/leaderboard`)
      body = {
        basho: completed,
        bashoId: completed.id,
        totalDays: 15,
        leaderboard: standings,
        finish,
      };
    else if (path.endsWith("/rikishi"))
      body = {
        basho: current,
        rikishi: [
          {
            id: "test-rikishi",
            shikona: "Test Rikishi",
            rank: "Maegashira 1",
            rankOrder: 1,
            heya: "Test",
          },
        ],
      };
    else if (path.endsWith("/leaderboard"))
      body = {
        basho: current,
        bashoId: current.id,
        totalDays: 15,
        leaderboard: [],
      };
    else if (path.endsWith("/schedule"))
      body = { bashoId: current.id, publishedDays: [], bouts: [] };
    else if (path.endsWith("/my-team"))
      return route.fulfill({ status: 404, json: { error: "not-found" } });
    else return route.continue();
    return route.fulfill({ json: body });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Leaderboard", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  ready = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const dialog = page.getByRole("dialog", {
    name: "September: final fantasy honours",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("First Stable", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Bob · 37 pts", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Dismiss result" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.localStorage.getItem("fantasy-sumo:finish:alice:2026-09"),
    ),
  ).toBe("dismissed");
  await page.goto("/history?basho=2026-09");
  await expect(
    page.getByRole("heading", { name: "September: final standings" }),
  ).toBeVisible();
  await expect(page.getByText("Yusho: 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Jun-yusho: 0", { exact: true })).toBeVisible();
  const achievements = page.getByRole("region", { name: "My achievements" });
  const cup = achievements
    .getByRole("listitem")
    .filter({ hasText: "Emperor’s Cup" });
  await expect(cup.getByRole("link", { name: "September" })).toHaveAttribute(
    "href",
    "/history?basho=2026-09",
  );
  await expect(
    achievements
      .getByRole("listitem")
      .filter({ hasText: "Rice for the Stable" }),
  ).toContainText("1 / 2 wins");
  await expect(
    page.getByRole("columnheader", { name: "Official points", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "September: final standings" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
