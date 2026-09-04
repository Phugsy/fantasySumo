import type { BoutResult, ScheduledBout } from "./types.js";

export interface BoutResultCompletenessInput {
  boutResults: readonly BoutResult[];
  day: number;
  scheduledBouts: readonly ScheduledBout[];
  scheduledDayComplete?: boolean;
}

interface BashoResultCompletenessInput {
  boutResults: readonly BoutResult[];
  completeScheduleDays: ReadonlySet<number>;
  scheduledBouts: readonly ScheduledBout[];
  throughDay: number;
}

interface ScheduledBoutResultInput {
  boutResults: readonly BoutResult[];
  scheduledBout: ScheduledBout;
}

/**
 * Confirms that every bout on a published card has a stored result.
 * A non-empty card or result payload alone is not evidence that the whole day
 * arrived, so callers must also supply an explicit card-completeness signal.
 */
export function hasCompleteBoutResultsForScheduledDay({
  boutResults,
  day,
  scheduledBouts,
  scheduledDayComplete,
}: BoutResultCompletenessInput): boolean {
  if (scheduledDayComplete !== true) {
    return false;
  }

  const expectedMatchups = scheduledBouts
    .filter((bout) => bout.day === day && bout.status === "scheduled")
    .map((bout) => matchupKey(bout.eastRikishiId, bout.westRikishiId));

  if (expectedMatchups.length === 0) {
    return false;
  }

  const completedMatchups = new Set(
    boutResults
      .filter((result) => result.day === day)
      .map((result) =>
        matchupKey(result.winnerRikishiId, result.loserRikishiId),
      ),
  );

  return expectedMatchups.every((matchup) => completedMatchups.has(matchup));
}

/** Confirms that every basho day through the supplied day has stored results. */
export function hasCompleteBoutResultsForEveryDayThrough({
  boutResults,
  completeScheduleDays,
  scheduledBouts,
  throughDay,
}: BashoResultCompletenessInput): boolean {
  for (let day = 1; day <= throughDay; day += 1) {
    if (
      !hasCompleteBoutResultsForScheduledDay({
        boutResults,
        day,
        scheduledBouts,
        scheduledDayComplete: completeScheduleDays.has(day),
      })
    ) {
      return false;
    }
  }

  return true;
}

/** Returns the last day in the contiguous, verified result history. */
export function getVerifiedBoutResultsThroughDay({
  boutResults,
  completeScheduleDays,
  scheduledBouts,
  throughDay,
}: BashoResultCompletenessInput): number {
  for (let day = 1; day <= throughDay; day += 1) {
    if (
      !hasCompleteBoutResultsForScheduledDay({
        boutResults,
        day,
        scheduledBouts,
        scheduledDayComplete: completeScheduleDays.has(day),
      })
    ) {
      return day - 1;
    }
  }

  return throughDay;
}

/** Checks whether a scheduled matchup already has a stored result. */
export function hasBoutResultForScheduledBout({
  boutResults,
  scheduledBout,
}: ScheduledBoutResultInput): boolean {
  const scheduledMatchup = matchupKey(
    scheduledBout.eastRikishiId,
    scheduledBout.westRikishiId,
  );

  return boutResults.some(
    (result) =>
      result.day === scheduledBout.day &&
      matchupKey(result.winnerRikishiId, result.loserRikishiId) ===
        scheduledMatchup,
  );
}

function matchupKey(firstRikishiId: string, secondRikishiId: string): string {
  return [firstRikishiId, secondRikishiId].sort().join("\0");
}
