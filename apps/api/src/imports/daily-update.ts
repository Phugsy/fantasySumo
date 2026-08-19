import type { Repositories } from "@fantasy-sumo/db";
import {
  fetchSumoApiResultsImport,
  fetchSumoApiScheduleImport,
  ScheduleUnavailableError,
} from "./adapters.js";
import { importBoutResults, importScheduledBouts } from "./service.js";
import type {
  ImportResult,
  SourceFetch,
  SumoApiResultsImportOptions,
} from "./types.js";

export type FollowingDayScheduleImportResult =
  | {
      status: "imported";
      day: number;
      import: ImportResult;
    }
  | {
      status: "unavailable" | "failed";
      day: number;
      message: string;
    }
  | {
      status: "not-applicable";
      reason: "final-basho-day";
    };

export type DailyUpdateImportResult = ImportResult & {
  status: "complete" | "partial";
  schedule: FollowingDayScheduleImportResult;
};

interface DailyUpdateImportOptions extends SumoApiResultsImportOptions {
  dryRun?: boolean;
}

export async function importDailyResultsAndFollowingSchedule(
  repositories: Repositories,
  sourceFetch: SourceFetch,
  options: DailyUpdateImportOptions,
): Promise<DailyUpdateImportResult> {
  const resultsCommand = await fetchSumoApiResultsImport(sourceFetch, options);
  const resultsImport = await importBoutResults(repositories, resultsCommand, {
    dryRun: options.dryRun,
  });
  const schedule = await attemptFollowingDayScheduleImport(
    repositories,
    sourceFetch,
    options,
  );

  return {
    ...resultsImport,
    status:
      schedule.status === "unavailable" || schedule.status === "failed"
        ? "partial"
        : "complete",
    schedule,
  };
}

async function attemptFollowingDayScheduleImport(
  repositories: Repositories,
  sourceFetch: SourceFetch,
  options: DailyUpdateImportOptions,
): Promise<FollowingDayScheduleImportResult> {
  if (options.day >= 15) {
    return {
      status: "not-applicable",
      reason: "final-basho-day",
    };
  }

  const day = options.day + 1;

  try {
    const scheduleCommand = await fetchSumoApiScheduleImport(sourceFetch, {
      bashoId: options.bashoId,
      day,
      division: options.division,
    });
    const scheduleImport = await importScheduledBouts(
      repositories,
      scheduleCommand,
      { dryRun: options.dryRun },
    );

    return {
      status: "imported",
      day,
      import: scheduleImport,
    };
  } catch (error) {
    return {
      status:
        error instanceof ScheduleUnavailableError ? "unavailable" : "failed",
      day,
      message:
        error instanceof Error
          ? error.message
          : `Following-day schedule import failed for ${options.bashoId} day ${day}.`,
    };
  }
}
