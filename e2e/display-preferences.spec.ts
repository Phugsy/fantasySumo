import { expect, test } from "@playwright/test";

test("persists list preferences and theme while preserving picks and leaderboard order", async ({
  page,
  request,
}) => {
  async function toggleDisplay() {
    const toggle = page.getByRole("button", {
      name: "Site settings",
      exact: true,
    });
    if (
      (await toggle.isVisible()) &&
      (await toggle.getAttribute("aria-expanded")) === "false"
    )
      await toggle.click();
    const summary = page.getByText("Display", { exact: true });
    const wasOpen = (await summary.locator("..").getAttribute("open")) !== null;
    await summary.click();
    if (wasOpen && (await toggle.isVisible())) await toggle.click();
  }
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
  await toggleDisplay();
  await page.getByLabel("Rikishi order").selectOption("name");
  await expect(rows.first()).toContainText("Hoshoryu");
  await page.getByLabel("Portrait style").selectOption("photos");
  await page.getByLabel("Colour theme").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await toggleDisplay();
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
  await toggleDisplay();
  await page.getByLabel("Rikishi order").selectOption("score");
  await expect(onosato).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Portrait style").selectOption("illustrations");
  await expect(onosato).toHaveAttribute("aria-pressed", "true");
  await toggleDisplay();
  await onosato.scrollIntoViewIfNeeded();
  await expect(onosato.locator("img")).toHaveAttribute(
    "src",
    /^\/rikishi-illustrations\//,
  );
  await expect(onosato.locator("img")).toHaveJSProperty("naturalWidth", 384);
  if (page.viewportSize()!.width <= 640) {
    const portrait = await onosato.locator("img").boundingBox();
    const rank = await onosato.locator(".rank-pill:visible").boundingBox();
    expect(portrait).not.toBeNull();
    expect(rank).not.toBeNull();
    expect(rank!.x).toBeGreaterThanOrEqual(portrait!.x - 2);
    expect(rank!.y).toBeGreaterThanOrEqual(portrait!.y - 2);
    expect(rank!.x + rank!.width).toBeLessThanOrEqual(
      portrait!.x + portrait!.width + 2,
    );
    expect(rank!.y + rank!.height).toBeLessThanOrEqual(
      portrait!.y + portrait!.height + 2,
    );
  }

  await expect(page.getByText("AI-generated ink illustrations")).toBeVisible();
  await expect(page.getByText("Photo credits", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await toggleDisplay();
  await expect(page.getByLabel("Portrait style")).toHaveValue("illustrations");
  await expect(page.getByLabel("Rikishi order")).toHaveValue("score");
  await page.getByLabel("Colour theme").selectOption("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Portrait style").selectOption("hidden");
  await expect(rows.locator("img")).toHaveCount(0);
  await toggleDisplay();
  await onosato.click();
  await rows.filter({ hasText: "Hoshoryu" }).click();
  await page.getByLabel("Team name").fill("Preference Stable");
  await page.getByRole("button", { name: "Submit team", exact: true }).click();
  await page.getByRole("link", { name: "My stable", exact: true }).click();
  const picks = page
    .getByRole("list", { name: "Your selected rikishi" })
    .locator(":scope > li");
  await expect(picks).toHaveCount(2);
  await toggleDisplay();
  await page.getByLabel("Rikishi order").selectOption("name");
  await expect(picks.first()).toContainText("Hoshoryu");
  await page.getByLabel("Rikishi order").selectOption("rank");
  await expect(picks.first()).toContainText("Onosato");
  await page.getByLabel("Portrait style").selectOption("illustrations");
  await toggleDisplay();
  await picks.first().scrollIntoViewIfNeeded();
  await expect(picks.first().locator("img")).toHaveJSProperty(
    "naturalWidth",
    384,
  );
  await toggleDisplay();
  await page.getByLabel("Portrait style").selectOption("photos");
  await toggleDisplay();
  await picks.first().scrollIntoViewIfNeeded();
  await expect(picks.first().locator("img")).toHaveJSProperty(
    "naturalWidth",
    120,
  );
  await expect(page.getByText("Photo credits", { exact: true })).toBeVisible();
  await page.reload();
  await toggleDisplay();
  await page.getByLabel("Portrait style").selectOption("illustrations");
  await toggleDisplay();
  await picks.first().scrollIntoViewIfNeeded();
  await expect(picks.first().locator("img")).toHaveJSProperty(
    "naturalWidth",
    384,
  );
  await request.post("/api/admin/demo/start", {
    headers: {
      "x-demo-admin-token":
        process.env.DEMO_ADMIN_TOKEN ?? "playwright-demo-admin-token",
    },
  });
  await page.getByRole("link", { name: "Leaderboard", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Leaderboard", exact: true }),
  ).toBeVisible();
  const stable = page
    .locator(".leaderboard-entry")
    .filter({ hasText: "Preference Stable" });
  await expect(
    stable.getByText("Preferences Player", { exact: true }),
  ).toBeVisible();
  const summary = stable.locator(".leaderboard-summary");
  if ((await summary.getAttribute("aria-expanded")) === "false")
    await summary.click();
  const scoreRow = stable
    .locator(".rikishi-score-summary")
    .filter({ hasText: "Onosato" });
  await scoreRow.scrollIntoViewIfNeeded();
  await expect(scoreRow.locator("img")).toHaveJSProperty("naturalWidth", 384);
  await toggleDisplay();
  await page.getByLabel("Portrait style").selectOption("photos");
  await toggleDisplay();
  await scoreRow.scrollIntoViewIfNeeded();
  await expect(scoreRow.locator("img")).toHaveJSProperty("naturalWidth", 120);
  await toggleDisplay();
  await page.getByLabel("Portrait style").selectOption("hidden");
  await expect(stable.locator("img")).toHaveCount(0);
  // The list preference must never sort official standings alphabetically.
  const leaderboard = await request.get("/api/basho/demo-2026-05/leaderboard");
  const { leaderboard: entries } = await leaderboard.json();
  expect(entries.length).toBeGreaterThan(0);
  const scores = entries.map((entry: { score: number }) => entry.score);
  expect(scores).toEqual([...scores].sort((a, b) => b - a));
});

test("keeps the mobile team-name field visible when the editing viewport shrinks", async ({
  page,
  request,
}) => {
  await request.post("/api/admin/demo/reset", {
    headers: {
      "x-demo-admin-token":
        process.env.DEMO_ADMIN_TOKEN ?? "playwright-demo-admin-token",
    },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login?returnTo=%2Fteam");
  await page.getByLabel("Email").fill("keyboard@example.com");
  await page.getByLabel("Display name").fill("Keyboard Player");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/team$/);
  const input = page.getByLabel("Team name");
  await input.focus();
  await expect(page.locator("html")).toHaveAttribute(
    "data-mobile-input-focused",
    "true",
  );
  await page.setViewportSize({ width: 390, height: 380 });
  await input.fill("Visible while typing");
  await expect
    .poll(() =>
      input.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const viewport = window.visualViewport!;
        return (
          rect.top >= viewport.offsetTop + 15 &&
          rect.bottom <= viewport.offsetTop + viewport.height - 15
        );
      }),
    )
    .toBe(true);
  await expect(page.locator(".app-header")).toHaveCSS("position", "static");
  await page.locator("#page-title").focus();
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-mobile-input-focused",
    "true",
  );
  await expect(page.locator(".app-header")).toHaveCSS("position", "sticky");
});
