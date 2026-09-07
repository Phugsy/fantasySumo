import { calculateLeaderboard, type Basho } from "@fantasy-sumo/domain";
import { DEMO_BASHO_ID } from "./demo-constants.js";
import {
  demoBoutResults,
  demoScheduledBoutPublications,
  demoScheduledBoutsForDay,
} from "./demo-seed-data.js";
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

  await publishDemoWithdrawalMarkers(repositories, nextDay, dayResults);
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
    const dayResults = demoBoutResults.filter((result) => result.day === day);

    await publishDemoWithdrawalMarkers(repositories, day, dayResults);
    await repositories.applyBoutResultsImport({
      bashoId: basho.id,
      day,
      results: dayResults,
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

async function publishDemoWithdrawalMarkers(
  repositories: Repositories,
  day: number,
  dayResults: readonly (typeof demoBoutResults)[number][],
): Promise<void> {
  if (
    !dayResults.some(
      (result) => result.winnerAbsent === true || result.loserAbsent === true,
    )
  ) {
    return;
  }

  const publication = demoScheduledBoutPublications.find(
    (entry) => entry.day === day,
  );

  if (publication === undefined) {
    throw new Error(`Demo schedule publication for day ${day} was not found.`);
  }

  await repositories.applyScheduledBoutsImport({
    publication,
    bouts: demoScheduledBoutsForDay(day),
  });
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
  if (basho.status === "complete") {
    await repositories.replaceSpecialPrizeSnapshot({
      bashoId: basho.id,
      source: "demo",
      fetchedAt: "2026-05-24T12:00:00.000Z",
      awards: [
        { rikishiId: "wakatakakage", type: "technique" },
        { rikishiId: "takayasu", type: "fighting-spirit" },
        { rikishiId: "takayasu", type: "outstanding-performance" },
      ],
    });
  }
  const results = await repositories.listBoutResultsForBasho(basho.id);
  const scoring = await repositories.getBashoScoringConfig(basho.id);
  const specialPrizes = await repositories.getSpecialPrizeSnapshot(basho.id);

  return {
    basho,
    appliedResults: results.length,
    leaderboard: calculateLeaderboard(
      await repositories.listFantasyTeamsForBasho(basho.id),
      await repositories.listFantasyPicksForBasho(basho.id),
      results,
      {
        throughDay: basho.currentDay,
        scoringMode: scoring?.mode ?? "wins-v0",
        banzukeEntries: await repositories.listBanzukeEntriesForBasho(basho.id),
        specialPrizes: specialPrizes?.awards ?? [],
      },
    ),
  };
}
