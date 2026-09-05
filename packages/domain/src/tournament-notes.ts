import type {
  BanzukeEntry,
  BoutResult,
  Rikishi,
  RikishiTournamentAchievement,
  RikishiTournamentNotes,
  RikishiTournamentStatus,
  ScheduledBout,
} from "./types.js";

const WINNING_RECORD_THRESHOLD = 8;
const LOSING_RECORD_THRESHOLD = 8;
interface TournamentNotesInput {
  banzukeEntries: readonly BanzukeEntry[];
  boutResults: readonly BoutResult[];
  rikishiId: Rikishi["id"];
  scheduledBouts: readonly ScheduledBout[];
  /** Last contiguous day whose complete card and results were verified. */
  throughDay?: number;
}

/**
 * Builds informational tournament notes from facts already stored for a basho.
 * It does not participate in fantasy scoring.
 */
export function deriveRikishiTournamentNotes({
  banzukeEntries,
  boutResults,
  rikishiId,
  scheduledBouts,
  throughDay,
}: TournamentNotesInput): RikishiTournamentNotes {
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
      throughDay,
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
  throughDay: number | undefined,
): RikishiTournamentAchievement[] {
  const rankByRikishiId = new Map(
    banzukeEntries.map((entry) => [entry.rikishiId, entry.rank]),
  );
  const achievements: RikishiTournamentAchievement[] = [];
  let wins = 0;
  let recordSecured = false;

  const winsByDay = new Map<number, BoutResult>();
  for (const result of applicableResults) {
    if (result.winnerRikishiId === rikishiId && result.winnerAbsent !== true) {
      winsByDay.set(result.day, result);

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
    }
  }

  for (let day = 1; day <= (throughDay ?? 0); day += 1) {
    if (winsByDay.has(day)) {
      wins += 1;
    }

    const notWins = day - wins;
    if (!recordSecured && wins >= WINNING_RECORD_THRESHOLD) {
      achievements.push({
        type: "kachi-koshi",
        day,
        provenance: "derived",
      });
      recordSecured = true;
    } else if (!recordSecured && notWins >= LOSING_RECORD_THRESHOLD) {
      achievements.push({
        type: "make-koshi",
        day,
        provenance: "derived",
      });
      recordSecured = true;
    }
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
