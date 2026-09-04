import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const demoAdminToken =
  process.env.DEMO_ADMIN_TOKEN ?? "playwright-demo-admin-token";
const demoAdminHeaders = {
  "x-demo-admin-token": demoAdminToken,
};

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
});

test("loads API-backed current basho content", async ({ page, request }) => {
  const health = await request.get("/api/health");
  await expect(health).toBeOK();

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Demo May Basho" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Leaderboard", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in / Join" })).toHaveCount(
    2,
  );
  await expect(page.getByLabel("Team name")).toHaveCount(0);

  await page
    .locator(".leaderboard-summary")
    .filter({ hasText: "Dohyo Dreamers" })
    .click();
  await expect(
    page.getByLabel("Tobizaru tournament status and achievements"),
  ).toHaveCount(0);
});

test("shows archived bashos and cross-tournament standings", async ({
  page,
}) => {
  await page.route("**/api/bashos", async (route) => {
    await route.fulfill({
      json: {
        bashos: [
          {
            id: "2026-07",
            isDemo: false,
            name: "July 2026 Basho",
            startDate: "2026-07-12",
            endDate: "2026-07-26",
            status: "complete",
          },
        ],
      },
    });
  });
  await page.route("**/api/leaderboard/all-time", async (route) => {
    await route.fulfill({
      json: {
        bashoCount: 2,
        leaderboard: [
          {
            rank: 1,
            displayName: "North Star",
            score: 19,
            tournamentsPlayed: 2,
            bashos: [],
          },
        ],
      },
    });
  });

  await page.goto("/history");

  await expect(
    page.getByRole("heading", { name: "Basho history" }),
  ).toBeVisible();
  await expect(page.getByText("North Star")).toBeVisible();
  await expect(page.getByText("July 2026 Basho")).toBeVisible();
  await expect(page.getByText("19 pts")).toBeVisible();
});

test("lets an authenticated admin run the deterministic demo loop", async ({
  page,
}) => {
  test.setTimeout(60_000);

  await page.goto("/admin");

  await expect(page).toHaveURL(/\/login\?returnTo=%2Fadmin$/);
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);

  await page.getByLabel("Email").fill("e2e-admin@example.com");
  await page.getByLabel("Display name").fill("E2E Admin");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Demo May Basho" }),
  ).toBeVisible();

  const initialHeader = await measureHeaderControls(page);
  expect(initialHeader).not.toBeNull();
  expect(
    Math.abs(initialHeader!.navigationHeight - initialHeader!.signOutHeight),
  ).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 416, height: 918 });
  const compactHeader = await measureHeaderControls(page);

  expect(compactHeader).not.toBeNull();
  expect(
    Math.abs(compactHeader!.navigationHeight - compactHeader!.signOutHeight),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(compactHeader!.navigationWidth - compactHeader!.signOutWidth),
  ).toBeLessThanOrEqual(1);
  expect(compactHeader!.signOutTop).toBeGreaterThanOrEqual(
    compactHeader!.navigationBottom,
  );
  expect(new Set(compactHeader!.linkTops.map(Math.round)).size).toBe(1);
  expect(compactHeader!.linkHeights.every((height) => height >= 44)).toBe(true);

  const pointerFocusedTitle = page.getByRole("heading", {
    name: "Admin controls",
  });
  await expect(pointerFocusedTitle).toBeFocused();
  await expect(pointerFocusedTitle).toHaveCSS("outline-style", "none");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset and open picks" }).click();
  await expect(
    page.getByText("Demo fixture reset. Picks are open at day 0."),
  ).toBeVisible();

  const previousScrollY = await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
    return window.scrollY;
  });
  expect(previousScrollY).toBeGreaterThan(0);
  await page.getByRole("link", { name: "My stable" }).click();
  await expect(page).toHaveURL(/\/stable$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator(".lifecycle-state")).toHaveText("Picks open");

  await page.getByRole("link", { name: "Admin" }).click();
  await page.getByRole("button", { name: "Start the demo" }).click();
  await expect(page.getByText("Demo started. Picks are locked.")).toBeVisible();

  await page.getByRole("link", { name: "My stable" }).click();
  await expect(page.locator(".lifecycle-state")).toHaveText(
    "Scoring in progress",
  );

  await page.getByRole("link", { name: "Admin" }).click();
  await page.getByRole("button", { name: "Advance one day" }).click();
  await expect(
    page.getByText("Demo advanced by one result day."),
  ).toBeVisible();
  await expect(page.locator(".admin-basho-summary dd").nth(1)).toHaveText("1");

  const completeResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/admin/demo/complete") &&
      response.request().method() === "POST",
    { timeout: 30_000 },
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Finish the demo" }).click();
  const completeResponse = await completeResponsePromise;
  expect(completeResponse.ok()).toBe(true);
  await expect(page.getByText("Demo completed through day 15.")).toBeVisible();
  await expect(page.locator(".admin-basho-summary dd").first()).toHaveText(
    "Complete",
  );

  await page.getByRole("link", { name: "My stable" }).click();
  await expect(page.locator(".lifecycle-state")).toHaveText(
    "Final scores - Day 15",
  );

  const stableTitle = page.getByRole("heading", { name: "My stable" });
  await expect(stableTitle).toBeFocused();
  await expect(stableTitle).toHaveCSS("outline-style", "none");

  const leaderboardLink = page.getByRole("link", { name: "Leaderboard" });
  await leaderboardLink.focus();
  await page.keyboard.press("Enter");
  const leaderboardTitle = page.getByRole("heading", {
    name: "Follow the leaderboard",
  });
  await expect(leaderboardTitle).toBeFocused();
  await expect(leaderboardTitle).toHaveCSS("outline-style", "solid");
});

