import { calculateTeamScore } from "./scoring.js";
import type {
  BoutResult,
  FantasyPick,
  FantasyTeam,
  LeaderboardEntry,
  ScoringOptions,
  TeamScore,
} from "./types.js";

export function calculateLeaderboard(
  teams: readonly FantasyTeam[],
  picks: readonly FantasyPick[],
  boutResults: readonly BoutResult[],
  options: ScoringOptions = {},
): LeaderboardEntry[] {
  const sortedScores = teams
    .map((team) => calculateTeamScore(team, picks, boutResults, options))
    .sort(compareLeaderboardEntries);

  return sortedScores.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

export function compareLeaderboardEntries(
  first: TeamScore,
  second: TeamScore,
): number {
  if (first.score !== second.score) {
    return second.score - first.score;
  }

  const displayNameComparison = first.displayName.localeCompare(
    second.displayName,
  );

  if (displayNameComparison !== 0) {
    return displayNameComparison;
  }

  return first.teamId.localeCompare(second.teamId);
}
