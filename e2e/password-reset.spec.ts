import { expect, test, type Page, type Route } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await stubNeonAuth(page);
});

test("requests a neutral password reset from the Neon sign-in form", async ({
  page,
}) => {
  let resetRequest: Record<string, unknown> | null = null;

  await page.route(
    "**/fake-neon-auth/request-password-reset",
    async (route) => {
      resetRequest = route.request().postDataJSON() as Record<string, unknown>;
      await fulfillJson(route, {
        status: true,
        message: "Reset password request processed",
      });
    },
  );

  await page.goto("/login?returnTo=%2Fteam");
  await page.getByLabel("Email").fill("player@example.com");
  await page.getByRole("button", { name: "Forgot password?" }).click();

  await expect(page).toHaveURL(/\/reset-password\?returnTo=%2Fteam$/);
  await expect(page.getByLabel("Email")).toHaveValue("player@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();

  await expect(
    page.getByText(
      "If an account exists for that email, a password reset link is on its way.",
    ),
  ).toBeVisible();
  expect(resetRequest).toEqual({
    email: "player@example.com",
    redirectTo: "http://127.0.0.1:7867/reset-password?returnTo=%2Fteam",
  });
});

test("completes a valid reset and recovers from an invalid link", async ({
  page,
}) => {
  let resetRequest: Record<string, unknown> | null = null;

  await page.route("**/fake-neon-auth/reset-password", async (route) => {
    resetRequest = route.request().postDataJSON() as Record<string, unknown>;
    await fulfillJson(route, { status: true });
  });

  await page.goto(
    "/reset-password?token=browser-valid-token&returnTo=%2Fstable",
  );
  await page
    .getByLabel("New password", { exact: true })
    .fill("browser-strong-password");
  await page.getByLabel("Confirm new password").fill("browser-strong-password");
  await page.getByRole("button", { name: "Reset password" }).click();

  await expect(
    page.getByText(
      "Your password has been reset. Sign in with the new password to continue.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Continue to sign in" }),
  ).toHaveAttribute("href", "/login?returnTo=%2Fstable");
  expect(resetRequest).toEqual({
    newPassword: "browser-strong-password",
    token: "browser-valid-token",
  });

  await page.goto("/reset-password?error=INVALID_TOKEN&returnTo=%2Fstable");
  await expect(
    page.getByText(
      "This password reset link is invalid, expired, or has already been used. Request a new link to continue.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send reset link" }),
  ).toBeVisible();
});

async function stubNeonAuth(page: Page) {
  await page.route("**/api/session", async (route) => {
    if (route.request().method() === "GET") {
      await fulfillJson(route, { mode: "neon", user: null });
      return;
    }

    await route.continue();
  });

  await page.route("**/fake-neon-auth/get-session", async (route) => {
    await fulfillJson(route, null);
  });
}

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status: 200,
  });
}