test("lets an admin persist inherited live config and validate a result import without contacting the source", async ({
  page,
}) => {
  await page.goto("/admin");
  await page.getByLabel("Email").fill("e2e-admin@example.com");
  await page.getByLabel("Display name").fill("E2E Admin");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Demo May Basho" }),
  ).toBeVisible();

  await page.route("**/api/admin/basho/current", async (route) => {
    await route.fulfill({
      json: {
        basho: {
          id: "2026-09",
          isDemo: false,
          name: "September 2026 Basho",
          startDate: "2026-09-13",
          endDate: "2026-09-27",
          status: "upcoming",
          currentDay: 0,
        },
      },
    });
  });
  let teamSizePersisted = false;
  await page.route("**/api/admin/basho/2026-09/game-config", async (route) => {
    if (route.request().method() === "PUT") {
      expect(route.request().postDataJSON()).toEqual({ teamSize: 2 });
      teamSizePersisted = true;
    }

    await route.fulfill({
      json: {
        bashoId: "2026-09",
        changed: false,
        canChangeTeamSize: false,
        gameConfig: {
          teamSize: 2,
          teamSizeSource: teamSizePersisted ? "basho" : "default",
          scoringMode: "wins-v0",
        },
      },
    });
  });
  await page.route(
    "**/api/admin/basho/2026-09/import-results?dryRun=true",
    async (route) => {
      await route.fulfill({
        json: {
          dryRun: true,
          source: "sumo-api-results",
          status: "complete",
          summary: {
            results: { created: 21, updated: 0, skipped: 0, deleted: 0 },
          },
          schedule: {
            status: "imported",
            day: 2,
            import: {
              dryRun: true,
              source: "sumo-api-schedule",
              summary: {
                scheduledBouts: {
                  created: 21,
                  updated: 0,
                  skipped: 0,
                  deleted: 0,
                },
              },
            },
          },
        },
      });
    },
  );

  await page.getByRole("button", { name: "Live basho" }).click();
  await expect(
    page.getByRole("heading", { name: "September 2026 Basho" }),
  ).toBeVisible();
  await expect(page.getByText("One point per win")).toBeVisible();
  await expect(page.getByLabel("Rikishi per stable")).toBeDisabled();
  await page.getByRole("button", { name: "Save inherited team size" }).click();
  await expect(page.getByText("Team size saved as 2.")).toBeVisible();
  await expect(page.getByText("Saved for this basho")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save team size" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Validate results" }).click();
  await expect(page.getByText("Dry-run result")).toBeVisible();
  await expect(
    page.getByRole("row", {
      name: "Following schedule: Scheduled Bouts 21 0 0 0",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Following day 2 schedule was also validated."),
  ).toBeVisible();
});

