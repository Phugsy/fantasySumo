import type {
  BanzukeEntry,
  Basho,
  BoutResult,
  Rikishi,
} from "@fantasy-sumo/domain";
import type { Repositories } from "@fantasy-sumo/db";
import type {
  BanzukeImportCommand,
  BoutResultsImportCommand,
  ImportEntitySummary,
  ImportOptions,
  ImportResult,
  ImportSummary,
  ImportValidationIssue,
} from "./types.js";

export class ImportValidationError extends Error {
  constructor(readonly issues: ImportValidationIssue[]) {
    super("Import validation failed.");
  }
}

export async function importBanzuke(
  repositories: Repositories,
  command: BanzukeImportCommand,
  options: ImportOptions = {},
): Promise<ImportResult> {
  // Validate source-shaped data before any database write so failed imports
  // cannot leave the local game in a partly updated state.
  const issues = validateBanzukeImport(command);

  if (issues.length > 0) {
    throw new ImportValidationError(issues);
  }

  const summary = createEmptySummary();
  summary.basho = summarizeOne(
    await repositories.getBasho(command.basho.id),
    command.basho,
    isEqualBasho,
  );
  summary.rikishi = summarizeMany(
    await repositories.listRikishi(),
    command.rikishi,
    isEqualRikishi,
  );
  summary.banzuke = summarizeMany(
    await repositories.listBanzukeEntriesForBasho(command.basho.id),
    command.banzukeEntries,
    isEqualBanzukeEntry,
    { countDeleted: true },
  );

  if (options.dryRun !== true) {
    await repositories.applyBanzukeImport({
      basho: command.basho,
      rikishi: command.rikishi,
      banzukeEntries: command.banzukeEntries,
    });
  }

  return {
    dryRun: options.dryRun === true,
    source: command.source,
    summary,
  };
}

export async function importBoutResults(
  repositories: Repositories,
  command: BoutResultsImportCommand,
  options: ImportOptions = {},
): Promise<ImportResult> {
  // Result imports are scoped to one basho/day. Reimporting that day should
  // correct stale wins rather than append duplicate or outdated scoring rows.
  const issues = await validateBoutResultsImport(repositories, command);

  if (issues.length > 0) {
    throw new ImportValidationError(issues);
  }

  const summary = createEmptySummary();
  const existingBasho = await repositories.getBasho(command.bashoId);
  const existingRikishi = await repositories.listRikishi();
  const existingRikishiIds = new Set(
    existingRikishi.map((rikishi) => rikishi.id),
  );
  const missingSourceRikishi = (command.rikishi ?? []).filter(
    (rikishi) => !existingRikishiIds.has(rikishi.id),
  );
  const nextBasho =
    existingBasho === undefined
      ? undefined
      : advanceBashoForResults(existingBasho, command.results[0]?.day);

  if (nextBasho !== undefined) {
    summary.basho = summarizeOne(existingBasho, nextBasho, isEqualBasho);
  }

  summary.results = summarizeMany(
    (await repositories.listBoutResultsForBasho(command.bashoId)).filter(
      (result) => result.day === command.results[0]?.day,
    ),
    command.results,
    isEqualBoutResult,
    { countDeleted: true },
  );
  summary.rikishi = summarizeMany(
    existingRikishi,
    missingSourceRikishi,
    isEqualRikishi,
  );

  if (options.dryRun !== true) {
    if (nextBasho !== undefined) {
      await repositories.upsertBasho(nextBasho);
    }

    await repositories.applyBoutResultsImport({
      bashoId: command.bashoId,
      day: command.results[0]!.day,
      rikishi: missingSourceRikishi,
      results: command.results,
    });
  }

  return {
    dryRun: options.dryRun === true,
    source: command.source,
    summary,
  };
}

