import type {
  BoutResult,
  FantasyPick,
  FantasyTeam,
  Rikishi,
  RikishiDayScore,
  RikishiScore,
  ScoringOptions,
  TeamScore,
  TeamScoreHistoryEntry,
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

export function calculateTeamScoreHistory(
  team: FantasyTeam,
  picks: readonly FantasyPick[],
  boutResults: readonly BoutResult[],
  options: ScoringOptions = {},
): TeamScoreHistoryEntry[] {
  const scoredResults = filterResultsThroughDay(boutResults, options);
  const scoredDays = [
    ...new Set(scoredResults.map((result) => result.day)),
  ].sort((left, right) => left - right);
  const teamPicks = picks.filter((pick) => pick.teamId === team.id);
  let cumulativeScore = 0;

  return scoredDays.map((day) => {
    const dayResults = scoredResults.filter((result) => result.day === day);
    const rikishiScores = teamPicks.map((pick) =>
      calculateRikishiDayScore(pick.rikishiId, dayResults),
    );
    const dailyScore = rikishiScores.reduce(
      (total, score) => total + score.score,
      0,
    );
    cumulativeScore += dailyScore;

    return {
      day,
      dailyScore,
      cumulativeScore,
      rikishiScores,
    };
  });
}

function calculateRikishiDayScore(
  rikishiId: Rikishi["id"],
  dayResults: readonly BoutResult[],
): RikishiDayScore {
  const results = dayResults.filter(
    (entry) =>
      entry.winnerRikishiId === rikishiId || entry.loserRikishiId === rikishiId,
  );
  const score = results.filter(
    (result) =>
      result.winnerRikishiId === rikishiId && result.winnerAbsent !== true,
  ).length;

  if (results.length === 0) {
    return { rikishiId, outcome: "no-result", score: 0 };
  }

  if (score > 0) {
    return { rikishiId, outcome: "win", score };
  }

  if (
    results.some(
      (result) =>
        (result.winnerRikishiId === rikishiId &&
          result.winnerAbsent === true) ||
        (result.loserRikishiId === rikishiId && result.loserAbsent === true),
    )
  ) {
    return { rikishiId, outcome: "absent", score: 0 };
  }

  return { rikishiId, outcome: "loss", score: 0 };
}

function filterResultsForScoring(
  boutResults: readonly BoutResult[],
  options: ScoringOptions,
): BoutResult[] {
  return filterResultsThroughDay(boutResults, options).filter(
    (result) => result.winnerAbsent !== true,
  );
}

function filterResultsThroughDay(
  boutResults: readonly BoutResult[],
  options: ScoringOptions,
): BoutResult[] {
  return boutResults.filter(
    (result) =>
      options.throughDay === undefined || result.day <= options.throughDay,
  );
}