test("lets an admin bootstrap a missing live basho from a confirmed banzuke", async ({
  page,
}) => {
  await page.goto("/admin");
  await page.getByLabel("Email").fill("e2e-admin@example.com");
  await page.getByLabel("Display name").fill("E2E Admin");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  let imported = false;
  await page.route("**/api/admin/basho/current", async (route) => {
    if (!imported) {
      await route.fulfill({
        json: { error: "not-found", message: "No live basho is available." },
        status: 404,
      });
      return;
    }

    await route.fulfill({
      json: {
        basho: {
          id: "2026-11",
          isDemo: false,
          name: "November 2026 Basho",
          startDate: "2026-11-08",
          endDate: "2026-11-22",
          status: "upcoming",
          currentDay: 0,
        },
      },
    });
  });
  await page.route("**/api/admin/basho/2026-11/game-config", async (route) => {
    await route.fulfill({
      json: {
        bashoId: "2026-11",
        canChangeTeamSize: true,
        gameConfig: {
          teamSize: 2,
          teamSizeSource: "default",
          scoringMode: "wins-v0",
        },
      },
    });
  });
  await page.route("**/api/admin/import-banzuke?dryRun=*", async (route) => {
    const requestBody = route.request().postDataJSON() as {
      confirmedSourceBashoId?: string;
    };
    const dryRun = route.request().url().endsWith("dryRun=true");

    if (!dryRun) {
      expect(requestBody.confirmedSourceBashoId).toBe("2026-11");
      imported = true;
    }

    await route.fulfill({
      json: {
        dryRun,
        source: "jsa-banzuke",
        summary: {
          basho: { created: 1, updated: 0, skipped: 0, deleted: 0 },
        },
        targetBasho: dryRun
          ? undefined
          : {
              id: "2026-11",
              isDemo: false,
              name: "November 2026 Basho",
              startDate: "2026-11-08",
              endDate: "2026-11-22",
              status: "upcoming",
              currentDay: 0,
            },
        targetBashoId: "2026-11",
      },
    });
  });

  await page.getByRole("button", { name: "Live basho" }).click();
  await expect(page.getByText(/No live basho is stored/)).toBeVisible();
  await page.getByRole("button", { name: "Validate banzuke" }).click();
  await expect(page.getByText("Target basho: 2026-11")).toBeVisible();

  await page
    .getByRole("checkbox", { name: "Dry run — validate without writing" })
    .uncheck();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Import banzuke" }).click();

  await expect(
    page.getByRole("heading", { name: "November 2026 Basho" }),
  ).toBeVisible();
});

