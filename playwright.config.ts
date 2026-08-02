import { defineConfig, devices } from "@playwright/test";

const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ?? "file:./data/e2e/fantasy-sumo-e2e.sqlite";
const demoAdminToken =
  process.env.DEMO_ADMIN_TOKEN ?? "playwright-demo-admin-token";

process.env.E2E_DATABASE_URL = e2eDatabaseUrl;
process.env.DEMO_ADMIN_TOKEN = demoAdminToken;

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
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 13"] },
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
  ],
});
