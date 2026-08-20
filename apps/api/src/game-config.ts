import type { Repositories } from "@fantasy-sumo/db";
import type { Basho } from "@fantasy-sumo/domain";

export const CURRENT_SCORING_MODE = "wins-v0" as const;

export interface EffectiveBashoGameConfig {
  teamSize: number;
  teamSizeSource: "basho" | "default";
  scoringMode: typeof CURRENT_SCORING_MODE;
}

export async function getEffectiveBashoGameConfig(
  repositories: Repositories,
  bashoId: Basho["id"],
  defaultTeamSize: number,
): Promise<EffectiveBashoGameConfig> {
  const storedConfig = await repositories.getBashoGameConfig(bashoId);

  return {
    teamSize: storedConfig?.teamSize ?? defaultTeamSize,
    teamSizeSource: storedConfig === undefined ? "default" : "basho",
    scoringMode: CURRENT_SCORING_MODE,
  };
}
