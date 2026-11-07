import { expect, test } from "@playwright/test";

test("requires explicit November trial confirmation and shows frozen rules after activation", async ({
  page,
}) => {
  const basho = {
    id: "2026-11",
    isDemo: false,
    name: "November 2026",
    startDate: "2026-11-08",
    endDate: "2026-11-22",
    status: "upcoming",
    currentDay: 0,
  };
  let trial: null | {
    bashoId: string;
    preset: string;
    baseMode: string;
    enabledAt: string;
    enabledBy: string;
  } = null;
  let activated = 0;
  await page.route("**/api/admin/basho/current", (route) =>
    route.fulfill({ json: { basho } }),
  );
  await page.route("**/api/admin/basho/2026-11/game-config", (route) =>
    route.fulfill({
      json: {
        bashoId: basho.id,
        canChangeTeamSize: false,
        canChangeScoringMode: !trial,
        gameConfig: {
          teamSize: 2,
          teamSizeSource: "basho",
          scoringMode: "wins-v0",
          scoringLocked: Boolean(trial),
        },
      },
    }),
  );
  await page.route("**/api/admin/basho/2026-11/jokers", async (route) => {
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toEqual({
        confirmBashoId: "2026-11",
        acceptPreStartTrial: true,
      });
      activated += 1;
      trial = {
        bashoId: basho.id,
        preset: "three-joker-v1",
        baseMode: "wins-v0",
        enabledAt: "2026-11-07T10:00:00Z",
        enabledBy: "admin",
      };
    }
    await route.fulfill({ json: { trial } });
  });
  await page.goto("/login?returnTo=%2Fadmin");
  await page.getByLabel("Email").fill("e2e-admin@example.com");
  await page.getByLabel("Display name").fill("Trial Admin");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: "Live basho", exact: true }).click();
  const region = page.getByRole("region", { name: "November joker trial" });
  await expect(region).toBeVisible();
  const enable = region.getByRole("button", { name: "Enable November jokers" });
  await expect(enable).toBeDisabled();
  await region.getByRole("checkbox").check();
  await expect(enable).toBeEnabled();
  await enable.click();
  await expect(region.getByRole("status")).toContainText(
    "Jokers are enabled for November",
  );
  expect(activated).toBe(1);
  await expect(region.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByLabel("Scoring mode", { exact: true })).toBeDisabled();
});
