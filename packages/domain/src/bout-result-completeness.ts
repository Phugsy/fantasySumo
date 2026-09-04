import type { BoutResult, ScheduledBout } from "./types.js";

interface BoutResultCompletenessInput {
  boutResults: readonly BoutResult[];
  day: number;
  scheduledBouts: readonly ScheduledBout[];
  scheduledDayComplete?: boolean;
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
    .filter((bout) => bout.day === day)
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
export function hasBoutResultsForEveryDayThrough(
  boutResults: readonly BoutResult[],
  throughDay: number,
): boolean {
  const importedDays = new Set(boutResults.map((result) => result.day));

  for (let day = 1; day <= throughDay; day += 1) {
    if (!importedDays.has(day)) {
      return false;
    }
  }

  return true;
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
