import type {
  BanzukeEntry,
  Basho,
  BoutResult,
  Rikishi,
  ScheduledBout,
} from "@fantasy-sumo/domain";
import {
  hasCompleteBoutResultsForEveryDayThrough,
  hasCompleteBoutResultsForScheduledDay,
  preserveBashoLifecycleProgress,
} from "@fantasy-sumo/domain";
import type {
  BoutResultsImportData,
  Repositories,
  ScheduledBoutsImportData,
} from "@fantasy-sumo/db";
import type {
  BanzukeImportCommand,
  BoutResultsImportCommand,
  ImportEntitySummary,
  ImportOptions,
  ImportResult,
  ImportSummary,
  ImportValidationIssue,
  ScheduledBoutsImportCommand,
} from "./types.js";
import {
  isCompleteScheduledBoutPublicationSource,
  toScheduledBoutPublicationSource,
} from "./types.js";

export class ImportValidationError extends Error {
  constructor(readonly issues: ImportValidationIssue[]) {
    super("Import validation failed.");
  }
}

interface BoutResultsImportOptions extends ImportOptions {
  completionSchedule?: Pick<
    ScheduledBoutsImportCommand,
    "bouts" | "isComplete"
  >;
  preserveExistingSnapshot?: boolean;
  preserveOmittedResults?: boolean;
}

interface PreparedBoutResultsImport {
  data: BoutResultsImportData;
  result: ImportResult;
}

interface PreparedScheduledBoutsImport {
  data: ScheduledBoutsImportData;
  preserveExistingCompleteCard: boolean;
  preserveExistingFullerSchedule: boolean;
  result: ImportResult;
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
  const existingBasho = await repositories.getBasho(command.basho.id);
  const nextBasho = preserveBashoLifecycleProgress(
    existingBasho,
    command.basho,
  );
  summary.basho = summarizeOne(existingBasho, nextBasho, isEqualBasho);
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
      basho: nextBasho,
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
  options: BoutResultsImportOptions = {},
): Promise<ImportResult> {
  const prepared = await prepareBoutResultsImport(
    repositories,
    command,
    options,
  );

  if (options.dryRun !== true) {
    await repositories.applyBoutResultsImport(prepared.data);
  }

  return prepared.result;
}

async function prepareBoutResultsImport(
  repositories: Repositories,
  command: BoutResultsImportCommand,
  options: BoutResultsImportOptions = {},
): Promise<PreparedBoutResultsImport> {
  // Result imports are scoped to one basho/day. Reimporting that day should
  // correct stale wins rather than append duplicate or outdated scoring rows.
  const issues = await validateBoutResultsImport(repositories, command);

  if (issues.length > 0) {
    throw new ImportValidationError(issues);
  }

  const summary = createEmptySummary();
  const existingBasho = await repositories.getBasho(command.bashoId);
  const existingBoutResults = await repositories.listBoutResultsForBasho(
    command.bashoId,
  );
  const existingImportedDayResults = existingBoutResults.filter(
    (result) => result.day === command.results[0]?.day,
  );
  const importedResults = options.preserveExistingSnapshot
    ? existingImportedDayResults
    : options.preserveOmittedResults === true
      ? mergeBoutResults(existingImportedDayResults, command.results)
      : command.results;
  const existingScheduledBouts = await repositories.listScheduledBoutsForBasho(
    command.bashoId,
  );
  const completeScheduleDays = new Set(
    (await repositories.listScheduledBoutPublicationsForBasho(command.bashoId))
      .filter((publication) =>
        isCompleteScheduledBoutPublicationSource(publication.source),
      )
      .map((publication) => publication.day),
  );
  const importedDay = command.results[0]?.day;
  const completionSchedule = options.completionSchedule;
  const completesImportedDay =
    importedDay === 15 &&
    options.preserveExistingSnapshot !== true &&
    completionSchedule?.isComplete === true &&
    hasCompleteBoutResultsForScheduledDay({
      boutResults: command.results,
      day: importedDay,
      scheduledBouts: completionSchedule.bouts,
      scheduledDayComplete: true,
    }) &&
    hasCompleteBoutResultsForEveryDayThrough({
      boutResults: [
        ...existingBoutResults.filter((result) => result.day !== importedDay),
        ...command.results,
      ],
      completeScheduleDays,
      scheduledBouts: existingScheduledBouts,
      throughDay: 14,
    });
  const existingRikishi = await repositories.listRikishi();
  const existingRikishiIds = new Set(
    existingRikishi.map((rikishi) => rikishi.id),
  );
  const missingSourceRikishi = (command.rikishi ?? []).filter(
    (rikishi) => !existingRikishiIds.has(rikishi.id),
  );
  const importedRikishi = options.preserveExistingSnapshot
    ? []
    : missingSourceRikishi;
  const nextBasho =
    existingBasho === undefined
      ? undefined
      : options.preserveExistingSnapshot
        ? existingBasho
        : advanceBashoForResults(
            existingBasho,
            importedDay,
            completesImportedDay,
          );

  if (nextBasho !== undefined) {
    summary.basho = summarizeOne(existingBasho, nextBasho, isEqualBasho);
  }

  summary.results = summarizeMany(
    existingImportedDayResults,
    importedResults,
    isEqualBoutResult,
    { countDeleted: true },
  );
  summary.rikishi = summarizeMany(
    existingRikishi,
    importedRikishi,
    isEqualRikishi,
  );

  const data: BoutResultsImportData = {
    ...(nextBasho === undefined ? {} : { basho: nextBasho }),
    bashoId: command.bashoId,
    day: command.results[0]!.day,
    rikishi: importedRikishi,
    results: importedResults,
  };

  return {
    data,
    result: {
      dryRun: options.dryRun === true,
      source: command.source,
      summary,
    },
  };
}