function validateBanzukeImport(
  command: BanzukeImportCommand,
): ImportValidationIssue[] {
  const issues: ImportValidationIssue[] = [];
  const rikishiIds = new Set(command.rikishi.map((rikishi) => rikishi.id));
  const banzukeRikishiIds = new Set<string>();
  const rankOrders = new Set<number>();

  if (command.basho.id.length === 0) {
    issues.push({ path: "basho.id", message: "Basho id is required." });
  }

  if (command.banzukeEntries.length === 0) {
    issues.push({
      path: "banzukeEntries",
      message: "Banzuke import must contain at least one banzuke entry.",
    });
  }

  for (const [index, entry] of command.banzukeEntries.entries()) {
    if (entry.bashoId !== command.basho.id) {
      issues.push({
        path: `banzukeEntries.${index}.bashoId`,
        message: "Banzuke entry basho id must match the imported basho.",
      });
    }

    if (!rikishiIds.has(entry.rikishiId)) {
      issues.push({
        path: `banzukeEntries.${index}.rikishiId`,
        message: `Rikishi ${entry.rikishiId} is not present in the import.`,
      });
    }

    if (banzukeRikishiIds.has(entry.rikishiId)) {
      issues.push({
        path: `banzukeEntries.${index}.rikishiId`,
        message: `Rikishi ${entry.rikishiId} appears more than once.`,
      });
    }
    banzukeRikishiIds.add(entry.rikishiId);

    if (rankOrders.has(entry.rankOrder)) {
      issues.push({
        path: `banzukeEntries.${index}.rankOrder`,
        message: `Rank order ${entry.rankOrder} appears more than once.`,
      });
    }
    rankOrders.add(entry.rankOrder);
  }

  return issues;
}

async function validateBoutResultsImport(
  repositories: Repositories,
  command: BoutResultsImportCommand,
): Promise<ImportValidationIssue[]> {
  const issues: ImportValidationIssue[] = [];
  const rikishiIds = new Set(
    (await repositories.listRikishi()).map((rikishi) => rikishi.id),
  );
  const importedRikishiIds = new Set(
    (command.rikishi ?? []).map((rikishi) => rikishi.id),
  );
  for (const rikishiId of importedRikishiIds) {
    rikishiIds.add(rikishiId);
  }
  const banzukeRikishiIds = new Set(
    (await repositories.listBanzukeEntriesForBasho(command.bashoId)).map(
      (entry) => entry.rikishiId,
    ),
  );
  const resultIds = new Set<string>();

  if ((await repositories.getBasho(command.bashoId)) === undefined) {
    issues.push({
      path: "bashoId",
      message: `Basho ${command.bashoId} does not exist.`,
    });
  }

  if (command.results.length === 0) {
    issues.push({
      path: "results",
      message: "Result import must contain at least one bout result.",
    });
  }

  for (const [index, result] of command.results.entries()) {
    if (result.bashoId !== command.bashoId) {
      issues.push({
        path: `results.${index}.bashoId`,
        message: "Result basho id must match the import target.",
      });
    }

    if (result.day < 1 || result.day > 15) {
      issues.push({
        path: `results.${index}.day`,
        message: "Result day must be between 1 and 15.",
      });
    }

    if (result.day !== command.results[0]?.day) {
      issues.push({
        path: `results.${index}.day`,
        message: "One result import can only replace a single basho day.",
      });
    }

    if (result.winnerRikishiId === result.loserRikishiId) {
      issues.push({
        path: `results.${index}`,
        message: "Winner and loser must be different rikishi.",
      });
    }

    const hasBanzukeRikishi =
      banzukeRikishiIds.has(result.winnerRikishiId) ||
      banzukeRikishiIds.has(result.loserRikishiId);

    for (const field of ["winnerRikishiId", "loserRikishiId"] as const) {
      const rikishiId = result[field];

      if (!rikishiIds.has(rikishiId)) {
        issues.push({
          path: `results.${index}.${field}`,
          message: `Rikishi ${rikishiId} does not exist.`,
        });
      } else if (
        !banzukeRikishiIds.has(rikishiId) &&
        !importedRikishiIds.has(rikishiId)
      ) {
        // Results must belong to rikishi on this basho's banzuke, not just
        // any known rikishi from another tournament. Source-provided rikishi
        // are allowed for cross-division bouts against the target banzuke.
        issues.push({
          path: `results.${index}.${field}`,
          message: `Rikishi ${rikishiId} is not on the basho banzuke.`,
        });
      }
    }

    if (!hasBanzukeRikishi) {
      issues.push({
        path: `results.${index}`,
        message: "At least one rikishi must be on the basho banzuke.",
      });
    }

    if (resultIds.has(result.id)) {
      issues.push({
        path: `results.${index}.id`,
        message: `Result ${result.id} appears more than once.`,
      });
    }
    resultIds.add(result.id);
  }

  return issues;
}

