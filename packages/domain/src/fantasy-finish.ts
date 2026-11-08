import type { Basho, LeaderboardEntry } from "./types.js";

export type FantasyFinishRecipient = Pick<
  LeaderboardEntry,
  "teamId" | "displayName" | "ownerName" | "score"
>;
export type FantasyFinish =
  | {
      status: "pending";
      reason: "not-complete" | "results-pending" | "scoring-pending";
    }
  | { status: "ineligible"; reason: "demo" | "too-few-entrants" }
  | {
      status: "confirmed";
      yusho: FantasyFinishRecipient[];
      junYusho: FantasyFinishRecipient[];
    };

/** Recognition only. Numeric display positions never decide a title. */
export function deriveFantasyFinish(input: {
  basho: Basho;
  leaderboard: readonly LeaderboardEntry[];
  verifiedThroughDay: number;
  totalDays: number | undefined;
  finalInputsReady: boolean;
}): FantasyFinish {
  if (input.basho.isDemo) return { status: "ineligible", reason: "demo" };
  if (input.basho.status !== "complete")
    return { status: "pending", reason: "not-complete" };
  if (
    !Number.isInteger(input.totalDays) ||
    input.totalDays! < 1 ||
    input.totalDays! > 15 ||
    input.verifiedThroughDay < input.totalDays!
  )
    return { status: "pending", reason: "results-pending" };
  if (!input.finalInputsReady)
    return { status: "pending", reason: "scoring-pending" };
  if (input.leaderboard.length < 2)
    return { status: "ineligible", reason: "too-few-entrants" };
  const rows = [...input.leaderboard].sort(
    (a, b) => b.score - a.score || a.teamId.localeCompare(b.teamId),
  );
  const first = rows[0]!.score;
  const yusho = rows.filter((row) => row.score === first);
  const second =
    yusho.length === 1
      ? rows.find((row) => row.score < first)?.score
      : undefined;
  const recipient = (row: LeaderboardEntry): FantasyFinishRecipient => ({
    teamId: row.teamId,
    displayName: row.displayName,
    ...(row.ownerName === undefined ? {} : { ownerName: row.ownerName }),
    score: row.score,
  });
  return {
    status: "confirmed",
    yusho: yusho.map(recipient),
    junYusho:
      second === undefined
        ? []
        : rows.filter((row) => row.score === second).map(recipient),
  };
}

export interface BashoFantasyFinish {
  bashoId: string;
  bashoName: string;
  startDate: string;
  endDate: string;
  outcome: FantasyFinish;
}
