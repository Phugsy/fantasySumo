import type {
  BoutResult,
  FantasyPick,
  FantasyTeam,
  Rikishi,
  RikishiScore,
  TeamScore,
} from "./types.js";

export function countPickedRikishiWins(
  rikishiId: Rikishi["id"],
  boutResults: readonly BoutResult[],
): number {
  return boutResults.filter(
    (result) =>
      result.winnerRikishiId === rikishiId && result.winnerAbsent !== true,
  ).length;
}

export function calculateRikishiScore(
  rikishiId: Rikishi["id"],
  boutResults: readonly BoutResult[],
): RikishiScore {
  const wins = countPickedRikishiWins(rikishiId, boutResults);

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
): TeamScore {
  const teamPicks = picks.filter((pick) => pick.teamId === team.id);
  const rikishiScores = teamPicks.map((pick) =>
    calculateRikishiScore(pick.rikishiId, boutResults),
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
