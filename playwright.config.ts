import { createHash } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ?? "file:./data/e2e/fantasy-sumo-e2e.sqlite";
const demoAdminToken =
  process.env.DEMO_ADMIN_TOKEN ?? "playwright-demo-admin-token";
const adminEmail = "e2e-admin@example.com";
const adminUserId = `local-${createHash("sha256")
  .update(adminEmail)
  .digest("base64url")
  .slice(0, 24)}`;

process.env.E2E_DATABASE_URL = e2eDatabaseUrl;
process.env.DEMO_ADMIN_TOKEN = demoAdminToken;
process.env.ADMIN_USER_IDS = adminUserId;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  globalSetup: "./e2e/global-setup.ts",
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:7866",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      testIgnore: /password-reset\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      testIgnore: /password-reset\.spec\.ts/,
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "mobile-webkit",
      testIgnore: /password-reset\.spec\.ts/,
      use: { ...devices["iPhone 13"] },
    },
    {
      name: "auth-chromium",
      testMatch: /password-reset\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:7867",
      },
    },
  ],
  webServer: [
    {
      command:
        "pnpm --filter @fantasy-sumo/domain build && pnpm --filter @fantasy-sumo/api dev",
      env: {
        ...process.env,
        DATABASE_URL: e2eDatabaseUrl,
        DEMO_ADMIN_TOKEN: demoAdminToken,
        ADMIN_USER_IDS: adminUserId,
      },
      url: "http://127.0.0.1:3000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @fantasy-sumo/web dev",
      env: {
        ...process.env,
        VITE_BASHO_MODE: "demo",
      },
      url: "http://127.0.0.1:7866",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command:
        "pnpm --filter @fantasy-sumo/web exec vite --host 0.0.0.0 --port 7867",
      env: {
        ...process.env,
        VITE_BASHO_MODE: "demo",
        VITE_NEON_AUTH_URL: "http://127.0.0.1:7867/fake-neon-auth",
      },
      url: "http://127.0.0.1:7867",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
