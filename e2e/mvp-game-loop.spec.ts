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
  await expect(page.getByText("0 of 2 selected")).toBeVisible();
  await expect(page.getByRole("button", { name: /Onosato/ })).toBeVisible();
});

test("creates a fantasy team and follows its My Stable score", async ({
  page,
  request,
}) => {
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
  await expect(page.getByText("Maegashira #1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit picks" })).toBeVisible();

  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  const startResponse = await request.post("/api/admin/demo/start", {
    headers: demoAdminHeaders,
  });
  await expect(startResponse).toBeOK();
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
  await expect(
    page.getByText(
      "This basho has started, so picks are locked. Your line-up is read-only.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit picks" })).toHaveCount(0);

  await page.getByRole("button", { name: "Leaderboard" }).click();
  await expect(
    page.getByRole("button", { name: /Codex Stable.*0 pts/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Codex Stable.*1 pts/ }),
  ).toHaveAttribute("aria-expanded", "true");
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

  await expect(
    page.getByRole("button", { name: "Submit team" }),
  ).toBeDisabled();
  releaseSignOut();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue("");
  await expect(page.getByLabel("Display name")).toHaveValue("");
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
  await page.getByLabel("Team name").fill("Waiting Draft");
  await page.getByLabel("Email").fill("e2e-player@example.com");
  await page.getByLabel("Display name").fill("E2E Player");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByLabel("Team name")).toBeDisabled();
  await expect(page.getByRole("button", { name: /Onosato/ })).toBeDisabled();
  releaseSignIn();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page.getByLabel("Team name")).toBeEnabled();
  await expect(page.getByRole("button", { name: /Onosato/ })).toBeEnabled();
});

test("preserves an anonymous team draft through sign-in", async ({ page }) => {
  let hideHoshoryu = false;
  await page.route("**/api/basho/*/rikishi*", async (route) => {
    const response = await route.fetch();

    if (!hideHoshoryu) {
      await route.fulfill({ response });
      return;
    }

    const payload = await response.json();
    await route.fulfill({
      response,
      json: {
        ...payload,
        rikishi: payload.rikishi.filter(
          (rikishi: { id: string }) => rikishi.id !== "hoshoryu",
        ),
      },
    });
  });

  await page.goto("/");
  await page.getByLabel("Team name").fill("Draft Stable");
  await page.getByRole("button", { name: /Onosato/ }).click();
  await page.getByRole("button", { name: /Hoshoryu/ }).click();

  hideHoshoryu = true;
  await signInAsDemoUser(page);

  await expect(page.getByLabel("Team name")).toHaveValue("Draft Stable");
  await expect(page.getByText("1 of 2 selected")).toBeVisible();
  await expect(page.getByRole("button", { name: /Hoshoryu/ })).toHaveCount(0);
  await expect(
    page.locator("button.rikishi-row").filter({ hasText: "Onosato" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Kotozakura/ }).click();
  await expect(page.getByText("2 of 2 selected")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit team" })).toBeEnabled();
  await page.getByRole("button", { name: "Submit team" }).click();
  await expect(page.getByText("Draft Stable submitted.")).toBeVisible();
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
  await page.getByRole("button", { name: "Leaderboard" }).click();

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
});

test("locks team selection after the demo basho starts", async ({
  page,
  request,
}) => {
  await signInRequest(request);
  const unauthorizedResponse = await request.post("/api/admin/demo/start");
  expect(unauthorizedResponse.status()).toBe(401);

  const startResponse = await request.post("/api/admin/demo/start", {
    headers: demoAdminHeaders,
  });
  await expect(startResponse).toBeOK();

  await page.goto("/");

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
  await page.getByRole("button", { name: "Leaderboard" }).click();

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

test("keeps navigation, ranks, and core views usable on the emulated device", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toBeVisible();

  const longRank = page.getByText("Maegashira #1", { exact: true });
  await expect(longRank).toBeVisible();
  expect(
    await longRank.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Leaderboard" }).click();
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

async function signInAsDemoUser(page: Page) {
  const teamName = page.getByLabel("Team name");
  const preserveDraft = (await teamName.inputValue()).trim().length > 0;
  const bashoReload = page.waitForResponse(
    (response) =>
      response.url().includes("/api/basho/current") && response.ok(),
  );

  await page.getByLabel("Email").fill("e2e-player@example.com");
  await page.getByLabel("Display name").fill("E2E Player");
  await page.getByRole("button", { name: "Sign in" }).click();
  await bashoReload;
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  if (!preserveDraft) {
    const createStable = page.getByRole("button", {
      name: "Create your stable",
    });
    await expect(createStable).toBeVisible();
    await createStable.click();
  }

  await expect(teamName).toBeVisible();
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
