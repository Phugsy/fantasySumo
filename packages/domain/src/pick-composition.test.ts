import { describe, expect, it } from "vitest";
import {
  classifySelectionRank,
  getPickCompositionMode,
  normalizeHeya,
  validatePickComposition,
  type PickCompositionEntry,
} from "./pick-composition.js";
import { validateFantasyPicks } from "./validation.js";

const roster: PickCompositionEntry[] = [
  { rikishiId: "y", rank: "Yokozuna East", heya: "Nishonoseki" },
  { rikishiId: "o", rank: "Ozeki 1 West", heya: "Sadogatake" },
  { rikishiId: "s", rank: "Sekiwake", heya: "Arashio" },
  { rikishiId: "m", rank: "Maegashira #10", heya: "Oitekaze" },
  { rikishiId: "n", rank: "Maegashira 12 East", heya: " Ōitekaze-beya " },
];

describe("pick composition", () => {
  it.each([
    "Yokozuna",
    "Ōzeki 1 East",
    "Sekiwake #2 West",
    "Komusubi West",
    "  ozeki  2  east ",
  ])("counts %s towards the same two-sanyaku cap", (rank) => {
    expect(classifySelectionRank(rank)).toBe("sanyaku");
  });
  it.each([
    "",
    "not Yokozuna",
    "Ozeki-ish",
    "Maegashira 0",
    "Juryo",
    "Unknown",
  ])("does not guess eligibility for %s", (rank) => {
    expect(classifySelectionRank(rank)).toBeUndefined();
  });
  it("accepts two sanyaku plus maegashira and rejects a third, independently of size", () => {
    expect(validatePickComposition(["y", "o", "m"], roster)).toEqual([]);
    expect(validatePickComposition(["y", "o", "s", "m"], roster)).toMatchObject(
      [{ code: "sanyaku-limit" }],
    );
    expect(validatePickComposition(["m"], roster)).toEqual([]);
    expect(
      validateFantasyPicks(
        ["y", "o", "s"].map((rikishiId) => ({ teamId: "t", rikishiId })),
        { teamSize: 4, compositionRoster: roster },
      ).map((error) => error.code),
    ).toEqual(["invalid-team-size", "sanyaku-limit"]);
  });
  it("normalizes equivalent heya labels across ranks", () => {
    for (const label of [
      "OITEKAZE",
      " Ōitekaze-beya ",
      "Oite-kaze heya",
      "Oitekaze stable",
    ]) {
      expect(normalizeHeya(label)).toBe("oitekaze");
      expect(
        validatePickComposition(
          ["y", "m"],
          [{ ...roster[0]!, heya: label }, roster[3]!],
        ),
      ).toMatchObject([{ code: "duplicate-heya" }]);
    }
    expect(validatePickComposition(["m", "n"], roster)).toMatchObject([
      { code: "duplicate-heya" },
    ]);
  });
  it.each([undefined, "", " ", "Unknown", "N/A", "---", "?"])(
    "rejects unavailable heya %s",
    (heya) => {
      expect(
        validatePickComposition(["y"], [{ ...roster[0]!, heya }]),
      ).toMatchObject([{ code: "invalid-selection-data" }]);
    },
  );
  it("rejects missing or ambiguous tournament facts and never falls back to globals", () => {
    expect(validatePickComposition(["absent"], roster)).toMatchObject([
      { code: "unknown-rikishi" },
    ]);
    expect(
      validatePickComposition(["y"], [...roster, roster[0]!]),
    ).toMatchObject([{ code: "invalid-selection-data" }]);
    expect(
      validatePickComposition(["y"], [{ ...roster[0]!, rank: "unknown" }]),
    ).toMatchObject([{ code: "invalid-selection-data" }]);
  });
  it("preserves duplicate-pick errors rather than double-counting heya or ranks", () => {
    expect(
      validateFantasyPicks(
        ["y", "y"].map((rikishiId) => ({ teamId: "t", rikishiId })),
        { compositionRoster: roster },
      ),
    ).toMatchObject([{ code: "duplicate-pick" }]);
  });
  it("uses a fixed rollout boundary independent of later imports or dates", () => {
    expect(getPickCompositionMode({ id: "2026-11", isDemo: false })).toBe(
      "open-v0",
    );
    for (const id of ["2027-01", "2027-03", "2028-11"])
      expect(getPickCompositionMode({ id, isDemo: false })).toBe(
        "heya-sanyaku-v1",
      );
    expect(getPickCompositionMode({ id: "demo-2026-05", isDemo: true })).toBe(
      "heya-sanyaku-v1",
    );
  });
});
