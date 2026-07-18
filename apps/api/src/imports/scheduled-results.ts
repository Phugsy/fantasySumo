import type { Basho } from "@fantasy-sumo/domain";
import { DEMO_BASHO_ID, type Repositories } from "@fantasy-sumo/db";
import { fetchSumoApiResultsImport } from "./adapters.js";
import { importBoutResults } from "./service.js";
import type { ImportResult, SourceFetch } from "./types.js";
import { formatJapanDate } from "../time.js";

const MILLISECONDS_PER_DAY = 86_400_000;

export type ScheduledResultsImportResult =
  | {
      status: "skipped";
      reason: "no-active-basho" | "outside-basho-window";
      bashoId?: string;
      japanDate: string;
    }
  | {
      status: "locked";
      bashoId: string;
      day: -1 | 0;
      japanDate: string;
      lockedAt: string;
    }
  | {
      status: "imported";
      bashoId: string;
      day: number;
      importedDays: number[];
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
  const now = (options.now ?? (() => new Date()))();
  const japanDate = formatJapanDate(now);
  const scheduledBashos = (await repositories.listBashos()).filter(
    (basho) =>
      (basho.status === "upcoming" ||
        basho.status === "locked" ||
        basho.status === "active") &&
      basho.id !== DEMO_BASHO_ID,
  );
  const eligibleBashos = scheduledBashos.flatMap((basho) => {
    const day = resolveBashoDay(basho, japanDate);

    if (day === undefined || !isEligibleForScheduledUpdate(basho, day)) {
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
      `Scheduled basho update found multiple eligible live bashos: ${eligibleBashos
        .map(({ basho }) => basho.id)
        .join(", ")}.`,
    );
  }

  const { basho, day } = eligibleBashos[0]!;

  if (day === -1 || day === 0) {
    const lockedAt = now.toISOString();

    await repositories.lockBashoAndFantasyTeams(basho.id, lockedAt);

    return {
      status: "locked",
      bashoId: basho.id,
      day,
      japanDate,
      lockedAt,
    };
  }

  if (basho.status === "upcoming") {
    await repositories.lockBashoAndFantasyTeams(basho.id, now.toISOString());
  }

  const storedResultDays = new Set(
    (await repositories.listBoutResultsForBasho(basho.id)).map(
      (result) => result.day,
    ),
  );
  const importedDays = Array.from(
    { length: day },
    (_value, index) => index + 1,
  ).filter(
    (importDay) => importDay === day || !storedResultDays.has(importDay),
  );
  let importResult: ImportResult | undefined;

  for (const importDay of importedDays) {
    const command = await fetchSumoApiResultsImport(sourceFetch, {
      bashoId: basho.id,
      day: importDay,
    });
    importResult = await importBoutResults(repositories, command);
  }

  if (importResult === undefined) {
    throw new Error(
      `Scheduled basho update resolved no import days for ${basho.id}.`,
    );
  }

  return {
    status: "imported",
    bashoId: basho.id,
    day,
    importedDays,
    japanDate,
    import: importResult,
  };
}

function isEligibleForScheduledUpdate(basho: Basho, day: number) {
  if (day === -1 || day === 0) {
    return basho.status === "upcoming";
  }

  return day >= 1;
}

function resolveBashoDay(basho: Basho, japanDate: string) {
  const currentDate = parseDateOnly(japanDate);
  const startDate = parseDateOnly(basho.startDate);
  const endDate = parseDateOnly(basho.endDate);

  if (
    currentDate === undefined ||
    startDate === undefined ||
    endDate === undefined ||
    currentDate < startDate - 2 * MILLISECONDS_PER_DAY
  ) {
    return undefined;
  }

  const finalDay = Math.floor((endDate - startDate) / MILLISECONDS_PER_DAY) + 1;

  if (currentDate > endDate) {
    return basho.status === "locked" || basho.status === "active"
      ? finalDay
      : undefined;
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
