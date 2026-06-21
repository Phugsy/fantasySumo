import { calculateLeaderboard, type Basho } from "@fantasy-sumo/domain";
import { demoBasho, demoBoutResults } from "./demo-seed-data.js";
import type { Repositories } from "./repositories.js";
import { seedDemoDatabase } from "./seed.js";
import type { SqliteDatabase } from "./client.js";

export const DEMO_BASHO_ID = demoBasho.id;
export const DEMO_FINAL_DAY = Math.max(
  ...demoBoutResults.map((result) => result.day),
);

export interface DemoProgressionResult {
  basho: Basho;
  appliedResults: number;
  leaderboard: ReturnType<typeof calculateLeaderboard>;
}

export function resetDemoProgression(db: SqliteDatabase): void {
  seedDemoDatabase(db);
}

export function startDemoBasho(
  repositories: Repositories,
  now: () => Date = () => new Date(),
): DemoProgressionResult {
  const basho = requireDemoBasho(repositories);
  const nextBasho: Basho = {
    ...basho,
    status: basho.status === "complete" ? "complete" : "active",
    currentDay: basho.currentDay ?? 0,
  };

  repositories.lockFantasyTeamsForBasho(basho.id, now().toISOString());
  repositories.updateBasho(nextBasho);

  return describeDemoProgression(repositories, nextBasho);
}

export function advanceDemoBashoDay(
  repositories: Repositories,
  now: () => Date = () => new Date(),
): DemoProgressionResult {
  const basho = requireDemoBasho(repositories);

  if (basho.status === "upcoming" || basho.status === "locked") {
    startDemoBasho(repositories, now);
  }

  const currentBasho = requireDemoBasho(repositories);
  const currentDay = currentBasho.currentDay ?? 0;

  if (currentBasho.status === "complete" || currentDay >= DEMO_FINAL_DAY) {
    return describeDemoProgression(repositories, {
      ...currentBasho,
      status: "complete",
      currentDay: DEMO_FINAL_DAY,
    });
  }

  const nextDay = currentDay + 1;
  const dayResults = demoBoutResults.filter((result) => result.day === nextDay);
  const nextBasho: Basho = {
    ...currentBasho,
    status: nextDay >= DEMO_FINAL_DAY ? "complete" : "active",
    currentDay: nextDay,
  };

  repositories.applyBoutResultsImport({
    bashoId: currentBasho.id,
    day: nextDay,
    results: dayResults,
  });
  repositories.updateBasho(nextBasho);

  return describeDemoProgression(repositories, nextBasho);
}

export function completeDemoBasho(
  repositories: Repositories,
  now: () => Date = () => new Date(),
): DemoProgressionResult {
  const basho = requireDemoBasho(repositories);

  if (basho.status === "upcoming" || basho.status === "locked") {
    repositories.lockFantasyTeamsForBasho(basho.id, now().toISOString());
  }

  repositories.deleteBoutResultsForBasho(basho.id);

  for (let day = 1; day <= DEMO_FINAL_DAY; day += 1) {
    repositories.applyBoutResultsImport({
      bashoId: basho.id,
      day,
      results: demoBoutResults.filter((result) => result.day === day),
    });
  }

  const nextBasho: Basho = {
    ...basho,
    status: "complete",
    currentDay: DEMO_FINAL_DAY,
  };

  repositories.updateBasho(nextBasho);

  return describeDemoProgression(repositories, nextBasho);
}

function requireDemoBasho(repositories: Repositories): Basho {
  const basho = repositories.getBasho(DEMO_BASHO_ID);

  if (basho === undefined) {
    throw new Error(
      `Demo basho ${DEMO_BASHO_ID} was not found. Run the demo reset command first.`,
    );
  }

  return basho;
}

function describeDemoProgression(
  repositories: Repositories,
  basho: Basho,
): DemoProgressionResult {
  const results = repositories.listBoutResultsForBasho(basho.id);

  return {
    basho,
    appliedResults: results.length,
    leaderboard: calculateLeaderboard(
      repositories.listFantasyTeamsForBasho(basho.id),
      repositories.listFantasyPicksForBasho(basho.id),
      results,
      { throughDay: basho.currentDay },
    ),
  };
}
