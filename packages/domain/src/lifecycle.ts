import type { Basho, BashoStatus } from "./types.js";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function getFantasyPickLockDate(basho: Basho): string | undefined {
  const startDate = parseDateOnly(basho.startDate);

  if (startDate === undefined) {
    return undefined;
  }

  return new Date(startDate - MILLISECONDS_PER_DAY).toISOString().slice(0, 10);
}

export function canEditFantasyPicks(
  basho: Basho,
  currentDate?: string,
): boolean {
  if (basho.status !== "upcoming") {
    return false;
  }

  if (currentDate === undefined) {
    return true;
  }

  const lockDate = getFantasyPickLockDate(basho);
  const parsedCurrentDate = parseDateOnly(currentDate);

  return (
    lockDate !== undefined &&
    parsedCurrentDate !== undefined &&
    currentDate < lockDate
  );
}

export function getBashoLifecycleLabel(status: BashoStatus): string {
  switch (status) {
    case "upcoming":
      return "Picks open";
    case "locked":
      return "Picks locked";
    case "active":
      return "Scoring in progress";
    case "complete":
      return "Final scores";
  }
}

export function getPickLockMessage(
  basho: Basho,
  currentDate?: string,
): string | undefined {
  if (canEditFantasyPicks(basho, currentDate)) {
    return undefined;
  }

  if (basho.status === "upcoming") {
    return "Picks closed the day before this basho starts.";
  }

  if (basho.status === "locked") {
    return "Picks are locked for this basho.";
  }

  if (basho.status === "active") {
    return "This basho has started, so picks are locked.";
  }

  return "This basho is complete, so picks are closed.";
}

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const parsed = Date.parse(`${value}T00:00:00.000Z`);

  return Number.isNaN(parsed) ? undefined : parsed;
}
