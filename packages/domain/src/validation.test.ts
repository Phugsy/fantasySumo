import { describe, expect, it } from "vitest";
import { validateFantasyPicks } from "./validation.js";

describe("validateFantasyPicks", () => {
  it("accepts unique picks at the expected team size", () => {
    expect(
      validateFantasyPicks(
        [
          {
            teamId: "team-a",
            rikishiId: "onosato",
          },
          {
            teamId: "team-a",
            rikishiId: "kotozakura",
          },
        ],
        {
          teamSize: 2,
        },
      ),
    ).toEqual([]);
  });

  it("rejects duplicate picks", () => {
    expect(
      validateFantasyPicks([
        {
          teamId: "team-a",
          rikishiId: "onosato",
        },
        {
          teamId: "team-a",
          rikishiId: "onosato",
        },
      ]),
    ).toEqual([
      {
        code: "duplicate-pick",
        message: "Rikishi onosato has been picked more than once.",
        rikishiId: "onosato",
      },
    ]);
  });

  it("rejects an invalid team size", () => {
    expect(
      validateFantasyPicks(
        [
          {
            teamId: "team-a",
            rikishiId: "onosato",
          },
        ],
        {
          teamSize: 2,
        },
      ),
    ).toEqual([
      {
        code: "invalid-team-size",
        message: "Expected 2 picks, received 1.",
        expectedTeamSize: 2,
        actualTeamSize: 1,
      },
    ]);
  });
});
