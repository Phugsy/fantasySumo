import type { Basho } from "./types";

export function canEditFantasyPicks(
  basho: Basho,
  teamLockedAt?: string,
): boolean {
  return basho.status === "upcoming" && teamLockedAt === undefined;
}

export function getBashoLifecycleLabel(status: Basho["status"]): string {
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
  teamLockedAt?: string,
): string | undefined {
  if (canEditFantasyPicks(basho, teamLockedAt)) {
    return undefined;
  }

  if (basho.status === "upcoming") {
    return "Picks are locked for this basho.";
  }

  if (basho.status === "locked") {
    return "Picks are locked for this basho.";
  }

  if (basho.status === "active") {
    return "This basho has started, so picks are locked.";
  }

  return "This basho is complete, so picks are closed.";
}
