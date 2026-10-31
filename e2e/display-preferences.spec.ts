import { expect, test } from "@playwright/test";

test("persists list preferences and theme while preserving picks and leaderboard order", async ({
  page,
  request,
}) => {
  await request.post("/api/admin/demo/reset", {
    headers: {
      "x-demo-admin-token":
        process.env.DEMO_ADMIN_TOKEN ?? "playwright-demo-admin-token",
    },
  });
  await page.goto("/login?returnTo=%2Fteam");
  await page.getByLabel("Email").fill("preferences@example.com");
  await page.getByLabel("Display name").fill("Preferences Player");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/team$/);
  const rows = page.locator(".rikishi-row");
  await expect(rows.first()).toContainText("Onosato");
  await page.getByText("Display", { exact: true }).click();
  await page.getByLabel("Rikishi order").selectOption("name");
  await expect(rows.first()).toContainText("Hoshoryu");
  await page.getByLabel("Show rikishi photos").check();
  await page.getByLabel("Colour theme").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByText("Display", { exact: true }).click();
  const onosato = rows.filter({ hasText: "Onosato" });
  await onosato.scrollIntoViewIfNeeded();
  await expect(onosato.locator("img")).toHaveJSProperty("naturalWidth", 120);
  await expect(
    rows.filter({ hasText: "Hoshoryu" }).getByText("No photo"),
  ).toBeVisible();
  await expect(
    rows
      .filter({ has: page.getByText("Ura", { exact: true }) })
      .getByText("No photo"),
  ).toBeVisible();
  await onosato.click();
  await expect(onosato).toHaveAttribute("aria-pressed", "true");
  await page.getByText("Display", { exact: true }).click();
  await page.getByLabel("Rikishi order").selectOption("score");
  await expect(onosato).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByText("Display", { exact: true }).click();
  await expect(page.getByLabel("Show rikishi photos")).toBeChecked();
  await expect(page.getByLabel("Rikishi order")).toHaveValue("score");
  await page.getByLabel("Colour theme").selectOption("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Show rikishi photos").uncheck();
  await expect(rows.locator("img")).toHaveCount(0);
  await page.getByText("Display", { exact: true }).click();
  await onosato.click();
  await rows.filter({ hasText: "Hoshoryu" }).click();
  await page.getByLabel("Team name").fill("Preference Stable");
  await page.getByRole("button", { name: "Submit team", exact: true }).click();
  await page.getByRole("link", { name: "My stable", exact: true }).click();
  const picks = page
    .getByRole("list", { name: "Your selected rikishi" })
    .locator(":scope > li");
  await expect(picks).toHaveCount(2);
  await page.getByText("Display", { exact: true }).click();
  await page.getByLabel("Rikishi order").selectOption("name");
  await expect(picks.first()).toContainText("Hoshoryu");
  await page.getByLabel("Rikishi order").selectOption("rank");
  await expect(picks.first()).toContainText("Onosato");
  await page.getByText("Display", { exact: true }).click();
  await page.getByRole("link", { name: "Leaderboard", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Leaderboard", exact: true }),
  ).toBeVisible();
  // The list preference must never sort official standings alphabetically.
  const leaderboard = await request.get("/api/basho/demo-2026-05/leaderboard");
  const { leaderboard: entries } = await leaderboard.json();
  expect(entries.length).toBeGreaterThan(0);
  const scores = entries.map((entry: { score: number }) => entry.score);
  expect(scores).toEqual([...scores].sort((a, b) => b - a));
});
