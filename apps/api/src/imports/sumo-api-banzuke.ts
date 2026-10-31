import { z } from "zod";
import { toCompactBashoId } from "./ids.js";
import type { BanzukeImportCommand, SourceFetch } from "./types.js";

const bashoIdSchema = z.string().regex(/^\d{4}-(01|03|05|07|09|11)$/);
const rankPattern =
  /^(Yokozuna|Ozeki|Sekiwake|Komusubi|Maegashira) ([1-9]\d*) (East|West)$/;
const rankBands = ["Yokozuna", "Ozeki", "Sekiwake", "Komusubi", "Maegashira"];
const rowSchema = z.object({
  rikishiID: z.number().int().positive(),
  shikonaEn: z.string().trim().min(1),
  rank: z.string().regex(rankPattern),
  rankValue: z.number().int().positive(),
  side: z.enum(["East", "West"]),
});
const banzukeSchema = z.object({
  bashoId: z.string(),
  division: z.literal("Makuuchi"),
  east: z.array(rowSchema).min(1),
  west: z.array(rowSchema).min(1),
});
const bashoSchema = z.object({
  date: z.string(),
  startDate: z.string(),
  endDate: z.string(),
});

export interface SumoApiBanzukeOptions {
  bashoId: string;
  now?: Date;
}

// This is an explicit backup, not a silent switch on arbitrary JSA errors.
// Requiring a target avoids importing a different tournament during an outage.
export async function fetchSumoApiBanzukeImport(
  sourceFetch: SourceFetch,
  options: SumoApiBanzukeOptions,
): Promise<BanzukeImportCommand> {
  bashoIdSchema.parse(options.bashoId);
  const base = `https://sumo-api.com/api/basho/${toCompactBashoId(options.bashoId)}`;
  const [basho, banzuke] = await Promise.all([
    fetchPayload(sourceFetch, base),
    fetchPayload(sourceFetch, `${base}/banzuke/Makuuchi`),
  ]);
  return mapSumoApiBanzukePayload(basho, banzuke, options);
}

export function mapSumoApiBanzukePayload(
  bashoPayload: unknown,
  banzukePayload: unknown,
  options: SumoApiBanzukeOptions,
): BanzukeImportCommand {
  const bashoId = bashoIdSchema.parse(options.bashoId);
  const sourceId = toCompactBashoId(bashoId);
  const basho = bashoSchema.parse(bashoPayload);
  const banzuke = banzukeSchema.parse(banzukePayload);
  if (basho.date !== sourceId || banzuke.bashoId !== sourceId) {
    throw new Error(
      "Sumo API banzuke and basho must match the requested tournament.",
    );
  }
  const startDate = sourceDate(basho.startDate);
  const endDate = sourceDate(basho.endDate);
  if (startDate.slice(0, 7) !== bashoId || endDate < startDate) {
    throw new Error(
      "Sumo API basho dates do not match the requested tournament.",
    );
  }

  const sourceIds = new Set<number>();
  const names = new Set<string>();
  const positions = new Set<string>();
  const rows = (["East", "West"] as const)
    .flatMap((side) =>
      banzuke[side === "East" ? "east" : "west"].map((row) => {
        const match = rankPattern.exec(row.rank)!;
        const expectedValue =
          (rankBands.indexOf(match[1]!) + 1) * 100 + Number(match[2]);
        if (
          row.side !== side ||
          match[3] !== side ||
          row.rankValue !== expectedValue
        ) {
          throw new Error(
            "Sumo API banzuke row has inconsistent rank or side.",
          );
        }
        const id = `sumo-api:${row.rikishiID}`;
        const name = row.shikonaEn.normalize("NFKC").trim().toLowerCase();
        const position = `${row.rankValue}-${side}`;
        if (
          sourceIds.has(row.rikishiID) ||
          names.has(name) ||
          positions.has(position)
        ) {
          throw new Error(
            "Sumo API banzuke contains duplicate or ambiguous identities/ranks.",
          );
        }
        sourceIds.add(row.rikishiID);
        names.add(name);
        positions.add(position);
        return { ...row, id };
      }),
    )
    .sort(
      (left, right) =>
        left.rankValue - right.rankValue || (left.side === "East" ? -1 : 1),
    );

  // Match the existing evening-before-day-0 lock: 20:00 JST two calendar
  // days before the first bout. Calendar metadata never establishes results.
  const lockAt = Date.parse(`${startDate}T00:00:00+09:00`) - 28 * 3_600_000;
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid import time.");
  const monthName = new Intl.DateTimeFormat("en", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${startDate}T00:00:00Z`));
  return {
    source: "sumo-api-banzuke",
    basho: {
      id: bashoId,
      isDemo: false,
      name: `${bashoId.slice(0, 4)} ${monthName} Grand Sumo Tournament`,
      startDate,
      endDate,
      status: now.getTime() < lockAt ? "upcoming" : "locked",
      currentDay: 0,
    },
    rikishi: rows.map((row) => ({
      id: row.id,
      shikona: row.shikonaEn,
      sourceIdentity: {
        source: "sumo-api",
        sourceRikishiId: String(row.rikishiID),
      },
    })),
    banzukeEntries: rows.map((row, index) => ({
      id: `${bashoId}-${row.id}`,
      bashoId,
      rikishiId: row.id,
      shikona: row.shikonaEn,
      rank: row.rank,
      rankOrder: index + 1,
    })),
  };
}

function sourceDate(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.000)?Z)?$/.exec(value);
  if (
    !match ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== match[1]
  ) {
    throw new Error("Sumo API basho contains an invalid calendar date.");
  }
  return match[1]!;
}

async function fetchPayload(
  sourceFetch: SourceFetch,
  url: string,
): Promise<unknown> {
  const response = await sourceFetch(url);
  if (!response.ok)
    throw new Error(
      `Sumo API banzuke source request failed with ${response.status}.`,
    );
  return response.json();
}
