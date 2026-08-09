import type { Basho, BashoStatus } from "./types.js";

export type BashoLifecycleAction = "open-picks" | "start" | "close";

export type BashoLifecycleTransition =
  | {
      allowed: true;
      changed: boolean;
      nextStatus: BashoStatus;
    }
  | {
      allowed: false;
      code: "demo-action-required" | "invalid-lifecycle-transition";
      message: string;
    };

export function canEditFantasyPicks(basho: Basho): boolean {
  return basho.status === "upcoming";
}

export function getBashoLifecycleTransition(
  basho: Basho,
  action: BashoLifecycleAction,
  options: { hasResults: boolean },
): BashoLifecycleTransition {
  if (basho.isDemo) {
    return {
      allowed: false,
      code: "demo-action-required",
      message:
        "Use the scoped demo controls to change the deterministic demo basho.",
    };
  }

  if (action === "open-picks") {
    if (basho.status === "upcoming") {
      return { allowed: true, changed: false, nextStatus: "upcoming" };
    }

    if (
      basho.status === "locked" &&
      (basho.currentDay ?? 0) === 0 &&
      !options.hasResults
    ) {
      return { allowed: true, changed: true, nextStatus: "upcoming" };
    }

    return {
      allowed: false,
      code: "invalid-lifecycle-transition",
      message:
        "Picks can only be reopened for a locked live basho that has not started and has no results.",
    };
  }

  if (action === "start") {
    if (basho.status === "active") {
      return { allowed: true, changed: false, nextStatus: "active" };
    }

    if (basho.status === "upcoming" || basho.status === "locked") {
      return { allowed: true, changed: true, nextStatus: "active" };
    }

    return {
      allowed: false,
      code: "invalid-lifecycle-transition",
      message: "A completed basho cannot be started again.",
    };
  }

  if (basho.status === "complete") {
    return { allowed: true, changed: false, nextStatus: "complete" };
  }

  if (basho.status === "active") {
    return { allowed: true, changed: true, nextStatus: "complete" };
  }

  return {
    allowed: false,
    code: "invalid-lifecycle-transition",
    message: "Only an active basho can be closed.",
  };
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
