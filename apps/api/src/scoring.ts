import type { Repositories } from "@fantasy-sumo/db";
import type { ScoringOptions } from "@fantasy-sumo/domain";

export async function getBashoScoringOptions(
  repositories: Repositories,
  bashoId: string,
  now: () => Date = () => new Date(),
): Promise<ScoringOptions> {
  const [config, banzukeEntries, prizes, jokers] = await Promise.all([
    repositories.getBashoScoringConfig(bashoId),
    repositories.listBanzukeEntriesForBasho(bashoId),
    repositories.getSpecialPrizeSnapshot(bashoId),
    repositories.getJokerSnapshot(bashoId, now),
  ]);
  return {
    ...(jokers
      ? {
          jokerSelections: jokers.allocations.filter(
            (a) => a.state === "consumed",
          ),
        }
      : {}),
    scoringMode: config?.mode ?? "wins-v0",
    banzukeEntries,
    specialPrizes: prizes?.awards ?? [],
  };
}
