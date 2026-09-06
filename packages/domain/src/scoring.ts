import type {
  BoutResult,
  FantasyPick,
  FantasyTeam,
  Rikishi,
  RikishiDayScore,
  RikishiScore,
  ScoringOptions,
  ScoreBreakdown,
  ScoringMode,
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

  const breakdown = calculateBreakdown(rikishiId, boutResults, options);
  return {
    rikishiId,
    wins,
    score:
      options.scoringMode === "achievements-v1"
        ? sumBreakdown(breakdown)
        : wins,
    ...(options.scoringMode === undefined ? {} : { breakdown }),
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
    ...(options.scoringMode === undefined
      ? {}
      : {
          breakdown: addBreakdowns(
            rikishiScores.map((score) => score.breakdown!),
          ),
        }),
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
    ...new Set([
      ...scoredResults.map((result) => result.day),
      ...(options.scoringMode !== undefined &&
      (options.throughDay ?? 15) >= 15 &&
      (options.specialPrizes?.length ?? 0) > 0
        ? [15]
        : []),
    ]),
  ].sort((left, right) => left - right);
  const teamPicks = picks.filter((pick) => pick.teamId === team.id);
  let cumulativeScore = 0;

  return scoredDays.map((day) => {
    const dayResults = scoredResults.filter((result) => result.day === day);
    const rikishiScores = teamPicks.map((pick) => {
      const outcome = calculateRikishiDayScore(pick.rikishiId, dayResults);
      if (options.scoringMode === undefined) return outcome;
      const current = calculateBreakdown(pick.rikishiId, scoredResults, {
        ...options,
        throughDay: day,
      });
      const previous = calculateBreakdown(pick.rikishiId, scoredResults, {
        ...options,
        throughDay: day - 1,
      });
      const breakdown = emptyBreakdown();
      for (const key of Object.keys(breakdown) as (keyof ScoreBreakdown)[]) {
        breakdown[key] = current[key] - previous[key];
      }
      return {
        ...outcome,
        breakdown,
        score:
          options.scoringMode === "achievements-v1"
            ? sumBreakdown(breakdown)
            : breakdown.wins,
      };
    });
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

function emptyBreakdown(): ScoreBreakdown {
  return {
    wins: 0,
    kinboshi: 0,
    kachiKoshi: 0,
    outstandingPerformance: 0,
    fightingSpirit: 0,
    technique: 0,
  };
}

function sumBreakdown(breakdown: ScoreBreakdown): number {
  return Object.values(breakdown).reduce((sum, value) => sum + value, 0);
}

function addBreakdowns(breakdowns: ScoreBreakdown[]): ScoreBreakdown {
  const total = emptyBreakdown();
  for (const breakdown of breakdowns) {
    for (const key of Object.keys(total) as (keyof ScoreBreakdown)[])
      total[key] += breakdown[key];
  }
  return total;
}

function calculateBreakdown(
  rikishiId: string,
  results: readonly BoutResult[],
  options: ScoringOptions,
): ScoreBreakdown {
  const breakdown = emptyBreakdown();
  const wins = filterResultsForScoring(results, options).filter(
    (result) => result.winnerRikishiId === rikishiId,
  );
  breakdown.wins = wins.length;
  // The import boundary enforces one regulation bout per rikishi per day.
  // Count distinct days for the milestone so a repeated fact cannot award it early.
  breakdown.kachiKoshi =
    new Set(wins.map((result) => result.day)).size >= 8 ? 3 : 0;
  const ranks = new Map(
    (options.banzukeEntries ?? []).map((entry) => [
      entry.rikishiId,
      entry.rank.trim().toLowerCase(),
    ]),
  );
  if (/^maegashira(?:\s|$)/.test(ranks.get(rikishiId) ?? "")) {
    breakdown.kinboshi =
      2 *
      new Set(
        wins
          .filter(
            (result) =>
              /^yokozuna(?:\s|$)/.test(
                ranks.get(result.loserRikishiId) ?? "",
              ) &&
              result.loserAbsent !== true &&
              result.kimarite?.trim().toLowerCase() !== "fusen",
          )
          .map((result) => result.day),
      ).size;
  }
  if ((options.throughDay ?? 15) >= 15) {
    const awards = new Set(
      (options.specialPrizes ?? [])
        .filter((award) => award.rikishiId === rikishiId)
        .map((award) => award.type),
    );
    breakdown.outstandingPerformance = awards.has("outstanding-performance")
      ? 1
      : 0;
    breakdown.fightingSpirit = awards.has("fighting-spirit") ? 1 : 0;
    breakdown.technique = awards.has("technique") ? 1 : 0;
  }
  return breakdown;
}

export function scoreBreakdownTotal(
  breakdown: ScoreBreakdown,
  mode: ScoringMode,
): number {
  return mode === "wins-v0" ? breakdown.wins : sumBreakdown(breakdown);
}