test("keeps a rolled-over banzuke selected while the previous basho remains active", async ({
  page,
}) => {
  await page.goto("/admin");
  await page.getByLabel("Email").fill("e2e-admin@example.com");
  await page.getByLabel("Display name").fill("E2E Admin");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const previousBasho = {
    id: "2026-09",
    isDemo: false,
    name: "September 2026 Basho",
    startDate: "2026-09-13",
    endDate: "2026-09-27",
    status: "active",
    currentDay: 15,
  };
  const importedBasho = {
    id: "2026-11",
    isDemo: false,
    name: "November 2026 Basho",
    startDate: "2026-11-08",
    endDate: "2026-11-22",
    status: "upcoming",
    currentDay: 0,
  };

  await page.route("**/api/admin/basho/current", async (route) => {
    await route.fulfill({ json: { basho: previousBasho } });
  });
  await page.route("**/api/admin/basho/*/game-config", async (route) => {
    const bashoId = route.request().url().includes(importedBasho.id)
      ? importedBasho.id
      : previousBasho.id;
    await route.fulfill({
      json: {
        bashoId,
        canChangeTeamSize: true,
        gameConfig: {
          teamSize: 2,
          teamSizeSource: "default",
          scoringMode: "wins-v0",
        },
      },
    });
  });
  await page.route("**/api/admin/import-banzuke?dryRun=*", async (route) => {
    const dryRun = route.request().url().endsWith("dryRun=true");
    await route.fulfill({
      json: {
        dryRun,
        source: "jsa-banzuke",
        summary: {
          basho: {
            created: dryRun ? 0 : 1,
            updated: 0,
            skipped: 0,
            deleted: 0,
          },
        },
        targetBasho: dryRun ? undefined : importedBasho,
        targetBashoId: importedBasho.id,
      },
    });
  });

  await page.getByRole("button", { name: "Live basho" }).click();
  await expect(
    page.getByRole("heading", { name: previousBasho.name }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Validate banzuke" }).click();
  await page
    .getByRole("checkbox", { name: "Dry run — validate without writing" })
    .uncheck();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Import banzuke" }).click();

  await expect(
    page.getByRole("heading", { name: importedBasho.name }),
  ).toBeVisible();
});

test("refreshes a stale player team-size limit and preserves the draft", async ({
  page,
}) => {
  let currentBashoRequestCount = 0;
  let teamSaveRequestCount = 0;
  let teamSizeChanged = false;

  await page.route("**/api/basho/current?mode=demo", async (route) => {
    currentBashoRequestCount += 1;
    const response = await route.fetch();
    const basho = (await response.json()) as Record<string, unknown>;

    await route.fulfill({
      response,
      json: {
        ...basho,
        teamSize: teamSizeChanged ? 3 : 2,
      },
    });
  });
  await page.route("**/api/basho/*/teams", async (route) => {
    teamSaveRequestCount += 1;

    if (teamSaveRequestCount === 1) {
      teamSizeChanged = true;
      await route.fulfill({
        json: {
          error: "team-size-changed",
          message: "Team size changed to 3. Review your picks and try again.",
          teamSize: 3,
        },
        status: 409,
      });
      return;
    }

    await route.fulfill({
      json: {
        team: {
          id: "team-stale-limit",
          displayName: "Flexible Stable",
        },
        picks: [
          { rikishiId: "wakatakakage" },
          { rikishiId: "ura" },
          { rikishiId: "hoshoryu" },
        ],
      },
      status: 201,
    });
  });

  await page.goto("/");
  await signInAsDemoUser(page);
  await page.getByLabel("Team name").fill("Flexible Stable");
  await page.getByRole("button", { name: /Wakatakakage/ }).click();
  await page.getByRole("button", { name: /Ura/ }).click();
  await page.getByRole("button", { name: "Submit team" }).click();

  await expect(
    page.getByText("Team size changed to 3. Review your picks and try again."),
  ).toBeVisible();
  await expect(page.getByLabel("Team name")).toHaveValue("Flexible Stable");
  await expect(page.getByText("2 of 3 selected")).toBeVisible();
  await expect(page.getByRole("button", { name: /Hoshoryu/ })).toBeEnabled();

  await page.getByRole("button", { name: /Hoshoryu/ }).click();
  await page.getByRole("button", { name: "Submit team" }).click();

  await expect(page.getByText("Flexible Stable submitted.")).toBeVisible();
  expect(currentBashoRequestCount).toBeGreaterThanOrEqual(3);
  expect(teamSaveRequestCount).toBe(2);
});

test("creates a fantasy team and follows its My Stable score", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);

  await page.goto("/");
  await signInAsDemoUser(page);

  await page.getByLabel("Team name").fill("Codex Stable");
  await page.getByRole("button", { name: /Wakatakakage/ }).click();
  await page.getByRole("button", { name: /Ura/ }).click();
  await expect(page.getByText("Team full")).toBeVisible();

  await page.getByRole("button", { name: "Submit team" }).click();

  await expect(page.getByText("Codex Stable submitted.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Codex Stable" }),
  ).toBeVisible();
  await expect(page.getByLabel("0 total points")).toBeVisible();
  await expect(page.getByText("Wakatakakage")).toBeVisible();
  const numberedRank = page.getByText("Maegashira #10", { exact: true });
  await expect(numberedRank).toBeVisible();
  expect(
    await numberedRank.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await expect(page.getByText("Day 1 · vs Tobizaru")).toBeVisible();
  await expect(page.getByText("Day 1 · vs Takayasu")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit picks" })).toBeVisible();

  await page.getByRole("button", { name: "Edit picks" }).click();
  await expect(
    page.getByRole("heading", { name: "Edit stable" }),
  ).toBeVisible();
  await expect(page.getByLabel("Team name")).toHaveValue("Codex Stable");
  await page.getByLabel("Team name").fill("Codex Stable Updated");
  await page.getByRole("button", { name: "Remove Ura" }).click();
  await page.getByRole("button", { name: /Hoshoryu/ }).click();
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(
    page.getByText("Changes saved for Codex Stable Updated."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Codex Stable Updated" }),
  ).toBeVisible();
  await expect(page.getByText("Hoshoryu")).toBeVisible();
  await expect(page.getByText("Ura", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Day 1 · vs Onosato")).toBeVisible();

  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Edit picks" }).click();

  const startResponse = await request.post("/api/admin/demo/start", {
    headers: demoAdminHeaders,
  });
  await expect(startResponse).toBeOK();
  await page.getByLabel("Team name").fill("Too Late Stable");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText(
      "This basho has started, so picks are locked. Your line-up is read-only.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit picks" })).toHaveCount(0);
  const advanceResponse = await request.post("/api/admin/demo/advance-day", {
    headers: demoAdminHeaders,
  });
  await expect(advanceResponse).toBeOK();

  await page.reload();

  await expect(
    page.getByText("Demo May Basho · Scoring in progress · Day 1"),
  ).toBeVisible();
  await expect(page.getByLabel("1 total points")).toBeVisible();
  await expect(page.getByText("1 win")).toBeVisible();
  await expect(page.getByText("Day 2 · vs Tobizaru")).toBeVisible();
  await expect(page.getByText("Day 2 · vs Kirishima")).toBeVisible();
  await expect(
    page.getByText(
      "This basho has started, so picks are locked. Your line-up is read-only.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit picks" })).toHaveCount(0);

  await page.getByRole("link", { name: "Leaderboard" }).click();
  await expect(
    page.getByRole("button", { name: /Codex Stable Updated.*0 pts/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Codex Stable Updated.*1 pts/ }),
  ).toHaveAttribute("aria-expanded", "true");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Follow the leaderboard" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in / Join" })).toHaveCount(
    1,
  );
  await expect(page.getByRole("link", { name: "My stable" })).toHaveCount(0);
});

