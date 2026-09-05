import type {
  BanzukeEntry,
  Basho,
  BoutResult,
  PreviousBashoRecord,
  Rikishi,
} from "./types.js";

interface PreviousBashoRecordInput {
  basho: Basho;
  banzukeEntries: readonly BanzukeEntry[];
  boutResults: readonly BoutResult[];
  rikishiId: Rikishi["id"];
  totalDays: number;
}

export function findPreviousCompletedBasho(
  targetBasho: Basho,
  bashos: readonly Basho[],
): Basho | undefined {
  const targetStart = parseDate(targetBasho.startDate);

  if (targetStart === undefined) {
    return undefined;
  }

  return bashos
    .filter(
      (candidate) =>
        candidate.id !== targetBasho.id &&
        candidate.isDemo === targetBasho.isDemo &&
        candidate.status === "complete" &&
        isBefore(candidate.endDate, targetStart),
    )
    .sort(compareBashosLatestFirst)
    .at(0);
}

export function derivePreviousBashoRecord({
  basho,
  banzukeEntries,
  boutResults,
  rikishiId,
  totalDays,
}: PreviousBashoRecordInput): PreviousBashoRecord | undefined {
  if (
    basho.status !== "complete" ||
    !Number.isInteger(totalDays) ||
    totalDays < 1
  ) {
    return undefined;
  }

  const banzukeEntry = banzukeEntries.find(
    (entry) => entry.bashoId === basho.id && entry.rikishiId === rikishiId,
  );

  if (banzukeEntry === undefined) {
    return undefined;
  }

  let wins = 0;
  let losses = 0;
  const appearanceDays = new Set<number>();

  for (const result of boutResults) {
    if (
      result.bashoId !== basho.id ||
      result.day < 1 ||
      result.day > totalDays ||
      (result.winnerRikishiId !== rikishiId &&
        result.loserRikishiId !== rikishiId)
    ) {
      continue;
    }

    if (appearanceDays.has(result.day)) {
      return undefined;
    }
    appearanceDays.add(result.day);

    if (result.winnerRikishiId === rikishiId) {
      if (result.winnerAbsent !== true) {
        wins += 1;
      }
    } else if (result.loserAbsent !== true) {
      losses += 1;
    }
  }

  const decisions = wins + losses;

  if (decisions > totalDays) {
    return undefined;
  }

  return {
    bashoId: basho.id,
    bashoName: basho.name,
    startDate: basho.startDate,
    rank: banzukeEntry.rank,
    wins,
    losses,
    absences: totalDays - decisions,
  };
}

function compareBashosLatestFirst(left: Basho, right: Basho): number {
  return (
    (parseDate(right.endDate) ?? Number.NEGATIVE_INFINITY) -
      (parseDate(left.endDate) ?? Number.NEGATIVE_INFINITY) ||
    right.id.localeCompare(left.id)
  );
}

function isBefore(date: string, comparison: number): boolean {
  const parsed = parseDate(date);
  return parsed !== undefined && parsed < comparison;
}

function parseDate(date: string): number | undefined {
  const parsed = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed) ? undefined : parsed;
}
