import type { Repositories } from "@fantasy-sumo/db";
import { formatJapanDate } from "../time.js";
import { attemptPublishedScheduleImport } from "./daily-update.js";
import type { SourceFetch } from "./types.js";

const DAY = 86_400_000;

// Independent of results: a failed evening result import must not prevent the
// following morning's published card from being available before joker cutoff.
export async function runScheduledScheduleImport(
  repositories: Repositories,
  sourceFetch: SourceFetch,
  now: () => Date,
) {
  const japanDate = formatJapanDate(now());
  const date = Date.parse(japanDate + "T00:00:00.000Z");
  const candidates = (await repositories.listBashos()).filter((basho) => {
    const start = Date.parse(basho.startDate + "T00:00:00.000Z");
    const end = Date.parse(basho.endDate + "T00:00:00.000Z");
    return (
      !basho.isDemo &&
      basho.status !== "complete" &&
      date >= start - 2 * DAY &&
      date <= end
    );
  });
  if (candidates.length > 1)
    throw new Error("Schedule refresh found multiple eligible live bashos.");
  const basho = candidates[0];
  if (!basho)
    return {
      status: "skipped" as const,
      reason: "no-eligible-basho",
      japanDate,
    };
  const day = Math.max(
    1,
    Math.floor((date - Date.parse(basho.startDate + "T00:00:00.000Z")) / DAY) +
      1,
  );
  const lastDay = Math.min(
    15,
    Math.floor(
      (Date.parse(basho.endDate) - Date.parse(basho.startDate)) / DAY,
    ) + 1,
  );
  const resultDays = new Set(
    (await repositories.listBoutResultsForBasho(basho.id)).map(
      (result) => result.day,
    ),
  );
  const days = [day, day + 1].filter(
    (value) => value <= lastDay && !resultDays.has(value),
  );
  const schedules = [];
  for (const targetDay of days)
    schedules.push(
      await attemptPublishedScheduleImport(repositories, sourceFetch, {
        bashoId: basho.id,
        day: targetDay,
        division: "Makuuchi",
      }),
    );
  return {
    status: schedules.every((result) => result.status === "imported")
      ? ("complete" as const)
      : ("partial" as const),
    bashoId: basho.id,
    japanDate,
    schedules,
  };
}
