import type { Repositories } from "@fantasy-sumo/db";
import {
  scoringPreset,
  type BanzukeEntry,
  type ScoringOptions,
} from "@fantasy-sumo/domain";

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
  const context = await getBashoScoringContext(
    repositories,
    bashoId,
    now,
    loaded,
  );
  return {
    ...context.options,
    specialPrizesStatus: context.specialPrizesStatus,
  };
}

export async function getBashoScoringContext(
  repositories: Repositories,
  bashoId: string,
  now: () => Date = () => new Date(),
  loaded: ScoringLoadOptions = {},
) {
  const [config, banzukeEntries, prizes, jokers] = await Promise.all([
    repositories.getBashoScoringConfig(bashoId),
    loaded.banzukeEntries ?? repositories.listBanzukeEntriesForBasho(bashoId),
    repositories.getSpecialPrizeSnapshot(bashoId),
    loaded.includeJokers === false
      ? undefined
      : repositories.getJokerSnapshot(bashoId, now),
  ]);
  const options: ScoringOptions = {
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
  return {
    options,
    specialPrizesStatus:
      prizes === undefined ? ("pending" as const) : ("confirmed" as const),
    finalInputsReady:
      (!scoringPreset(options.scoringMode ?? "wins-v0").achievements ||
        prizes !== undefined) &&
      (!jokers ||
        (!jokers.budgetDiscrepancy &&
          jokers.allocations.every((a) =>
            ["removed", "refunded", "consumed"].includes(a.state),
          ))),
  };
}
