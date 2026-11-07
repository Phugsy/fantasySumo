import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { getRikishiIllustration } from "./rikishi-illustrations.js";
import { rikishiIllustrations } from "./rikishi-illustration-catalog.js";

it("resolves every portrait through either verified provider namespace, including JSA-only newcomers", () => {
  expect(rikishiIllustrations).toHaveLength(42);
  expect(new Set(rikishiIllustrations.map((entry) => entry.jsaId)).size).toBe(
    42,
  );
  expect(
    new Set(rikishiIllustrations.map((entry) => entry.sumoApiId)).size,
  ).toBe(42);
  for (const entry of rikishiIllustrations) {
    for (const [source, sourceRikishiId] of [
      ["jsa", entry.jsaId],
      ["sumo-api", entry.sumoApiId],
    ] as const) {
      expect(
        getRikishiIllustration("renamed-canonical", false, [
          { source, sourceRikishiId, rikishiId: "renamed-canonical" },
        ]),
      ).toEqual({ url: entry.url });
    }
    const bytes = readFileSync(
      new URL(`../../web/public${entry.url}`, import.meta.url),
    );
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
    expect(entry.url).toContain(`-${hash}.webp`);
    expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
  }
});

it("never guesses from names, local IDs, another rikishi's alias, or conflicting identities", () => {
  expect(getRikishiIllustration("onosato", false, [])).toBeUndefined();
  expect(getRikishiIllustration("4227", false, [])).toBeUndefined();
  expect(
    getRikishiIllustration("canonical", false, [
      { source: "sumo-api", sourceRikishiId: "4227", rikishiId: "canonical" },
    ]),
  ).toBeUndefined();
  expect(
    getRikishiIllustration("canonical", false, [
      { source: "jsa", sourceRikishiId: "4227", rikishiId: "someone-else" },
    ]),
  ).toBeUndefined();
  expect(
    getRikishiIllustration("canonical", false, [
      { source: "jsa", sourceRikishiId: "4227", rikishiId: "canonical" },
      { source: "jsa", sourceRikishiId: "3842", rikishiId: "canonical" },
    ]),
  ).toBeUndefined();
});

it("isolates demo fixture identities from live aliases", () => {
  expect(getRikishiIllustration("onosato", true, [])?.url).toMatch(
    /^\/rikishi-illustrations\/4227-/,
  );
  expect(
    getRikishiIllustration("ura", true, [
      { source: "jsa", sourceRikishiId: "4227", rikishiId: "ura" },
    ]),
  ).toBeUndefined();
});
