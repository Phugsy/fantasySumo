import {
  scoreBreakdownTotal as total,
  scoringPreset,
  projectScoreBreakdown,
  type ScoringMode,
  type ScoreBreakdown,
} from "@fantasy-sumo/domain";
import type { LeaderboardEntry } from "./types";

export function scoringModeLabel(mode: ScoringMode) {
  return scoringPreset(mode).label;
}
export function scoringModeSummary(mode: ScoringMode) {
  const preset = scoringPreset(mode);
  return preset.achievements
    ? `+1 per win · +${preset.kinboshi} bonus per kinboshi · +${preset.kachiKoshi} at eight wins · +${preset.specialPrize} per special prize.`
    : "Losses and absences score zero.";
}
/** A read-only projection of server-derived categories; never writes official rules. */
export function compareScoringMode(
  entries: LeaderboardEntry[],
  mode: ScoringMode,
  sourceMode: ScoringMode = "wins-v0",
): LeaderboardEntry[] {
  function projectPick<
    T extends {
      score: number;
      breakdown?: ScoreBreakdown;
    },
  >(pick: T): T {
    if (!pick.breakdown) return pick;
    const breakdown = projectScoreBreakdown(pick.breakdown, sourceMode, mode);
    return { ...pick, breakdown, score: total(breakdown, mode) };
  }
  return entries
    .map((entry) => {
      let cumulativeScore = 0;
      const scoreHistory = entry.scoreHistory.map((day) => {
        const rikishiScores = day.rikishiScores.map(projectPick);
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
        ...(entry.breakdown
          ? {
              breakdown: projectScoreBreakdown(
                entry.breakdown,
                sourceMode,
                mode,
              ),
            }
          : {}),
        score: entry.breakdown
          ? total(
              projectScoreBreakdown(entry.breakdown, sourceMode, mode),
              mode,
            )
          : entry.score,
        rikishiScores: entry.rikishiScores.map(projectPick),
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
