import type { Basho } from "@fantasy-sumo/domain";
import { DEMO_BASHO_ID, type Repositories } from "@fantasy-sumo/db";
import { fetchSumoApiResultsImport } from "./adapters.js";
import { importBoutResults } from "./service.js";
import type { ImportResult, SourceFetch } from "./types.js";

const JAPAN_TIME_ZONE = "Asia/Tokyo";
const MILLISECONDS_PER_DAY = 86_400_000;

export type ScheduledResultsImportResult =
  | {
      status: "skipped";
      reason: "no-active-basho" | "outside-basho-window";
      bashoId?: string;
      japanDate: string;
    }
  | {
      status: "imported";
      bashoId: string;
      day: number;
      japanDate: string;
      import: ImportResult;
    };

interface ScheduledResultsImportOptions {
  now?: () => Date;
}

export async function runScheduledResultsImport(
  repositories: Repositories,
  sourceFetch: SourceFetch,
  options: ScheduledResultsImportOptions = {},
): Promise<ScheduledResultsImportResult> {
  const japanDate = formatDateInTimeZone(
    (options.now ?? (() => new Date()))(),
    JAPAN_TIME_ZONE,
  );
  const scheduledBashos = (await repositories.listBashos()).filter(
    (basho) =>
      (basho.status === "upcoming" ||
        basho.status === "locked" ||
        basho.status === "active") &&
      basho.id !== DEMO_BASHO_ID,
  );
  const eligibleBashos = scheduledBashos.flatMap((basho) => {
    const day = resolveBashoDay(basho, japanDate);

    if (day === undefined || (basho.status !== "active" && day !== 1)) {
      return [];
    }

    return [{ basho, day }];
  });

  if (eligibleBashos.length === 0) {
    if (scheduledBashos.length === 1) {
      return {
        status: "skipped",
        reason: "outside-basho-window",
        bashoId: scheduledBashos[0]!.id,
        japanDate,
      };
    }

    return {
      status: "skipped",
      reason: "no-active-basho",
      japanDate,
    };
  }

  if (eligibleBashos.length > 1) {
    throw new Error(
      `Scheduled results import found multiple eligible live bashos: ${eligibleBashos
        .map(({ basho }) => basho.id)
        .join(", ")}.`,
    );
  }

  const { basho, day } = eligibleBashos[0]!;

  const command = await fetchSumoApiResultsImport(sourceFetch, {
    bashoId: basho.id,
    day,
  });
  const importResult = await importBoutResults(repositories, command);

  return {
    status: "imported",
    bashoId: basho.id,
    day,
    japanDate,
    import: importResult,
  };
}

function resolveBashoDay(basho: Basho, japanDate: string) {
  const currentDate = parseDateOnly(japanDate);
  const startDate = parseDateOnly(basho.startDate);
  const endDate = parseDateOnly(basho.endDate);

  if (
    currentDate === undefined ||
    startDate === undefined ||
    endDate === undefined ||
    currentDate < startDate ||
    currentDate > endDate
  ) {
    return undefined;
  }

  return Math.floor((currentDate - startDate) / MILLISECONDS_PER_DAY) + 1;
}

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const parsed = Date.parse(`${value}T00:00:00.000Z`);

  return Number.isNaN(parsed) ? undefined : parsed;
}

function formatDateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}