function createEmptySummary(): ImportSummary {
  return {
    basho: createEmptyEntitySummary(),
    rikishi: createEmptyEntitySummary(),
    banzuke: createEmptyEntitySummary(),
    results: createEmptyEntitySummary(),
  };
}

function createEmptyEntitySummary(): ImportEntitySummary {
  return {
    created: 0,
    updated: 0,
    skipped: 0,
    deleted: 0,
  };
}

function advanceBashoForResults(
  basho: Basho,
  importedDay: BoutResult["day"] | undefined,
): Basho {
  if (importedDay === undefined) {
    return basho;
  }

  return {
    ...basho,
    status: basho.status === "complete" ? "complete" : "active",
    currentDay: Math.max(basho.currentDay ?? 0, importedDay),
  };
}

function summarizeOne<T>(
  existing: T | undefined,
  next: T,
  isEqual: (left: T, right: T) => boolean,
): ImportEntitySummary {
  const summary = createEmptyEntitySummary();

  if (existing === undefined) {
    summary.created += 1;
  } else if (isEqual(existing, next)) {
    summary.skipped += 1;
  } else {
    summary.updated += 1;
  }

  return summary;
}

function summarizeMany<T extends { id: string }>(
  existingEntries: readonly T[],
  nextEntries: readonly T[],
  isEqual: (left: T, right: T) => boolean,
  options: { countDeleted?: boolean } = {},
): ImportEntitySummary {
  const summary = createEmptyEntitySummary();
  const existingById = new Map(
    existingEntries.map((entry) => [entry.id, entry]),
  );
  const nextIds = new Set(nextEntries.map((entry) => entry.id));

  for (const entry of nextEntries) {
    const existing = existingById.get(entry.id);

    if (existing === undefined) {
      summary.created += 1;
    } else if (isEqual(existing, entry)) {
      summary.skipped += 1;
    } else {
      summary.updated += 1;
    }
  }

  if (options.countDeleted === true) {
    for (const existing of existingEntries) {
      if (!nextIds.has(existing.id)) {
        summary.deleted += 1;
      }
    }
  }

  return summary;
}

function isEqualBasho(left: Basho, right: Basho) {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.startDate === right.startDate &&
    left.endDate === right.endDate &&
    left.status === right.status &&
    left.currentDay === right.currentDay
  );
}

function isEqualRikishi(left: Rikishi, right: Rikishi) {
  return (
    left.id === right.id &&
    left.shikona === right.shikona &&
    left.heya === right.heya
  );
}

function isEqualBanzukeEntry(left: BanzukeEntry, right: BanzukeEntry) {
  return (
    left.id === right.id &&
    left.bashoId === right.bashoId &&
    left.rikishiId === right.rikishiId &&
    left.rank === right.rank &&
    left.rankOrder === right.rankOrder
  );
}

function isEqualBoutResult(left: BoutResult, right: BoutResult) {
  return (
    left.id === right.id &&
    left.bashoId === right.bashoId &&
    left.day === right.day &&
    left.winnerRikishiId === right.winnerRikishiId &&
    left.loserRikishiId === right.loserRikishiId &&
    left.kimarite === right.kimarite &&
    left.winnerAbsent === right.winnerAbsent &&
    left.loserAbsent === right.loserAbsent
  );
}
