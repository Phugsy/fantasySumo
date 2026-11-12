import type { BashoFantasyFinish } from "./fantasy-finish.js";

const titleAchievements = [
  {
    id: "emperors-cup",
    name: "Emperor’s Cup",
    description: "Win your first fantasy basho.",
    artwork: "cup",
    title: "yusho",
    threshold: 1,
  },
  {
    id: "rice-for-the-stable",
    name: "Rice for the Stable",
    description: "Win two fantasy bashos.",
    artwork: "rice",
    title: "yusho",
    threshold: 2,
  },
  {
    id: "giant-fish",
    name: "Giant Fish",
    description: "Win three fantasy bashos.",
    artwork: "fish",
    title: "yusho",
    threshold: 3,
  },
  {
    id: "first-runner-up",
    name: "First Runner-up",
    description: "Finish runner-up in a fantasy basho.",
    artwork: "medal",
    title: "junYusho",
    threshold: 1,
  },
] as const;

export type PlayerAchievement = {
  definition: (typeof titleAchievements)[number];
  progress: number;
  earnedAt?: Pick<BashoFantasyFinish, "bashoId" | "bashoName">;
};

/** The caller supplies the player's owned team IDs, keyed by basho. */
export function evaluatePlayerTitleAchievements(
  finishes: readonly BashoFantasyFinish[],
  ownedTeamIds: ReadonlyMap<string, string>,
): PlayerAchievement[] {
  const titleFinishes: Record<"yusho" | "junYusho", BashoFantasyFinish[]> = {
    yusho: [],
    junYusho: [],
  };
  const seen = new Set<string>();
  for (const finish of [...finishes].sort(
    (left, right) =>
      left.startDate.localeCompare(right.startDate) ||
      left.bashoId.localeCompare(right.bashoId),
  )) {
    if (finish.outcome.status !== "confirmed" || seen.has(finish.bashoId)) {
      continue;
    }
    const teamId = ownedTeamIds.get(finish.bashoId);
    if (teamId === undefined) continue;
    seen.add(finish.bashoId);
    for (const title of ["yusho", "junYusho"] as const) {
      if (
        finish.outcome[title].some((recipient) => recipient.teamId === teamId)
      ) {
        titleFinishes[title].push(finish);
      }
    }
  }

  return titleAchievements.map((definition) => {
    const matches = titleFinishes[definition.title];
    const finish = matches[definition.threshold - 1];
    return {
      definition,
      progress: Math.min(matches.length, definition.threshold),
      ...(finish && {
        earnedAt: { bashoId: finish.bashoId, bashoName: finish.bashoName },
      }),
    };
  });
}