test("blocks sign-out while a team save is in flight", async ({ page }) => {
  let releaseSave: () => void = () => undefined;
  const saveMayContinue = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });

  await page.route("**/api/basho/demo-2026-05/teams", async (route) => {
    await saveMayContinue;
    await route.continue();
  });

  await page.goto("/");
  await signInAsDemoUser(page);
  await page.getByLabel("Team name").fill("Patient Stable");
  await page.getByRole("button", { name: /Onosato/ }).click();
  await page.getByRole("button", { name: /Hoshoryu/ }).click();
  await page.getByRole("button", { name: "Submit team" }).click();

  await expect(page.getByRole("button", { name: "Sign out" })).toBeDisabled();
  releaseSave();
  await expect(page.getByText("Patient Stable submitted.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeEnabled();
});

test("blocks team submission while sign-out is in flight", async ({ page }) => {
  let releaseSignOut: () => void = () => undefined;
  const signOutMayContinue = new Promise<void>((resolve) => {
    releaseSignOut = resolve;
  });

  await page.route("**/api/session", async (route) => {
    if (route.request().method() === "DELETE") {
      await signOutMayContinue;
    }

    await route.continue();
  });

  await page.goto("/");
  await signInAsDemoUser(page);
  await page.getByLabel("Team name").fill("Departing Stable");
  await page.getByRole("button", { name: /Onosato/ }).click();
  await page.getByRole("button", { name: /Hoshoryu/ }).click();
  await expect(page.getByRole("button", { name: "Submit team" })).toBeEnabled();

  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByRole("button", { name: "Sign out" })).toBeDisabled();
  releaseSignOut();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Log in / Join" })).toHaveCount(
    2,
  );
  await expect(page.getByText("Departing Stable submitted.")).toHaveCount(0);
});

