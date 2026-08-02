import { calculateLeaderboard, type Basho } from "@fantasy-sumo/domain";
import { DEMO_BASHO_ID } from "./demo-constants.js";
import { demoBoutResults } from "./demo-seed-data.js";
import type { Repositories } from "./repositories.js";
import { seedDemoDatabase } from "./seed.js";

export const DEMO_FINAL_DAY = Math.max(
  ...demoBoutResults.map((result) => result.day),
);

export interface DemoProgressionResult {
  basho: Basho;
  appliedResults: number;
  leaderboard: ReturnType<typeof calculateLeaderboard>;
}

export async function resetDemoProgression(
  repositories: Repositories,
): Promise<void> {
  await seedDemoDatabase(repositories);
}

export async function startDemoBasho(
  repositories: Repositories,
  now: () => Date = () => new Date(),
): Promise<DemoProgressionResult> {
  const basho = await requireDemoBasho(repositories);
  const nextBasho: Basho = {
    ...basho,
    status: basho.status === "complete" ? "complete" : "active",
    currentDay: basho.currentDay ?? 0,
  };

  await repositories.lockBashoAndFantasyTeams(basho.id, now().toISOString());
  await repositories.updateBasho(nextBasho);

  return describeDemoProgression(repositories, nextBasho);
}

export async function advanceDemoBashoDay(
  repositories: Repositories,
  now: () => Date = () => new Date(),
): Promise<DemoProgressionResult> {
  const basho = await requireDemoBasho(repositories);

  if (basho.status === "upcoming" || basho.status === "locked") {
    await startDemoBasho(repositories, now);
  }

  const currentBasho = await requireDemoBasho(repositories);
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

  await repositories.applyBoutResultsImport({
    bashoId: currentBasho.id,
    day: nextDay,
    results: dayResults,
  });
  await repositories.updateBasho(nextBasho);

  return describeDemoProgression(repositories, nextBasho);
}

export async function completeDemoBasho(
  repositories: Repositories,
  now: () => Date = () => new Date(),
): Promise<DemoProgressionResult> {
  const basho = await requireDemoBasho(repositories);

  if (basho.status === "upcoming" || basho.status === "locked") {
    await repositories.lockBashoAndFantasyTeams(basho.id, now().toISOString());
  }

  await repositories.deleteBoutResultsForBasho(basho.id);

  for (let day = 1; day <= DEMO_FINAL_DAY; day += 1) {
    await repositories.applyBoutResultsImport({
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

  await repositories.updateBasho(nextBasho);

  return describeDemoProgression(repositories, nextBasho);
}

async function requireDemoBasho(repositories: Repositories): Promise<Basho> {
  const basho = await repositories.getBasho(DEMO_BASHO_ID);

  if (basho === undefined || !basho.isDemo) {
    throw new Error(
      `Demo basho ${DEMO_BASHO_ID} was not found or is not marked as demo data. Run the demo reset command first.`,
    );
  }

  return basho;
}

async function describeDemoProgression(
  repositories: Repositories,
  basho: Basho,
): Promise<DemoProgressionResult> {
  const results = await repositories.listBoutResultsForBasho(basho.id);

  return {
    basho,
    appliedResults: results.length,
    leaderboard: calculateLeaderboard(
      await repositories.listFantasyTeamsForBasho(basho.id),
      await repositories.listFantasyPicksForBasho(basho.id),
      results,
      { throughDay: basho.currentDay },
    ),
  };
}