export async function importScheduledBouts(
  repositories: Repositories,
  command: ScheduledBoutsImportCommand,
  options: ImportOptions = {},
): Promise<ImportResult> {
  const prepared = await prepareScheduledBoutsImport(
    repositories,
    command,
    options,
  );

  if (options.dryRun !== true) {
    const outcome = await repositories.applyScheduledBoutsImport(prepared.data);

    if (outcome !== "applied") {
      return (await prepareScheduledBoutsImport(repositories, command, options))
        .result;
    }
  }

  return prepared.result;
}

async function prepareScheduledBoutsImport(
  repositories: Repositories,
  command: ScheduledBoutsImportCommand,
  options: ImportOptions = {},
): Promise<PreparedScheduledBoutsImport> {
  const issues = await validateScheduledBoutsImport(repositories, command);

  if (issues.length > 0) {
    throw new ImportValidationError(issues);
  }

  const summary = createEmptySummary();
  const existingScheduledBouts = (
    await repositories.listScheduledBoutsForBasho(command.bashoId)
  ).filter((bout) => bout.day === command.day);
  const existingPublication = (
    await repositories.listScheduledBoutPublicationsForBasho(command.bashoId)
  ).find((publication) => publication.day === command.day);
  const preserveExistingCompleteCard =
    existingPublication !== undefined &&
    isCompleteScheduledBoutPublicationSource(existingPublication.source) &&
    command.isComplete !== true;
  const existingScheduledBoutsById = new Map(
    existingScheduledBouts.map((bout) => [bout.id, bout]),
  );
  const isPartialSubset =
    existingPublication !== undefined &&
    command.isComplete !== true &&
    command.bouts.length > 0 &&
    existingScheduledBouts.length > command.bouts.length &&
    command.bouts.every((bout) => existingScheduledBoutsById.has(bout.id));
  if (
    isPartialSubset &&
    !command.bouts.every((bout) =>
      isEqualScheduledBout(existingScheduledBoutsById.get(bout.id)!, bout),
    )
  ) {
    throw new ImportValidationError([
      {
        path: "bouts",
        message:
          "A partial schedule conflicts with stored matchups; retry when the complete card is available.",
      },
    ]);
  }
  const preserveExistingFullerSchedule = isPartialSubset;
  const preserveExistingSchedule =
    preserveExistingCompleteCard || preserveExistingFullerSchedule;
  const importedBouts = preserveExistingSchedule
    ? existingScheduledBouts
    : command.bouts;
  const existingRikishi = await repositories.listRikishi();
  const existingRikishiIds = new Set(
    existingRikishi.map((rikishi) => rikishi.id),
  );
  const missingSourceRikishi = preserveExistingSchedule
    ? []
    : (command.rikishi ?? []).filter(
        (rikishi) => !existingRikishiIds.has(rikishi.id),
      );
  summary.scheduledBouts = summarizeMany(
    existingScheduledBouts,
    importedBouts,
    isEqualScheduledBout,
    { countDeleted: true },
  );
  summary.rikishi = summarizeMany(
    existingRikishi,
    missingSourceRikishi,
    isEqualRikishi,
  );

  const data: ScheduledBoutsImportData = {
    publication: {
      id: `${command.bashoId}-day-${command.day}-schedule`,
      bashoId: command.bashoId,
      day: command.day,
      source: toScheduledBoutPublicationSource(command),
      publishedAt: new Date().toISOString(),
    },
    rikishi: preserveExistingSchedule ? [] : missingSourceRikishi,
    bouts: command.bouts,
  };

  return {
    data,
    preserveExistingCompleteCard,
    preserveExistingFullerSchedule,
    result: {
      dryRun: options.dryRun === true,
      source: command.source,
      summary,
    },
  };
}