test("blocks draft editing while sign-in is in flight", async ({ page }) => {
  let releaseSignIn: () => void = () => undefined;
  const signInMayContinue = new Promise<void>((resolve) => {
    releaseSignIn = resolve;
  });

  await page.route("**/api/session", async (route) => {
    if (route.request().method() === "POST") {
      await signInMayContinue;
    }

    await route.continue();
  });

  await page.goto("/");
  await page.getByRole("link", { name: "Log in / Join" }).first().click();
  await page.getByLabel("Email").fill("e2e-player@example.com");
  await page.getByLabel("Display name").fill("E2E Player");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByLabel("Email")).toBeDisabled();
  await expect(page.getByLabel("Display name")).toBeDisabled();
  releaseSignIn();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page).toHaveURL(/\/stable$/);
});

test("returns a signed-in player to an intended protected route", async ({
  page,
}) => {
  await page.goto("/team");

  await expect(page).toHaveURL(/\/login\?returnTo=%2Fteam$/);
  await expect(page.getByLabel("Team name")).toHaveCount(0);
  await page.getByLabel("Email").fill("e2e-player@example.com");
  await page.getByLabel("Display name").fill("E2E Player");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByLabel("Team name")).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByLabel("Team name")).toBeVisible();

  await page.getByRole("link", { name: "Leaderboard" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByLabel("Team name")).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/$/);
});

test("shows completed demo leaderboard entries in score order", async ({
  page,
  request,
}) => {
  const completeResponse = await request.post("/api/admin/demo/complete", {
    headers: demoAdminHeaders,
  });
  await expect(completeResponse).toBeOK();

  await page.goto("/");

  const leaderboardRows = page.locator(".leaderboard-summary");
  await expect(leaderboardRows).toHaveCount(4);

  const rowTexts = await leaderboardRows.allTextContents();
  const scores = rowTexts.map((text) => {
    const match = /(\d+) pts/.exec(text);

    expect(match).not.toBeNull();

    return Number(match?.[1]);
  });

  expect(scores).toEqual([...scores].sort((left, right) => right - left));
  await expect(page.getByText(/wins/).first()).toBeVisible();

  await leaderboardRows.filter({ hasText: "Salt Circle" }).click();
  const uraNotes = page.getByLabel("Ura tournament status and achievements");
  await expect(uraNotes.getByText("Gold star")).toBeVisible();
  await expect(uraNotes.getByText(/derived/i)).toHaveCount(0);

  await leaderboardRows.filter({ hasText: "Dohyo Dreamers" }).click();
  const tobizaruNotes = page.getByLabel(
    "Tobizaru tournament status and achievements",
  );
  await expect(tobizaruNotes.getByText("Withdrawn")).toBeVisible();
  await expect(tobizaruNotes.getByText("Make-koshi")).toBeVisible();
  await expect(tobizaruNotes.getByText(/source report/i)).toHaveCount(0);
  await expect(
    page.getByText(
      "Tournament badges are informational and do not add fantasy points.",
    ),
  ).toBeVisible();
});

