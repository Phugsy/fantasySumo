import { describe, expect, it } from "vitest";
import type { BashoFantasyFinish } from "./fantasy-finish.js";
import { evaluatePlayerTitleAchievements } from "./player-achievements.js";

function finish(
  month: string,
  title: "yusho" | "junYusho",
): BashoFantasyFinish {
  const bashoId = `2026-${month}`;
  const owned = {
    teamId: `stable-${month}`,
    displayName: "My stable",
    score: 2,
  };
  const other = {
    teamId: `other-${month}`,
    displayName: "My stable",
    score: 3,
  };
  return {
    bashoId,
    bashoName: bashoId,
    startDate: `${bashoId}-01`,
    endDate: `${bashoId}-15`,
    outcome: {
      status: "confirmed",
      yusho: title === "yusho" ? [owned, { ...other, score: 2 }] : [other],
      junYusho: title === "junYusho" ? [owned] : [],
    },
  };
}

const ownedTeamIds = new Map(
  ["01", "03", "05", "07"].map((month) => [`2026-${month}`, `stable-${month}`]),
);

describe("evaluatePlayerTitleAchievements", () => {
  it("awards the three career prizes and first runner-up in tournament order", () => {
    const finishes = [
      finish("07", "yusho"),
      finish("05", "junYusho"),
      finish("03", "yusho"),
      finish("01", "yusho"),
    ];
    const badges = evaluatePlayerTitleAchievements(
      [...finishes, finishes[0]!],
      ownedTeamIds,
    );
    expect(
      badges.map(({ definition, earnedAt }) => [
        definition.id,
        earnedAt?.bashoId,
      ]),
    ).toEqual([
      ["emperors-cup", "2026-01"],
      ["rice-for-the-stable", "2026-03"],
      ["giant-fish", "2026-07"],
      ["first-runner-up", "2026-05"],
    ]);
  });

  it("recomputes progress from corrected, confirmed finishes for the owned teams", () => {
    const badges = evaluatePlayerTitleAchievements(
      [
        finish("01", "junYusho"),
        finish("03", "yusho"),
        {
          ...finish("05", "yusho"),
          outcome: { status: "pending", reason: "scoring-pending" },
        },
        {
          ...finish("07", "yusho"),
          outcome: { status: "ineligible", reason: "demo" },
        },
        finish("09", "yusho"),
      ],
      ownedTeamIds,
    );
    expect(
      badges.map(({ progress, earnedAt }) => [progress, earnedAt?.bashoId]),
    ).toEqual([
      [1, "2026-03"],
      [1, undefined],
      [1, undefined],
      [1, "2026-01"],
    ]);
  });
});
