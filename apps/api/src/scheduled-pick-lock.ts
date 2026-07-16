import { getFantasyPickLockDate, type Basho } from "@fantasy-sumo/domain";
import { DEMO_BASHO_ID, type Repositories } from "@fantasy-sumo/db";
import { formatJapanDate } from "./time.js";

export type ScheduledPickLockResult =
  | {
      status: "skipped";
      reason: "no-basho-due";
      japanDate: string;
    }
  | {
      status: "locked";
      bashoId: string;
      japanDate: string;
      lockedAt: string;
    };

interface ScheduledPickLockOptions {
  now?: () => Date;
}

export async function runScheduledPickLock(
  repositories: Repositories,
  options: ScheduledPickLockOptions = {},
): Promise<ScheduledPickLockResult> {
  const now = (options.now ?? (() => new Date()))();
  const japanDate = formatJapanDate(now);
  const eligibleBashos = (await repositories.listBashos()).filter((basho) =>
    isDueForPickLock(basho, japanDate),
  );

  if (eligibleBashos.length === 0) {
    return {
      status: "skipped",
      reason: "no-basho-due",
      japanDate,
    };
  }

  if (eligibleBashos.length > 1) {
    throw new Error(
      `Scheduled pick lock found multiple eligible bashos: ${eligibleBashos
        .map((basho) => basho.id)
        .join(", ")}.`,
    );
  }

  const basho = eligibleBashos[0]!;
  const lockedAt = now.toISOString();

  await repositories.lockBashoAndFantasyTeams(basho.id, lockedAt);

  return {
    status: "locked",
    bashoId: basho.id,
    japanDate,
    lockedAt,
  };
}

function isDueForPickLock(basho: Basho, japanDate: string) {
  if (basho.id === DEMO_BASHO_ID || basho.status !== "upcoming") {
    return false;
  }

  const lockDate = getFantasyPickLockDate(basho);

  return (
    lockDate !== undefined &&
    isDateOnly(basho.endDate) &&
    japanDate >= lockDate &&
    japanDate <= basho.endDate
  );
}

function isDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}