test("locks team selection after the demo basho starts", async ({
  page,
  request,
}) => {
  await signInRequest(request);
  const unauthorizedResponse = await request.post("/api/admin/demo/start");
  expect(unauthorizedResponse.status()).toBe(403);

  const startResponse = await request.post("/api/admin/demo/start", {
    headers: demoAdminHeaders,
  });
  await expect(startResponse).toBeOK();

  await page.goto("/team");
  await page.getByLabel("Email").fill("e2e-player@example.com");
  await page.getByLabel("Display name").fill("E2E Player");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page.getByText("This basho has started, so picks are locked."),
  ).toBeVisible();
  await expect(page.getByLabel("Team name")).toBeDisabled();
  await expect(page.getByRole("button", { name: /Onosato/ })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Submit team" }),
  ).toBeDisabled();

  const lockedTeamResponse = await request.post(
    "/api/basho/demo-2026-05/teams",
    {
      data: {
        displayName: "Late Stable",
        rikishiIds: ["onosato", "hoshoryu"],
      },
    },
  );
  expect(lockedTeamResponse.status()).toBe(409);
  expect(await lockedTeamResponse.json()).toMatchObject({
    error: "picks-locked",
  });
});

test("advances the demo basho and refreshes scored leaderboard state", async ({
  page,
  request,
}) => {
  const startResponse = await request.post("/api/admin/demo/start", {
    headers: demoAdminHeaders,
  });
  await expect(startResponse).toBeOK();

  const advanceResponse = await request.post("/api/admin/demo/advance-day", {
    headers: demoAdminHeaders,
  });
  await expect(advanceResponse).toBeOK();
  const secondAdvanceResponse = await request.post(
    "/api/admin/demo/advance-day",
    {
      headers: demoAdminHeaders,
    },
  );
  await expect(secondAdvanceResponse).toBeOK();

  await page.goto("/");
  await page.getByRole("link", { name: "Leaderboard" }).click();

  await expect(page.getByText("Demo May Basho - Day 2 of 15")).toBeVisible();
  await expect(page.getByText("Status: Scoring in progress")).toBeVisible();
  const leadingTeamRow = page.getByRole("button", {
    name: /Dohyo Dreamers.*Day 2.*2 pts/,
  });
  await expect(leadingTeamRow).toBeVisible();
  await expect(leadingTeamRow.locator(".daily-score-badge")).toHaveText("+1");
  await expect(
    page.getByLabel("Recent form: day 1 +1, day 2 +1").first(),
  ).toBeVisible();
  await expect(
    page.getByLabel("Recent results for Wakatakakage: day 1 Win, day 2 Loss"),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: /^Cumulative fantasy score progress/ }),
  ).toBeVisible();
  await expect(page.getByText("Latest: Day 2")).toBeVisible();
  expect(
    await page.evaluate(() => {
      const leaderboardList = document.querySelector(".leaderboard-list");
      const progressChart = document.querySelector(".progress-chart");

      return (
        leaderboardList !== null &&
        progressChart !== null &&
        Boolean(
          leaderboardList.compareDocumentPosition(progressChart) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        )
      );
    }),
  ).toBe(true);

  const chartPoint = page.getByRole("button", {
    name: /#1 Dohyo Dreamers, day 2: \+1 that day, 2 cumulative points/,
  });
  await page.locator(".progress-chart-scroll").focus();
  await page.keyboard.press("Tab");
  await expect(chartPoint).toBeFocused();
  await expect(chartPoint.locator(".chart-point-focus-ring")).toHaveCSS(
    "stroke",
    "rgb(43, 118, 138)",
  );
  await expect(page.locator(".progress-chart-detail")).toContainText(
    "#1 Dohyo DreamersDay 2+1 that day2 cumulative pts",
  );
  await expect(
    page.locator(".progress-chart-detail .daily-score-badge"),
  ).toHaveText("+1");

  const tachiaiFilter = page.getByRole("button", {
    name: "#3 Tachiai Titans",
    exact: true,
  });
  const yushoFilter = page.getByRole("button", {
    name: "#4 Yusho Hunters",
    exact: true,
  });
  await tachiaiFilter.click();
  await expect(tachiaiFilter).toHaveAttribute("aria-pressed", "false");
  await yushoFilter.click();
  await expect(yushoFilter).toHaveAttribute("aria-pressed", "false");

  await page
    .getByRole("button", {
      name: "#2 Salt Circle, day 1: +1 that day, 1 cumulative points",
    })
    .click();
  await expect(page.locator(".progress-chart-detail")).toContainText(
    "#2 Salt CircleDay 1+1 that day1 cumulative pts",
  );

  await page.getByRole("button", { name: "Show all" }).click();
  await expect(tachiaiFilter).toHaveAttribute("aria-pressed", "true");
  await expect(yushoFilter).toHaveAttribute("aria-pressed", "true");

  await page.getByText("View score history table").click();
  await expect(
    page.getByRole("table", { name: "Daily and cumulative fantasy points" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Day-by-day score history" }),
  ).toHaveCount(0);

  await page
    .getByRole("button", { name: /Wakatakakage.*1 win.*1 pts/ })
    .click();

  const history = page.getByRole("region", {
    name: "Wakatakakage result history",
  });
  await expect(history).toBeVisible();
  await expect(history.getByLabel("Day 1: Win, +1 point")).toBeVisible();
  await expect(history.getByLabel("Day 2: Loss, 0 points")).toBeVisible();
});

