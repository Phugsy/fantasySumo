import type {
  BanzukeEntry,
  BashoStatus,
  BoutResult,
  Rikishi,
  RikishiTournamentAchievement,
  RikishiTournamentNotes,
  RikishiTournamentStatus,
  ScheduledBout,
} from "./types.js";
import {
  hasBoutResultsForEveryDayThrough,
  hasCompleteBoutResultsForScheduledDay,
} from "./bout-result-completeness.js";

const WINNING_RECORD_THRESHOLD = 8;
const LOSING_RECORD_THRESHOLD = 8;
const FINAL_BASHO_DAY = 15;

interface TournamentNotesInput {
  banzukeEntries: readonly BanzukeEntry[];
  bashoStatus?: BashoStatus;
  boutResults: readonly BoutResult[];
  rikishiId: Rikishi["id"];
  scheduledBouts: readonly ScheduledBout[];
  finalDayScheduleComplete?: boolean;
  throughDay?: number;
}

/**
 * Builds informational tournament notes from facts already stored for a basho.
 * It does not participate in fantasy scoring.
 */
export function deriveRikishiTournamentNotes({
  banzukeEntries,
  bashoStatus,
  boutResults,
  rikishiId,
  scheduledBouts,
  finalDayScheduleComplete,
  throughDay,
}: TournamentNotesInput): RikishiTournamentNotes {
  const hasCompleteFinalDayResults = hasCompleteBoutResultsForScheduledDay({
    boutResults,
    day: FINAL_BASHO_DAY,
    scheduledBouts,
    scheduledDayComplete: finalDayScheduleComplete,
  });
  const hasCompleteEarlierResults = hasBoutResultsForEveryDayThrough(
    boutResults,
    FINAL_BASHO_DAY - 1,
  );
  const applicableResults = boutResults
    .filter(
      (result) =>
        (throughDay === undefined || result.day <= throughDay) &&
        (result.winnerRikishiId === rikishiId ||
          result.loserRikishiId === rikishiId),
    )
    .sort(compareByDayThenId);

  return {
    statuses: deriveCurrentStatuses(
      rikishiId,
      scheduledBouts,
      applicableResults,
    ),
    achievements: deriveAchievements(
      rikishiId,
      applicableResults,
      banzukeEntries,
      bashoStatus,
      throughDay,
      hasCompleteEarlierResults && hasCompleteFinalDayResults,
    ),
  };
}

function deriveCurrentStatuses(
  rikishiId: Rikishi["id"],
  scheduledBouts: readonly ScheduledBout[],
  applicableResults: readonly BoutResult[],
): RikishiTournamentStatus[] {
  const latestWithdrawalDay = scheduledBouts
    .filter((bout) => bout.withdrawnRikishiId === rikishiId)
    .reduce<
      number | undefined
    >((latest, bout) => (latest === undefined ? bout.day : Math.max(latest, bout.day)), undefined);

  if (latestWithdrawalDay === undefined) {
    return [];
  }

  const returnResult = applicableResults.find(
    (result) =>
      result.day > latestWithdrawalDay &&
      !isRikishiAbsentFromResult(rikishiId, result),
  );

  if (returnResult !== undefined) {
    return [
      {
        type: "returned",
        effectiveDay: returnResult.day,
        provenance: "derived",
      },
    ];
  }

  return [
    {
      type: "withdrawn",
      effectiveDay: latestWithdrawalDay,
      provenance: "source",
    },
  ];
}

function deriveAchievements(
  rikishiId: Rikishi["id"],
  applicableResults: readonly BoutResult[],
  banzukeEntries: readonly BanzukeEntry[],
  bashoStatus: BashoStatus | undefined,
  throughDay: number | undefined,
  hasCompleteFinalDayResults: boolean,
): RikishiTournamentAchievement[] {
  const rankByRikishiId = new Map(
    banzukeEntries.map((entry) => [entry.rikishiId, entry.rank]),
  );
  const achievements: RikishiTournamentAchievement[] = [];
  let wins = 0;
  let losses = 0;
  let recordSecured = false;

  for (const result of applicableResults) {
    const isWin =
      result.winnerRikishiId === rikishiId && result.winnerAbsent !== true;
    const isLoss = result.loserRikishiId === rikishiId;

    if (isWin) {
      wins += 1;

      if (
        !isDefaultWin(result) &&
        isMaegashira(rankByRikishiId.get(rikishiId)) &&
        isYokozuna(rankByRikishiId.get(result.loserRikishiId))
      ) {
        achievements.push({
          type: "gold-star",
          day: result.day,
          provenance: "derived",
        });
      }
    } else if (isLoss) {
      losses += 1;
    }

    if (!recordSecured && wins >= WINNING_RECORD_THRESHOLD) {
      achievements.push({
        type: "kachi-koshi",
        day: result.day,
        provenance: "derived",
      });
      recordSecured = true;
    } else if (!recordSecured && losses >= LOSING_RECORD_THRESHOLD) {
      achievements.push({
        type: "make-koshi",
        day: result.day,
        provenance: "derived",
      });
      recordSecured = true;
    }
  }

  if (
    !recordSecured &&
    bashoStatus === "complete" &&
    throughDay === FINAL_BASHO_DAY &&
    hasCompleteFinalDayResults
  ) {
    achievements.push({
      type: wins >= WINNING_RECORD_THRESHOLD ? "kachi-koshi" : "make-koshi",
      day: throughDay ?? FINAL_BASHO_DAY,
      provenance: "derived",
    });
  }

  return achievements;
}

function isDefaultWin(result: BoutResult): boolean {
  return (
    result.loserAbsent === true ||
    result.kimarite?.trim().toLowerCase() === "fusen"
  );
}

function isRikishiAbsentFromResult(
  rikishiId: Rikishi["id"],
  result: BoutResult,
): boolean {
  return (
    (result.winnerRikishiId === rikishiId && result.winnerAbsent === true) ||
    (result.loserRikishiId === rikishiId && result.loserAbsent === true)
  );
}

function isMaegashira(rank: string | undefined): boolean {
  return rank?.trim().toLowerCase().startsWith("maegashira") === true;
}

function isYokozuna(rank: string | undefined): boolean {
  return rank?.trim().toLowerCase().startsWith("yokozuna") === true;
}

function compareByDayThenId(left: BoutResult, right: BoutResult): number {
  return left.day - right.day || left.id.localeCompare(right.id);
}
