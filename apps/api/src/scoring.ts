import type { Repositories } from "@fantasy-sumo/db";
import type { ScoringOptions } from "@fantasy-sumo/domain";

export async function getBashoScoringOptions(
  repositories: Repositories,
  bashoId: string,
): Promise<ScoringOptions> {
  const [config, banzukeEntries, prizes] = await Promise.all([
    repositories.getBashoScoringConfig(bashoId),
    repositories.listBanzukeEntriesForBasho(bashoId),
    repositories.getSpecialPrizeSnapshot(bashoId),
  ]);
  return {
    scoringMode: config?.mode ?? "wins-v0",
    banzukeEntries,
    specialPrizes: prizes?.awards ?? [],
  };
}
