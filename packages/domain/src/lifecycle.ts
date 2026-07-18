import type { Basho, BashoStatus } from "./types.js";

export function canEditFantasyPicks(basho: Basho): boolean {
  return basho.status === "upcoming";
}

export function preserveBashoLifecycleProgress(
  existingBasho: Basho | undefined,
  importedBasho: Basho,
): Basho {
  if (existingBasho === undefined) {
    return importedBasho;
  }

  const lifecycleOrder = {
    upcoming: 0,
    locked: 1,
    active: 2,
    complete: 3,
  } as const;
  const existingDay = existingBasho.currentDay;
  const importedDay = importedBasho.currentDay;
  const currentDay =
    existingDay === undefined && importedDay === undefined
      ? undefined
      : Math.max(existingDay ?? 0, importedDay ?? 0);

  return {
    ...importedBasho,
    isDemo: existingBasho.isDemo,
    status:
      lifecycleOrder[existingBasho.status] >
      lifecycleOrder[importedBasho.status]
        ? existingBasho.status
        : importedBasho.status,
    ...(currentDay === undefined ? {} : { currentDay }),
  };
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
