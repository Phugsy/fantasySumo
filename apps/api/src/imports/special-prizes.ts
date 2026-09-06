import { z } from "zod";
import type { Repositories, SpecialPrizeSnapshot } from "@fantasy-sumo/db";
import type { SpecialPrizeType } from "@fantasy-sumo/domain";
import type { SourceFetch } from "./types.js";
import { toCompactBashoId, toLocalRikishiId } from "./ids.js";

const prizeTypes = {
  "Shukun-sho": "outstanding-performance",
  "Kanto-sho": "fighting-spirit",
  "Gino-sho": "technique",
} as const satisfies Record<string, SpecialPrizeType>;
const payloadSchema = z.object({
  date: z.string(),
  yusho: z
    .array(z.object({ type: z.string() }))
    .refine((winners) => winners.some((winner) => winner.type === "Makuuchi")),
  specialPrizes: z.array(
    z.object({
      type: z.enum(["Shukun-sho", "Kanto-sho", "Gino-sho"]),
      rikishiId: z.number().int().positive(),
      shikonaEn: z.string().trim().min(1),
    }),
  ),
});

export type SpecialPrizeImportResult =
  | { status: "confirmed"; count: number; dryRun: boolean }
  | { status: "pending"; message: string };

export async function importSpecialPrizes(
  repositories: Repositories,
  sourceFetch: SourceFetch,
  bashoId: string,
  options: { dryRun?: boolean; now?: () => Date } = {},
): Promise<SpecialPrizeImportResult> {
  const basho = await repositories.getBasho(bashoId);
  if (!basho || basho.isDemo)
    throw new Error("Live prize imports require a live basho.");
  if (basho.status !== "complete")
    throw new Error("Special prizes require verified final results first.");
  const fetchedAt = (options.now ?? (() => new Date()))().toISOString();
  const response = await sourceFetch(
    `https://sumo-api.com/api/basho/${toCompactBashoId(bashoId)}`,
  );
  if (!response.ok)
    throw new Error(`Special-prize source returned HTTP ${response.status}.`);
  const payload = payloadSchema.parse(await response.json());
  if (payload.date !== toCompactBashoId(bashoId))
    throw new Error("Special-prize source basho does not match the target.");
  const banzuke = await repositories.listBanzukeEntriesForBasho(bashoId);
  const roster = new Set(banzuke.map((entry) => entry.rikishiId));
  const awards = payload.specialPrizes.map((prize) => ({
    type: prizeTypes[prize.type],
    rikishiId: toLocalRikishiId(prize.shikonaEn),
  }));
  const keys = new Set<string>();
  for (const award of awards) {
    const key = `${award.type}:${award.rikishiId}`;
    if (!roster.has(award.rikishiId) || keys.has(key))
      throw new Error(
        "Prize winner is unmatched or duplicated; no awards were changed.",
      );
    keys.add(key);
  }
  const snapshot: SpecialPrizeSnapshot = {
    bashoId,
    source: "sumo-api",
    fetchedAt,
    awards,
  };
  if (!options.dryRun) await repositories.replaceSpecialPrizeSnapshot(snapshot);
  return {
    status: "confirmed",
    count: awards.length,
    dryRun: options.dryRun ?? false,
  };
}

export async function attemptSpecialPrizeImport(
  repositories: Repositories,
  sourceFetch: SourceFetch,
  bashoId: string,
  options: { dryRun?: boolean; now?: () => Date } = {},
): Promise<SpecialPrizeImportResult> {
  try {
    return await importSpecialPrizes(
      repositories,
      sourceFetch,
      bashoId,
      options,
    );
  } catch (error) {
    return {
      status: "pending",
      message:
        error instanceof Error
          ? error.message
          : "Special prizes are unavailable.",
    };
  }
}