/**
 * Validates and prepares a final-day schedule and its results before applying
 * both in one repository transaction.
 */
export async function importScheduledBoutsAndBoutResults(
  repositories: Repositories,
  scheduleCommand: ScheduledBoutsImportCommand,
  resultsCommand: BoutResultsImportCommand,
  options: ImportOptions = {},
): Promise<ImportResult> {
  const commandPairIssues: ImportValidationIssue[] = [];

  if (
    scheduleCommand.bashoId !== resultsCommand.bashoId ||
    scheduleCommand.day !== resultsCommand.results[0]?.day
  ) {
    commandPairIssues.push({
      path: "schedule",
      message: "Schedule and result imports must target the same basho day.",
    });
  } else if (scheduleCommand.isComplete !== true) {
    commandPairIssues.push({
      path: "schedule.isComplete",
      message:
        "Result imports require a complete, attested schedule for the target day.",
    });
  } else if (
    !hasMatchingScheduledBoutsAndResults(scheduleCommand, resultsCommand)
  ) {
    commandPairIssues.push({
      path: "schedule.bouts",
      message:
        "Schedule and result imports must describe the same set of matchups.",
    });
  }

  if (commandPairIssues.length > 0) {
    throw new ImportValidationError(commandPairIssues);
  }

  if (options.expectedBanzukeRikishiIds !== undefined) {
    const importedDay = scheduleCommand.day;
    const [existingResults, existingSchedules, existingPublications] =
      await Promise.all([
        repositories.listBoutResultsForBasho(scheduleCommand.bashoId),
        repositories.listScheduledBoutsForBasho(scheduleCommand.bashoId),
        repositories.listScheduledBoutPublicationsForBasho(
          scheduleCommand.bashoId,
        ),
      ]);
    const previousDaysComplete = hasCompleteBoutResultsForEveryDayThrough({
      boutResults: existingResults,
      completeScheduleDays: new Set(
        existingPublications
          .filter((publication) =>
            isCompleteScheduledBoutPublicationSource(publication.source),
          )
          .map((publication) => publication.day),
      ),
      scheduledBouts: existingSchedules,
      throughDay: importedDay - 1,
    });

    if (!previousDaysComplete) {
      throw new ImportValidationError([
        {
          path: "schedule.day",
          message: `Cannot import day ${importedDay} before every earlier day is complete.`,
        },
      ]);
    }
  }

  let schedule = await prepareScheduledBoutsImport(
    repositories,
    scheduleCommand,
    options,
  );
  let results = await prepareBoutResultsImport(repositories, resultsCommand, {
    ...options,
    completionSchedule: scheduleCommand,
    preserveExistingSnapshot: schedule.preserveExistingCompleteCard,
  });

  if (options.dryRun !== true) {
    const outcome = await repositories.applyScheduledBoutsAndBoutResultsImport({
      scheduledBouts: schedule.data,
      boutResults: results.data,
      expectedBanzukeRikishiIds: options.expectedBanzukeRikishiIds,
    });

    if (outcome !== "applied") {
      const preparedWithKnownSchedule = schedule;
      schedule = await prepareScheduledBoutsImport(
        repositories,
        scheduleCommand,
        options,
      );
      if (
        outcome === "preserved-existing-complete" ||
        !preparedWithKnownSchedule.preserveExistingFullerSchedule
      ) {
        results = await prepareBoutResultsImport(repositories, resultsCommand, {
          ...options,
          completionSchedule: scheduleCommand,
          preserveExistingSnapshot: outcome === "preserved-existing-complete",
          preserveOmittedResults:
            outcome === "preserved-existing-fuller-schedule",
        });
      }
    }
  }

  return {
    ...results.result,
    summary: {
      ...results.result.summary,
      scheduledBouts: schedule.result.summary.scheduledBouts,
    },
  };
}

function hasMatchingScheduledBoutsAndResults(
  scheduleCommand: ScheduledBoutsImportCommand,
  resultsCommand: BoutResultsImportCommand,
): boolean {
  const scheduledMatchups = scheduleCommand.bouts
    .filter((bout) => bout.status === "scheduled")
    .map((bout) => matchupKey(bout.eastRikishiId, bout.westRikishiId))
    .sort();
  const resultMatchups = resultsCommand.results
    .map((result) => matchupKey(result.winnerRikishiId, result.loserRikishiId))
    .sort();

  return (
    scheduledMatchups.length === resultMatchups.length &&
    scheduledMatchups.every(
      (matchup, index) => matchup === resultMatchups[index],
    )
  );
}

