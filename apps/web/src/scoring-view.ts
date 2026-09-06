import {
  scoreBreakdownTotal as total,
  type ScoringMode,
} from "@fantasy-sumo/domain";
import type { LeaderboardEntry } from "./types";

export function scoringModeLabel(mode: ScoringMode) {
  return mode === "achievements-v1"
    ? "Wins + achievements"
    : "One point per win";
}
/** A read-only projection of server-derived categories; never writes official rules. */
export function compareScoringMode(
  entries: LeaderboardEntry[],
  mode: ScoringMode,
): LeaderboardEntry[] {
  return entries
    .map((entry) => {
      let cumulativeScore = 0;
      const scoreHistory = entry.scoreHistory.map((day) => {
        const rikishiScores = day.rikishiScores.map((pick) => ({
          ...pick,
          score: pick.breakdown ? total(pick.breakdown, mode) : pick.score,
        }));
        const dailyScore = rikishiScores.reduce(
          (sum, pick) => sum + pick.score,
          0,
        );
        cumulativeScore += dailyScore;
        return { ...day, dailyScore, cumulativeScore, rikishiScores };
      });
      const latest = scoreHistory.at(-1);
      return {
        ...entry,
        score: entry.breakdown ? total(entry.breakdown, mode) : entry.score,
        rikishiScores: entry.rikishiScores.map((pick) => ({
          ...pick,
          score: pick.breakdown ? total(pick.breakdown, mode) : pick.score,
        })),
        scoreHistory,
        ...(latest
          ? { latestDayScore: { day: latest.day, score: latest.dailyScore } }
          : {}),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.displayName.localeCompare(b.displayName) ||
        a.teamId.localeCompare(b.teamId),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