test("prevents incomplete and overfull team submissions", async ({ page }) => {
  await page.goto("/");
  await signInAsDemoUser(page);

  const submitButton = page.getByRole("button", { name: "Submit team" });
  await expect(submitButton).toBeDisabled();

  await page.getByLabel("Team name").fill("Validation Stable");
  await page.getByRole("button", { name: /Onosato/ }).click();
  await expect(page.getByText("1 pick left")).toBeVisible();
  await expect(submitButton).toBeDisabled();

  await page.getByRole("button", { name: /Hoshoryu/ }).click();
  await expect(page.getByText("Team full")).toBeVisible();
  await expect(submitButton).toBeEnabled();
  await expect(page.getByRole("button", { name: /Kotozakura/ })).toBeDisabled();

  await page.getByRole("button", { name: "Remove Hoshoryu" }).click();
  await expect(page.getByRole("button", { name: /Kotozakura/ })).toBeEnabled();
  await expect(submitButton).toBeDisabled();
});

test("keeps public navigation and core views usable on the emulated device", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await expect(
    page.getByRole("heading", { name: "Follow the leaderboard" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Follow the leaderboard" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Score progress" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "No scored days yet. Progress will appear after the first results.",
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

async function resetDemo(request: APIRequestContext) {
  const response = await request.post("/api/admin/demo/reset", {
    headers: demoAdminHeaders,
  });

  await expect(response).toBeOK();
}

async function measureHeaderControls(page: Page) {
  return page.evaluate(() => {
    const navigation = document.querySelector<HTMLElement>(".view-switch");
    const signOut = document.querySelector<HTMLButtonElement>(
      ".session-actions button",
    );
    const links = Array.from(
      document.querySelectorAll<HTMLElement>(".view-switch a"),
    );

    if (navigation === null || signOut === null) {
      return null;
    }

    const navigationBox = navigation.getBoundingClientRect();
    const signOutBox = signOut.getBoundingClientRect();

    return {
      navigationHeight: navigationBox.height,
      navigationWidth: navigationBox.width,
      signOutHeight: signOutBox.height,
      signOutWidth: signOutBox.width,
      signOutTop: signOutBox.top,
      navigationBottom: navigationBox.bottom,
      linkTops: links.map((link) => link.getBoundingClientRect().top),
      linkHeights: links.map((link) => link.getBoundingClientRect().height),
    };
  });
}

async function signInAsDemoUser(page: Page) {
  const bashoReload = page.waitForResponse(
    (response) =>
      response.url().includes("/api/basho/current") && response.ok(),
  );

  await page.locator('a[href="/login?returnTo=%2Fteam"]').click();
  await page.getByLabel("Email").fill("e2e-player@example.com");
  await page.getByLabel("Display name").fill("E2E Player");
  await page.getByRole("button", { name: "Sign in" }).click();
  await bashoReload;
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByLabel("Team name")).toBeVisible();
}

async function signInRequest(request: APIRequestContext) {
  const response = await request.post("/api/session", {
    data: {
      email: "e2e-player@example.com",
      displayName: "E2E Player",
    },
  });

  await expect(response).toBeOK();
}
