import { describe, expect, it } from "vitest";
import {
  defaultPreferences,
  parsePreferences,
  sortRikishi,
} from "./display-preferences";

describe("display preferences", () => {
  it("validates saved fields independently and falls back for corrupt or old data", () => {
    for (const value of [null, "no json", "null", "[]", '"dark"'])
      expect(parsePreferences(value)).toEqual(defaultPreferences);
    expect(
      parsePreferences('{"theme":"dark","order":"delete","photos":"true"}'),
    ).toEqual({ theme: "dark", order: "rank", photos: false });
    expect(
      parsePreferences('{"theme":"light","order":"score","photos":true}'),
    ).toEqual({ theme: "light", order: "score", photos: true });
  });

  it("uses persisted banzuke order, descending scores and stable name/identity ties without mutating", () => {
    const rows = [
      { id: "z", shikona: "Zulu", rankOrder: 2, score: 4 },
      { id: "b", shikona: "alpha", rankOrder: 1, score: 3 },
      { id: "a", shikona: "Alpha", rankOrder: 1, score: 3 },
    ];
    expect(sortRikishi(rows, "rank").map((r) => r.id)).toEqual(["a", "b", "z"]);
    expect(sortRikishi(rows, "score").map((r) => r.id)).toEqual([
      "z",
      "a",
      "b",
    ]);
    expect(sortRikishi(rows, "name").map((r) => r.id)).toEqual(["a", "b", "z"]);
    expect(rows.map((r) => r.id)).toEqual(["z", "b", "a"]);
  });
});
