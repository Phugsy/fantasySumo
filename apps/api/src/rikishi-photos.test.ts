import { expect, it } from "vitest";
import { getRikishiPhoto } from "./rikishi-photos.js";

it("uses established provider aliases rather than mutable names or untrusted local IDs", () => {
  expect(getRikishiPhoto("onosato", false, [])).toBeUndefined();
  expect(
    getRikishiPhoto("renamed-canonical", false, [
      {
        source: "sumo-api",
        sourceRikishiId: "8850",
        rikishiId: "renamed-canonical",
      },
    ]),
  ).toMatchObject({ author: "Nigtkn", license: "CC BY-SA 4.0" });
  expect(
    getRikishiPhoto("canonical", false, [
      { source: "jsa", sourceRikishiId: "8850", rikishiId: "canonical" },
    ]),
  ).toBeUndefined();
  expect(
    getRikishiPhoto("canonical", false, [
      { source: "sumo-api", sourceRikishiId: "99999", rikishiId: "canonical" },
    ]),
  ).toBeUndefined();
});
it("uses isolated local demo assets and a missing-photo fallback", () => {
  expect(getRikishiPhoto("onosato", true, [])?.url).toBe("/demo/rikishi.svg");
  expect(getRikishiPhoto("ura", true, [])).toBeUndefined();
});
