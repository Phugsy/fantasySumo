import { isKinboshiWin } from "@fantasy-sumo/domain";
import type {
  BanzukeEntry,
  BashoRikishiHonours,
  BoutResult,
  FantasyPick,
  SpecialPrizeAward,
} from "@fantasy-sumo/domain";
import type { Repositories } from "@fantasy-sumo/db";

export async function loadBashoRikishiHonours({
  repositories,
  banzuke,
  results,
  picks,
  verifiedThroughDay,
  specialPrizes,
}: {
  repositories: Repositories;
  banzuke: readonly BanzukeEntry[];
  results: readonly BoutResult[];
  picks: readonly FantasyPick[];
  verifiedThroughDay: number;
  specialPrizes: readonly SpecialPrizeAward[] | null;
}): Promise<BashoRikishiHonours> {
  const ranks = new Map(banzuke.map((entry) => [entry.rikishiId, entry.rank]));
  const names = new Map(
    banzuke.map((entry) => [entry.rikishiId, entry.shikona]),
  );
  const pickedIds = new Set(picks.map((pick) => pick.rikishiId));
  const goldStars = results.filter(
    (result) =>
      result.day <= verifiedThroughDay && isKinboshiWin(result, ranks),
  );
  const namedIds = [
    ...goldStars.flatMap((result) => [
      result.winnerRikishiId,
      result.loserRikishiId,
    ]),
    ...(specialPrizes ?? []).map((award) => award.rikishiId),
  ];
  if (namedIds.some((id) => !names.get(id))) {
    for (const rikishi of await repositories.listRikishi()) {
      if (!names.get(rikishi.id)) names.set(rikishi.id, rikishi.shikona);
    }
  }
  const recipient = (rikishiId: string) => ({
    rikishiId,
    shikona: names.get(rikishiId) ?? rikishiId,
    picked: pickedIds.has(rikishiId),
  });

  return {
    verifiedThroughDay,
    goldStars: goldStars
      .sort(
        (left, right) =>
          left.day - right.day || left.id.localeCompare(right.id),
      )
      .map((result) => ({
        day: result.day,
        recipient: recipient(result.winnerRikishiId),
        defeatedYokozuna:
          names.get(result.loserRikishiId) ?? result.loserRikishiId,
      })),
    specialPrizes:
      specialPrizes?.map((award) => ({
        type: award.type,
        recipient: recipient(award.rikishiId),
      })) ?? null,
  };
}
