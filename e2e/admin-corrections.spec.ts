import { expect, test, type Page } from "@playwright/test";
import type { Basho } from "../apps/web/src/types";
import type { ScoringMode } from "@fantasy-sumo/domain";

async function liveFixture(
  page: Page,
  owner: boolean,
  status: Basho["status"],
) {
  const basho = {
    id: "2026-11",
    isDemo: false,
    name: "November UAT fixture",
    startDate: "2026-11-08",
    endDate: "2026-11-22",
    status,
    currentDay: owner ? 8 : 0,
  };
  let scoringMode: ScoringMode = "wins-v0";
  let locked = status !== "upcoming";
  let changed = 0;
  const scoringOverrides: Array<Record<string, string>> = [];
  await page.route("**/api/admin/basho/current", (route) =>
    route.fulfill({ json: { basho } }),
  );
  await page.route("**/api/admin/basho/2026-11/jokers", (route) =>
    route.fulfill({ json: { trial: null } }),
  );
  await page.route("**/api/admin/basho/2026-11/game-config", (route) =>
    route.fulfill({
      json: {
        bashoId: basho.id,
        canChangeTeamSize: false,
        canChangeScoringMode: !locked,
        ...(owner ? { canOverrideScoringMode: true, scoringOverrides } : {}),
        gameConfig: {
          teamSize: 2,
          teamSizeSource: "basho",
          scoringMode,
          scoringLocked: locked,
        },
      },
    }),
  );
  for (const action of ["lock-picks", "start", "undo-start"])
    await page.route(`**/api/admin/basho/2026-11/${action}`, (route) => {
      basho.status = action === "start" ? "active" : "locked";
      locked = true;
      return route.fulfill({ json: { action, changed: true, basho } });
    });
  await page.route(
    "**/api/admin/basho/2026-11/game-config/scoring",
    async (route) => {
      const payload = route.request().postDataJSON();
      expect(payload).toEqual({
        scoringMode: "achievements-v1",
        override: {
          expectedMode: "wins-v0",
          reason: "Owner approved a complete rescore",
        },
      });
      changed++;
      scoringMode = payload.scoringMode;
      scoringOverrides.push({
        id: "override-1",
        fromMode: "wins-v0",
        toMode: scoringMode,
        actorUserId: "verified-owner",
        changedAt: "2026-11-15T12:00:00Z",
        reason: payload.override.reason,
      });
      await route.fulfill({
        json: { bashoId: basho.id, gameConfig: { scoringMode } },
      });
    },
  );
  await page.goto("/login?returnTo=%2Fadmin");
  await page
    .getByLabel("Email")
    .fill(owner ? "e2e-owner@example.com" : "e2e-admin@example.com");
  await page
    .getByLabel("Display name")
    .fill(owner ? "Site Owner" : "Ordinary Admin");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: "Live basho", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "November UAT fixture" }),
  ).toBeVisible();
  return { changed: () => changed };
}

test("separates closing picks from start and preserves locked scoring after undo", async ({
  page,
}) => {
  await liveFixture(page, false, "upcoming");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Lock picks", exact: true }).click();
  await expect(
    page.getByText("Picks locked. The basho has not started."),
  ).toBeVisible();
  await expect(page.getByLabel("Scoring mode")).toBeDisabled();
  await page
    .getByRole("button", { name: "Start the basho", exact: true })
    .click();
  await expect(
    page.getByText("Basho started. Picks are locked."),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Undo start", exact: true }).click();
  await expect(
    page.getByText("Start undone. Picks remain locked."),
  ).toBeVisible();
  await expect(page.getByLabel("Scoring mode")).toBeDisabled();
  await expect(
    page.getByLabel(
      "Override locked scoring and recalculate the whole tournament",
    ),
  ).toHaveCount(0);
});

test("requires owner confirmation and reason before changing frozen official scoring", async ({
  page,
}) => {
  const fixture = await liveFixture(page, true, "active");
  await expect(page.getByLabel("Scoring mode")).toBeDisabled();
  await page
    .getByLabel("Override locked scoring and recalculate the whole tournament")
    .check();
  await page.getByLabel("Scoring mode").selectOption("achievements-v1");
  const save = page.getByRole("button", {
    name: "Save scoring mode",
    exact: true,
  });
  await expect(save).toBeDisabled();
  await page
    .getByLabel("Reason for scoring change")
    .fill("Owner approved a complete rescore");
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("recalculates the whole tournament");
    await dialog.accept();
  });
  await save.click();
  await expect(
    page.getByText("Official scoring saved: Wins + achievements.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(fixture.changed()).toBe(1);
  await page.getByText("Scoring override history", { exact: true }).click();
  await expect(
    page.getByText(/Owner approved a complete rescore · account/),
  ).toBeVisible();
  await expect(page.getByLabel("Scoring mode")).toBeDisabled();
});
