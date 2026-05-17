import type {
  FantasyPick,
  PickValidationError,
  PickValidationOptions,
  Rikishi,
} from "./types.js";

export function validateFantasyPicks(
  picks: readonly FantasyPick[],
  options: PickValidationOptions = {},
): PickValidationError[] {
  return [
    ...validateTeamSize(picks, options),
    ...validateDuplicatePicks(picks),
  ];
}

function validateTeamSize(
  picks: readonly FantasyPick[],
  options: PickValidationOptions,
): PickValidationError[] {
  if (options.teamSize === undefined || picks.length === options.teamSize) {
    return [];
  }

  return [
    {
      code: "invalid-team-size",
      message: `Expected ${options.teamSize} picks, received ${picks.length}.`,
      expectedTeamSize: options.teamSize,
      actualTeamSize: picks.length,
    },
  ];
}

function validateDuplicatePicks(
  picks: readonly FantasyPick[],
): PickValidationError[] {
  return findDuplicateRikishiIds(picks).map((rikishiId) => ({
    code: "duplicate-pick",
    message: `Rikishi ${rikishiId} has been picked more than once.`,
    rikishiId,
  }));
}

function findDuplicateRikishiIds(
  picks: readonly FantasyPick[],
): Rikishi["id"][] {
  const seen = new Set<Rikishi["id"]>();
  const duplicates = new Set<Rikishi["id"]>();

  for (const pick of picks) {
    if (seen.has(pick.rikishiId)) {
      duplicates.add(pick.rikishiId);
    }

    seen.add(pick.rikishiId);
  }

  return [...duplicates].sort();
}
