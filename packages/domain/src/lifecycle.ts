import type { Basho, BashoStatus } from "./types.js";

export function canEditFantasyPicks(basho: Basho): boolean {
  return basho.status === "upcoming";
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

export function getPickLockMessage(basho: Basho): string | undefined {
  if (canEditFantasyPicks(basho)) {
    return undefined;
  }

  if (basho.status === "locked") {
    return "Picks are locked for this basho.";
  }

  if (basho.status === "active") {
    return "This basho has started, so picks are locked.";
  }

  return "This basho is complete, so picks are closed.";
}
