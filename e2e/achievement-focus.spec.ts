import { expect, test } from "@playwright/test";

test("saves achievement focus, scores its prizes, and compares both older modes without changing official rules", async ({
  page,
  request,
}) => {
  const headers = {
    "x-demo-admin-token":
      process.env.DEMO_ADMIN_TOKEN ?? "playwright-demo-admin-token",
  };
  await expect(
    await request.post("/api/admin/demo/reset", { headers }),
  ).toBeOK();
  await page.goto("/login?returnTo=%2Fadmin");
  await page.getByLabel("Email").fill("e2e-admin@example.com");
  await page.getByLabel("Display name").fill("Achievement Player");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByLabel("Scoring mode").selectOption("achievements-v2");
  await page
    .getByRole("button", { name: "Save scoring mode", exact: true })
    .click();
  await expect(
    page.getByText(
      "Official scoring saved: Wins + achievements · achievement focus.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto("/team");
  await expect(
    page.getByText(
      /\+3 bonus per kinboshi · \+1 at eight wins · \+3 per special prize/,
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: /Komusubi Takayasu/ }).click();
  await page.getByRole("button", { name: /Sekiwake Wakatakakage/ }).click();
  await page.getByLabel("Team name").fill("Achievement Stable");
  await page.getByRole("button", { name: "Submit team", exact: true }).click();
  await expect(page).toHaveURL(/\/stable$/);
  await expect(
    await request.post("/api/admin/demo/complete", { headers }),
  ).toBeOK();
  await page.reload();
  await expect(
    page.getByLabel("24 total points", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Official rules: Wins + achievements · achievement focus.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Leaderboard", exact: true }).click();
  const team = page
    .locator(".leaderboard-entry")
    .filter({ hasText: "Achievement Stable" });
  await expect(team.locator(".leaderboard-summary")).toContainText("24 pts");
  await page.getByLabel("Scoring view").selectOption("achievements-v1");
  await expect(team.locator(".leaderboard-summary")).toContainText("20 pts");
  await page.getByLabel("Scoring view").selectOption("wins-v0");
  await expect(team.locator(".leaderboard-summary")).toContainText("14 pts");
  const official = await (
    await request.get("/api/basho/demo-2026-05/leaderboard")
  ).json();
  expect(official.scoringMode).toBe("achievements-v2");
  const entry = official.leaderboard.find(
    (entry: { displayName: string }) =>
      entry.displayName === "Achievement Stable",
  );
  expect(entry.score).toBe(24);
  expect(entry.scoreHistory.at(-1).cumulativeScore).toBe(24);
  await page.getByLabel("Scoring view").selectOption("official");
  await expect(team.locator(".leaderboard-summary")).toContainText("24 pts");
  await page.reload();
  await expect(page.getByLabel("Scoring view")).toHaveValue("official");
  await expect(team.locator(".leaderboard-summary")).toContainText("24 pts");
});
