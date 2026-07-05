import { execFileSync } from "node:child_process";

const databaseUrl =
  process.env.E2E_DATABASE_URL ?? "file:./data/e2e/fantasy-sumo-e2e.sqlite";

export default async function globalSetup() {
  execFileSync("pnpm", ["--filter", "@fantasy-sumo/domain", "build"], {
    stdio: "inherit",
  });
  execFileSync("pnpm", ["db:seed:demo"], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: "inherit",
  });
}
