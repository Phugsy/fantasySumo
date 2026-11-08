import type { Repositories } from "@fantasy-sumo/db";
import type { BanzukeEntry, ScoringOptions } from "@fantasy-sumo/domain";

interface ScoringLoadOptions {
  // Public rikishi scores never include a team's joker selections.
  includeJokers?: boolean;
  banzukeEntries?: BanzukeEntry[];
}
export async function getBashoScoringOptions(
  repositories: Repositories,
  bashoId: string,
  now: () => Date = () => new Date(),
  loaded: ScoringLoadOptions = {},
): Promise<ScoringOptions & { specialPrizesStatus: "pending" | "confirmed" }> {
  const [config, banzukeEntries, prizes, jokers] = await Promise.all([
    repositories.getBashoScoringConfig(bashoId),
    loaded.banzukeEntries ?? repositories.listBanzukeEntriesForBasho(bashoId),
    repositories.getSpecialPrizeSnapshot(bashoId),
    loaded.includeJokers === false
      ? undefined
      : repositories.getJokerSnapshot(bashoId, now),
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
    specialPrizesStatus: prizes === undefined ? "pending" : "confirmed",
  };
}
