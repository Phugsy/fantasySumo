import type {
  BoutResult,
  FantasyPick,
  FantasyTeam,
  Rikishi,
  RikishiScore,
  ScoringOptions,
  TeamScore,
} from "./types.js";

export function countPickedRikishiWins(
  rikishiId: Rikishi["id"],
  boutResults: readonly BoutResult[],
  options: ScoringOptions = {},
): number {
  return filterResultsForScoring(boutResults, options).filter(
    (result) => result.winnerRikishiId === rikishiId,
  ).length;
}

export function calculateRikishiScore(
  rikishiId: Rikishi["id"],
  boutResults: readonly BoutResult[],
  options: ScoringOptions = {},
): RikishiScore {
  const wins = countPickedRikishiWins(rikishiId, boutResults, options);

  return {
    rikishiId,
    wins,
    score: wins,
  };
}

export function calculateTeamScore(
  team: FantasyTeam,
  picks: readonly FantasyPick[],
  boutResults: readonly BoutResult[],
  options: ScoringOptions = {},
): TeamScore {
  const teamPicks = picks.filter((pick) => pick.teamId === team.id);
  const rikishiScores = teamPicks.map((pick) =>
    calculateRikishiScore(pick.rikishiId, boutResults, options),
  );

  return {
    teamId: team.id,
    displayName: team.displayName,
    score: rikishiScores.reduce(
      (total, rikishiScore) => total + rikishiScore.score,
      0,
    ),
    rikishiScores,
  };
}

function filterResultsForScoring(
  boutResults: readonly BoutResult[],
  options: ScoringOptions,
): BoutResult[] {
  return boutResults.filter(
    (result) =>
      result.winnerAbsent !== true &&
      (options.throughDay === undefined || result.day <= options.throughDay),
  );
}
