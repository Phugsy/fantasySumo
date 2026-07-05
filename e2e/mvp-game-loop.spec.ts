import { expect, test, type APIRequestContext } from "@playwright/test";

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

test("creates a fantasy team and shows it on the leaderboard", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByLabel("Team name").fill("Codex Stable");
  await page.getByRole("button", { name: /Onosato/ }).click();
  await page.getByRole("button", { name: /Hoshoryu/ }).click();
  await expect(page.getByText("Team full")).toBeVisible();

  await page.getByRole("button", { name: "Submit team" }).click();

  await expect(page.getByText("Codex Stable submitted.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Codex Stable.*0 pts/ }),
  ).toBeVisible();
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

  const leaderboardRows = page.getByRole("button").filter({ hasText: /pts/ });
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

test("prevents incomplete and overfull team submissions", async ({ page }) => {
  await page.goto("/");

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

async function resetDemo(request: APIRequestContext) {
  const response = await request.post("/api/admin/demo/reset", {
    headers: demoAdminHeaders,
  });

  await expect(response).toBeOK();
}
