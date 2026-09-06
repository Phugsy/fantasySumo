import type { Repositories } from "@fantasy-sumo/db";
import type { Basho, ScoringMode } from "@fantasy-sumo/domain";

export const CURRENT_SCORING_MODE = "wins-v0" as const;

export interface EffectiveBashoGameConfig {
  teamSize: number;
  teamSizeSource: "basho" | "default";
  scoringMode: ScoringMode;
  scoringLocked: boolean;
}

export async function getEffectiveBashoGameConfig(
  repositories: Repositories,
  bashoId: Basho["id"],
  defaultTeamSize: number,
): Promise<EffectiveBashoGameConfig> {
  const storedConfig = await repositories.getBashoGameConfig(bashoId);

  const scoring = await repositories.getBashoScoringConfig(bashoId);

  return {
    teamSize: storedConfig?.teamSize ?? defaultTeamSize,
    teamSizeSource: storedConfig === undefined ? "default" : "basho",
    scoringMode: scoring?.mode ?? CURRENT_SCORING_MODE,
    scoringLocked: scoring?.locked ?? true,
  };
}
