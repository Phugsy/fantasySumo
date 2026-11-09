import type { ScoreBreakdown, ScoringMode } from "./types.js";

// Immutable versioned presets. Existing identifiers must retain their weights.
const legacyWeights = { kinboshi: 2, kachiKoshi: 3, specialPrize: 1 } as const;
export const SCORING_PRESETS = {
  "wins-v0": {
    label: "One point per win",
    achievements: false,
    ...legacyWeights,
  },
  "achievements-v1": {
    label: "Wins + achievements",
    achievements: true,
    ...legacyWeights,
  },
  "achievements-v2": {
    label: "Wins + achievements · achievement focus",
    achievements: true,
    kinboshi: 3,
    kachiKoshi: 1,
    specialPrize: 3,
  },
} as const satisfies Record<
  ScoringMode,
  {
    label: string;
    achievements: boolean;
    kinboshi: number;
    kachiKoshi: number;
    specialPrize: number;
  }
>;

export function scoringPreset(mode: ScoringMode = "achievements-v1") {
  return SCORING_PRESETS[mode];
}

/** Reweight the server-derived categories without changing any official facts. */
export function projectScoreBreakdown(
  breakdown: ScoreBreakdown,
  source: ScoringMode,
  target: ScoringMode,
): ScoreBreakdown {
  const from = scoringPreset(source),
    to = scoringPreset(target);
  return {
    ...breakdown,
    kinboshi: (breakdown.kinboshi / from.kinboshi) * to.kinboshi,
    kachiKoshi: (breakdown.kachiKoshi / from.kachiKoshi) * to.kachiKoshi,
    outstandingPerformance:
      (breakdown.outstandingPerformance / from.specialPrize) * to.specialPrize,
    fightingSpirit:
      (breakdown.fightingSpirit / from.specialPrize) * to.specialPrize,
    technique: (breakdown.technique / from.specialPrize) * to.specialPrize,
    ...(breakdown.jokerKinboshi === undefined
      ? {}
      : {
          jokerKinboshi:
            (breakdown.jokerKinboshi / from.kinboshi) * to.kinboshi,
        }),
  };
}
