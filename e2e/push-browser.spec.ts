import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const email = "push-stub@example.com";
const ownerId = `local-${createHash("sha256").update(email).digest("base64url").slice(0, 24)}`;
const publicKey = Buffer.from([4, ...Array(64).fill(1)]).toString("base64url");
test.beforeEach(async ({ page }) => {
  // No actual permission, service worker, native subscription or provider IO.
  await page.addInitScript(() => {
    const calls = {
      prompts: 0,
      registers: 0,
      subscriptions: 0,
      unsubscribes: 0,
      closes: 0,
    };
    Object.assign(window, { __pushStub: calls });
    let permission = "default",
      registered = false,
      subscribed = false;
    const native = {
      toJSON: () => ({
        endpoint: "https://fcm.googleapis.com/wp/synthetic-browser",
        keys: { p256dh: "synthetic", auth: "synthetic" },
        expirationTime: null,
      }),
      unsubscribe: async () => {
        calls.unsubscribes++;
        subscribed = false;
        return true;
      },
    };
    const registration = {
      active: {
        state: "activated",
        scriptURL: `${location.origin}/push-worker.js`,
      },
      getNotifications: async () => [
        {
          close: () => {
            calls.closes++;
          },
        },
      ],
      pushManager: {
        getSubscription: async () => (subscribed ? native : null),
        subscribe: async () => {
          calls.subscriptions++;
          subscribed = true;
          return native;
        },
      },
    };
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        get permission() {
          return permission;
        },
        requestPermission: async () => {
          calls.prompts++;
          permission = "granted";
          return permission;
        },
      },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: class {},
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: async () => (registered ? registration : undefined),
        register: async () => {
          calls.registers++;
          registered = true;
          return registration;
        },
      },
    });
    // iPhone installation is a separate physical-device launch check. This
    // synthetic harness exercises the connector after the install prerequisite.
    Object.defineProperty(navigator, "standalone", {
      configurable: true,
      value: true,
    });
  });
});
async function signIn(page: Page) {
  await page.goto("/login?returnTo=%2Fstable");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Display name").fill("Push Stub Player");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/stable$/);
}
test("default backend never requests notification permissions or device registration", async ({
  page,
}) => {
  await signIn(page);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect(await manifest.json()).toMatchObject({
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
  });
  await expect(
    page.getByText("Reminders are not available for this account yet."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enable on this device" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => Reflect.get(window, "__pushStub")),
  ).toMatchObject({ prompts: 0, registers: 0, subscriptions: 0 });
});
test("uses explicit opt-in with stubbed browser APIs and revokes before signing out", async ({
  page,
}, testInfo) => {
  let record: { deviceId: string; revision: string } | null = null;
  let revocations = 0;
  await page.route("**/api/push/**", async (route) => {
    const request = route.request();
    if (request.url().endsWith("/preferences"))
      return route.fulfill({
        json: {
          available: true,
          subscribed: !!record,
          revision: record?.revision ?? null,
          deviceId: record?.deviceId,
          publicKey,
          ownerId,
          bashoId: "demo-2026-05",
          endsAt: "2099-05-24T15:00:00Z",
        },
      });
    if (request.method() === "PUT") {
      const body = request.postDataJSON();
      expect(body.expectedOwnerId).toBe(ownerId);
      record = {
        deviceId: body.deviceId,
        revision: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      };
      return route.fulfill({
        json: { revision: record.revision, revokeToken: "A".repeat(43) },
      });
    }
    if (request.method() === "DELETE") {
      record = null;
      return route.fulfill({ status: 204 });
    }
    if (request.url().endsWith("/revoke-device")) {
      revocations++;
      record = null;
      return route.fulfill({ status: 204 });
    }
    throw new Error("Unexpected synthetic push request");
  });
  await signIn(page);
  await expect(page.getByText("Reminders are off.")).toBeVisible();
  expect(
    await page.evaluate(() => Reflect.get(window, "__pushStub")),
  ).toMatchObject({ prompts: 0, registers: 0 });
  await page.getByRole("button", { name: "Enable on this device" }).click();
  await expect(
    page.getByText("Reminders are on for this device."),
  ).toBeVisible();
  expect(
    await page.evaluate(() => Reflect.get(window, "__pushStub")),
  ).toMatchObject({ prompts: 1, registers: 1, subscriptions: 1 });
  await page
    .getByRole("heading", { name: "Pick Window reminders" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("push-enabled.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Turn off on this device" }).click();
  await expect(page.getByText("Reminders are off.")).toBeVisible();
  expect(revocations).toBe(1);
  await page.getByRole("button", { name: "Enable on this device" }).click();
  await expect(
    page.getByText("Reminders are on for this device."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Disable reminders everywhere" })
    .click();
  await expect(page.getByText("Reminders are off.")).toBeVisible();
  expect(revocations).toBe(2);
  await page.getByRole("button", { name: "Enable on this device" }).click();
  await expect(
    page.getByText("Reminders are on for this device."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(revocations).toBe(3);
  expect(record).toBeNull();
  expect(
    await page.evaluate(() => Reflect.get(window, "__pushStub")),
  ).toMatchObject({ closes: 3 });
});