function matchupKey(firstRikishiId: string, secondRikishiId: string): string {
  return [firstRikishiId, secondRikishiId].sort().join("\u0000");
}

function mergeBoutResults(
  existingResults: readonly BoutResult[],
  incomingResults: readonly BoutResult[],
): BoutResult[] {
  const incomingIds = new Set(incomingResults.map((result) => result.id));

  return [
    ...existingResults.filter((result) => !incomingIds.has(result.id)),
    ...incomingResults,
  ];
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

async function validateScheduledBoutsImport(
  repositories: Repositories,
  command: ScheduledBoutsImportCommand,
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
  const boutIds = new Set<string>();
  const scheduledRikishiIds = new Set<string>();

  if ((await repositories.getBasho(command.bashoId)) === undefined) {
    issues.push({
      path: "bashoId",
      message: `Basho ${command.bashoId} does not exist.`,
    });
  }

  if (command.day < 1 || command.day > 15) {
    issues.push({
      path: "day",
      message: "Schedule day must be between 1 and 15.",
    });
  }

  for (const [index, bout] of command.bouts.entries()) {
    if (bout.bashoId !== command.bashoId) {
      issues.push({
        path: `bouts.${index}.bashoId`,
        message: "Scheduled bout basho id must match the import target.",
      });
    }

    if (bout.day !== command.day) {
      issues.push({
        path: `bouts.${index}.day`,
        message: "One schedule import can only replace a single basho day.",
      });
    }

    if (bout.eastRikishiId === bout.westRikishiId) {
      issues.push({
        path: `bouts.${index}`,
        message: "A scheduled bout must contain two different rikishi.",
      });
    }

    const participantIds = [bout.eastRikishiId, bout.westRikishiId];
    if (!participantIds.some((id) => banzukeRikishiIds.has(id))) {
      issues.push({
        path: `bouts.${index}`,
        message: "At least one scheduled rikishi must be on the basho banzuke.",
      });
    }

    for (const [side, rikishiId] of [
      ["eastRikishiId", bout.eastRikishiId],
      ["westRikishiId", bout.westRikishiId],
    ] as const) {
      if (!rikishiIds.has(rikishiId)) {
        issues.push({
          path: `bouts.${index}.${side}`,
          message: `Rikishi ${rikishiId} does not exist.`,
        });
      } else if (
        !banzukeRikishiIds.has(rikishiId) &&
        !importedRikishiIds.has(rikishiId)
      ) {
        issues.push({
          path: `bouts.${index}.${side}`,
          message: `Rikishi ${rikishiId} is not on the basho banzuke.`,
        });
      }

      if (scheduledRikishiIds.has(rikishiId)) {
        issues.push({
          path: `bouts.${index}.${side}`,
          message: `Rikishi ${rikishiId} appears in more than one scheduled bout.`,
        });
      }
      scheduledRikishiIds.add(rikishiId);
    }

    if (
      bout.withdrawnRikishiId !== undefined &&
      !participantIds.includes(bout.withdrawnRikishiId)
    ) {
      issues.push({
        path: `bouts.${index}.withdrawnRikishiId`,
        message: "A withdrawal must identify one of the scheduled rikishi.",
      });
    }

    if (boutIds.has(bout.id)) {
      issues.push({
        path: `bouts.${index}.id`,
        message: `Scheduled bout ${bout.id} appears more than once.`,
      });
    }
    boutIds.add(bout.id);
  }

  return issues;
}

function createEmptySummary(): ImportSummary {
  return {
    basho: createEmptyEntitySummary(),
    rikishi: createEmptyEntitySummary(),
    banzuke: createEmptyEntitySummary(),
    results: createEmptyEntitySummary(),
    scheduledBouts: createEmptyEntitySummary(),
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
  completesImportedDay: boolean,
): Basho {
  if (importedDay === undefined) {
    return basho;
  }

  return {
    ...basho,
    status:
      basho.status === "complete" ||
      (importedDay === 15 && completesImportedDay)
        ? "complete"
        : "active",
    currentDay:
      importedDay === 15 && !completesImportedDay
        ? (basho.currentDay ?? 0)
        : Math.max(basho.currentDay ?? 0, importedDay),
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
    left.isDemo === right.isDemo &&
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

function isEqualScheduledBout(left: ScheduledBout, right: ScheduledBout) {
  return (
    left.id === right.id &&
    left.bashoId === right.bashoId &&
    left.day === right.day &&
    left.eastRikishiId === right.eastRikishiId &&
    left.westRikishiId === right.westRikishiId &&
    left.status === right.status &&
    left.withdrawnRikishiId === right.withdrawnRikishiId
  );
}
