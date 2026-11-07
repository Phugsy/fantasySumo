import type { BanzukeEntry, Basho, PickValidationError } from "./types.js";

export type PickCompositionMode = "open-v0" | "heya-sanyaku-v1";
export type PickCompositionEntry = Pick<
  BanzukeEntry,
  "rikishiId" | "rank" | "heya"
>;

/** Roll out by immutable tournament ID, never by wall clock or import date. */
export function getPickCompositionMode(
  basho: Pick<Basho, "id" | "isDemo">,
): PickCompositionMode {
  return basho.isDemo ||
    (/^\d{4}-(01|03|05|07|09|11)$/.test(basho.id) && basho.id >= "2027-01")
    ? "heya-sanyaku-v1"
    : "open-v0";
}

function normalizedText(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** Accept the full English rank formats used by JSA, Sumo API and fixtures. */
export function classifySelectionRank(
  rank: string,
): "sanyaku" | "maegashira" | undefined {
  const match =
    /^(yokozuna|ozeki|sekiwake|komusubi|maegashira)(?:\s+#?[1-9]\d*)?(?:\s+(?:east|west))?$/.exec(
      normalizedText(rank).replace(/\s+/g, " "),
    );
  if (match === null) return undefined;
  return match[1] === "maegashira" ? "maegashira" : "sanyaku";
}

/** Formatting aliases only; do not guess at translations or historical mergers. */
export function normalizeHeya(heya: string | undefined): string | undefined {
  if (heya === undefined) return undefined;
  const key = normalizedText(heya)
    .replace(/(?:[\s-]*(?:beya|heya|stable)|部屋)$/u, "")
    .replace(/[\s\p{Pd}]/gu, "");
  return !key ||
    /^(unknown|unavailable|none|null|na|n\/a|tbd|\?+|-+)$/u.test(key)
    ? undefined
    : key;
}

export function validatePickComposition(
  rikishiIds: readonly string[],
  roster: readonly PickCompositionEntry[],
): PickValidationError[] {
  const errors: PickValidationError[] = [];
  const seenHeya = new Set<string>();
  let sanyaku = 0;
  for (const rikishiId of new Set(rikishiIds)) {
    const entries = roster.filter((entry) => entry.rikishiId === rikishiId);
    const entry = entries[0];
    if (entry === undefined) {
      errors.push({
        code: "unknown-rikishi",
        rikishiId,
        message: `Rikishi ${rikishiId} is not available for this basho.`,
      });
      continue;
    }
    const rank = classifySelectionRank(entry.rank);
    const heya = normalizeHeya(entry.heya);
    if (entries.length !== 1 || rank === undefined || heya === undefined) {
      errors.push({
        code: "invalid-selection-data",
        rikishiId,
        message: `Verified rank and heya are required to pick ${rikishiId}.`,
      });
      continue;
    }
    if (rank === "sanyaku") sanyaku += 1;
    if (seenHeya.has(heya)) {
      errors.push({
        code: "duplicate-heya",
        rikishiId,
        message: "Choose no more than one rikishi from each heya.",
      });
    }
    seenHeya.add(heya);
  }
  if (sanyaku > 2)
    errors.push({
      code: "sanyaku-limit",
      message:
        "Choose no more than two sanyaku (Yokozuna, Ozeki, Sekiwake or Komusubi).",
    });
  return errors;
}
