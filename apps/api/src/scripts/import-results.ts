import {
  createDatabaseClient,
  createRepositories,
  runMigrations,
} from "@fantasy-sumo/db";
import { importDailyResultsAndFollowingSchedule } from "../imports/daily-update.js";

const args = new Map(
  process.argv.slice(2).flatMap((arg, index, allArgs) => {
    if (!arg.startsWith("--") || arg === "--dry-run") {
      return [];
    }

    return [[arg.slice(2), allArgs[index + 1]]];
  }),
);
const bashoId = args.get("basho");
const day = Number(args.get("day"));
const division = args.get("division") ?? "Makuuchi";
const dryRun = process.argv.includes("--dry-run");

if (bashoId === undefined || !Number.isInteger(day)) {
  throw new Error(
    "Usage: pnpm --filter @fantasy-sumo/api import:results -- --basho 2026-05 --day 1 [--division Makuuchi] [--dry-run]",
  );
}

const client = createDatabaseClient();

try {
  await runMigrations(client);

  const result = await importDailyResultsAndFollowingSchedule(
    createRepositories(client),
    fetch,
    { bashoId, day, division, dryRun },
  );

  console.log(JSON.stringify(result, null, 2));
  if (result.status === "partial") {
    console.warn(
      `Results imported, but the day ${day + 1} schedule import was ${result.schedule.status}.`,
    );
  }
} finally {
  await client.close();
}
