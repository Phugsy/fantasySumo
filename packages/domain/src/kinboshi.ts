import type { BoutResult } from "./types.js";

export function isKinboshiWin(
  result: BoutResult,
  rankByRikishiId: ReadonlyMap<string, string>,
): boolean {
  const winnerRank = rankByRikishiId.get(result.winnerRikishiId)?.trim() ?? "";
  const loserRank = rankByRikishiId.get(result.loserRikishiId)?.trim() ?? "";
  return (
    result.winnerAbsent !== true &&
    result.loserAbsent !== true &&
    result.kimarite?.trim().toLowerCase() !== "fusen" &&
    /^maegashira(?:\s|$)/i.test(winnerRank) &&
    /^yokozuna(?:\s|$)/i.test(loserRank)
  );
}
