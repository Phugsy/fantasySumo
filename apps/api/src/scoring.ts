import type { Repositories } from "@fantasy-sumo/db";
import type { ScoringOptions } from "@fantasy-sumo/domain";

export async function getBashoScoringOptions(
  repositories: Repositories,
  bashoId: string,
  now: () => Date = () => new Date(),
): Promise<ScoringOptions> {
  return (await getBashoScoringContext(repositories, bashoId, now)).options;
}

export async function getBashoScoringContext(
  repositories: Repositories,
  bashoId: string,
  now: () => Date = () => new Date(),
) {
  const [config, banzukeEntries, prizes, jokers] = await Promise.all([
    repositories.getBashoScoringConfig(bashoId),
    repositories.listBanzukeEntriesForBasho(bashoId),
    repositories.getSpecialPrizeSnapshot(bashoId),
    repositories.getJokerSnapshot(bashoId, now),
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
      (options.scoringMode !== "achievements-v1" || prizes !== undefined) &&
      (!jokers ||
        (!jokers.budgetDiscrepancy &&
          jokers.allocations.every((a) =>
            ["removed", "refunded", "consumed"].includes(a.state),
          ))),
  };
}
