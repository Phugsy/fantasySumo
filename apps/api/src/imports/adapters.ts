import type {
  SourceRikishi,
  BanzukeImportCommand,
  JsaBanzukeImportOptions,
  SourceFetch,
  SumoApiScheduleImportOptions,
  SumoApiResultsImportOptions,
  BoutResultsImportCommand,
  ScheduledBoutsImportCommand,
} from "./types.js";
import { toCompactBashoId, toLocalBashoId } from "./ids.js";

const JSA_BANZUKE_BASE_URL =
  "https://www.sumo.or.jp/EnHonbashoBanzuke/indexAjax";
const SUMO_API_BASE_URL = "https://sumo-api.com/api";

interface JsaBanzukePayload {
  BanzukeTable?: JsaBanzukeRow[];
  basho_name?: string;
  BashoInfo?: {
    start_date?: string;
    end_date?: string;
    today?: string;
    BattleNow?: number;
    basho_name_eng?: string;
    year_eng?: string;
  };
}

interface JsaBanzukeRow {
  banzuke_id?: number | string;
  banzuke_name?: string;
  rikishi_id?: number | string;
  shikona?: string;
  heya_name?: string;
}

interface SumoApiTorikumiPayload {
  torikumi?: SumoApiTorikumiRow[];
  yusho?: Array<{
    type?: string;
  }>;
}

interface SumoApiTorikumiRow {
  id?: string;
  bashoId?: string;
  day?: number;
  matchNo?: number;
  eastId?: number;
  eastShikona?: string;
  westId?: number;
  westShikona?: string;
  kimarite?: string;
  winnerId?: number;
  winnerEn?: string;
}

interface SumoApiBanzukePayload {
  bashoId?: string;
  division?: string;
  east?: SumoApiBanzukeRow[];
  west?: SumoApiBanzukeRow[];
}

interface SumoApiBanzukeRow {
  rikishiID?: number;
  shikonaEn?: string;
  record?: Array<{
    result?: string;
  }>;
}

export class ScheduleUnavailableError extends Error {
  constructor(bashoId: string, day: number) {
    super(
      `Sumo API schedule for ${bashoId} day ${day} is not published or unavailable.`,
    );
    this.name = "ScheduleUnavailableError";
  }
}

export async function fetchJsaBanzukeImport(
  fetchFn: SourceFetch,
  options: JsaBanzukeImportOptions = {},
): Promise<BanzukeImportCommand> {
  const divisionId = options.divisionId ?? 1;
  const page = options.page ?? 1;
  const payload = await fetchJson<JsaBanzukePayload>(
    fetchFn,
    `${JSA_BANZUKE_BASE_URL}/${divisionId}/${page}/`,
  );

  return mapJsaBanzukePayload(payload);
}

export function mapJsaBanzukePayload(
  payload: JsaBanzukePayload,
): BanzukeImportCommand {
  const startDate = payload.BashoInfo?.start_date;
  const endDate = payload.BashoInfo?.end_date;

  if (startDate === undefined || endDate === undefined) {
    throw new Error("JSA banzuke payload is missing basho dates.");
  }

  const bashoId = startDate.slice(0, 7);
  const rows = (payload.BanzukeTable ?? []).filter(isUsableJsaBanzukeRow);

  return {
    source: "jsa-banzuke",
    basho: {
      id: bashoId,
      isDemo: false,
      name: formatJsaBashoName(payload),
      startDate,
      endDate,
      status: resolveBashoStatus(payload),
      currentDay: resolveCurrentDay(payload),
    },
    rikishi: rows.map((row) => ({
      ...toSourceRikishi(String(row.shikona), "jsa", row.rikishi_id),
      shikona: String(row.shikona),
      ...(row.heya_name === undefined || row.heya_name === ""
        ? {}
        : { heya: String(row.heya_name) }),
    })),
    banzukeEntries: rows.map((row, index) => {
      const rikishiId = sourceRikishiId("jsa", row.rikishi_id);
      const rankOrder = Number(row.banzuke_id) || index + 1;

      return {
        id: `${bashoId}-${rikishiId}`,
        bashoId,
        rikishiId,
        shikona: String(row.shikona),
        ...(row.heya_name === undefined || row.heya_name === ""
          ? {}
          : { heya: String(row.heya_name) }),
        rank: String(row.banzuke_name),
        rankOrder,
      };
    }),
  };
}

export async function fetchSumoApiResultsImport(
  fetchFn: SourceFetch,
  options: SumoApiResultsImportOptions,
): Promise<BoutResultsImportCommand> {
  const division = options.division ?? "Makuuchi";
  const sourceBashoId = toCompactBashoId(options.bashoId);
  const payload = await fetchJson<SumoApiTorikumiPayload>(
    fetchFn,
    `${SUMO_API_BASE_URL}/basho/${sourceBashoId}/torikumi/${division}/${options.day}`,
  );

  return mapSumoApiTorikumiPayload(payload, {
    bashoId: options.bashoId,
    day: options.day,
  });
}

export async function fetchSumoApiDailyImport(
  fetchFn: SourceFetch,
  options: SumoApiResultsImportOptions,
): Promise<{
  scheduleCommand: ScheduledBoutsImportCommand;
  resultsCommand: BoutResultsImportCommand;
}> {
  const division = options.division ?? "Makuuchi";
  const sourceBashoId = toCompactBashoId(options.bashoId);
  const [torikumiPayload, banzukePayload] = await Promise.all([
    fetchJson<SumoApiTorikumiPayload>(
      fetchFn,
      `${SUMO_API_BASE_URL}/basho/${sourceBashoId}/torikumi/${division}/${options.day}`,
    ),
    fetchJson<unknown>(
      fetchFn,
      `${SUMO_API_BASE_URL}/basho/${sourceBashoId}/banzuke/${division}`,
    )
      .then(normalizeSumoApiBanzukePayload)
      .catch(() => undefined),
  ]);

  return {
    scheduleCommand: mapSumoApiSchedulePayload(
      torikumiPayload,
      options,
      banzukePayload,
    ),
    resultsCommand: mapSumoApiTorikumiPayload(torikumiPayload, options),
  };
}

export async function fetchSumoApiScheduleImport(
  fetchFn: SourceFetch,
  options: SumoApiScheduleImportOptions,
): Promise<ScheduledBoutsImportCommand> {
  const division = options.division ?? "Makuuchi";
  const sourceBashoId = toCompactBashoId(options.bashoId);
  const payload = await fetchJson<SumoApiTorikumiPayload>(
    fetchFn,
    `${SUMO_API_BASE_URL}/basho/${sourceBashoId}/torikumi/${division}/${options.day}`,
  );

  return mapSumoApiSchedulePayload(payload, options);
}

export function mapSumoApiSchedulePayload(
  payload: SumoApiTorikumiPayload,
  options: {
    bashoId: string;
    day: number;
    division?: string;
  },
  banzukePayload?: SumoApiBanzukePayload,
): ScheduledBoutsImportCommand {
  const rows = payload.torikumi ?? [];

  if (rows.length === 0) {
    throw new ScheduleUnavailableError(options.bashoId, options.day);
  }

  const participants = rows.flatMap((row) => [
    toSourceRikishi(
      requiredString(row.eastShikona, "eastShikona"),
      "sumo-api",
      row.eastId,
    ),
    toSourceRikishi(
      requiredString(row.westShikona, "westShikona"),
      "sumo-api",
      row.westId,
    ),
  ]);
  const division = options.division ?? "Makuuchi";
  const isComplete =
    banzukePayload !== undefined &&
    (banzukePayload.bashoId === undefined ||
      toLocalBashoId(banzukePayload.bashoId) === options.bashoId) &&
    (banzukePayload.division === undefined ||
      banzukePayload.division.trim().toLowerCase() ===
        division.trim().toLowerCase()) &&
    hasAttestedCompleteCard(rows, banzukePayload, options.day) &&
    (options.day < 15 ||
      payload.yusho?.some(
        (winner) => winner.type?.toLowerCase() === division.toLowerCase(),
      ) === true);

  return {
    source: "sumo-api-schedule",
    bashoId: options.bashoId,
    day: options.day,
    ...(isComplete ? { isComplete: true } : {}),
    ...(isComplete
      ? {
          attestedRikishiIds: [
            ...(banzukePayload?.east ?? []),
            ...(banzukePayload?.west ?? []),
          ].map((row) => sourceRikishiId("sumo-api", row.rikishiID)),
        }
      : {}),
    rikishi: uniqueRikishi([
      ...participants,
      ...(isComplete
        ? [
            ...(banzukePayload?.east ?? []),
            ...(banzukePayload?.west ?? []),
          ].map((row) =>
            toSourceRikishi(
              requiredString(row.shikonaEn, "shikonaEn"),
              "sumo-api",
              row.rikishiID,
            ),
          )
        : []),
    ]),
    bouts: rows.map((row, index) => {
      const matchNo = row.matchNo ?? index + 1;

      return {
        id: `${options.bashoId}-day-${options.day}-match-${matchNo}`,
        bashoId: toLocalBashoId(row.bashoId ?? options.bashoId),
        day: row.day ?? options.day,
        eastRikishiId: sourceRikishiId("sumo-api", row.eastId),
        westRikishiId: sourceRikishiId("sumo-api", row.westId),
        status: "scheduled",
      };
    }),
  };
}

function hasAttestedCompleteCard(
  rows: readonly SumoApiTorikumiRow[],
  banzukePayload: SumoApiBanzukePayload,
  day: number,
): boolean {
  if (!rows.every(hasResolvedWinner)) {
    return false;
  }

  const banzukeRows = [
    ...(banzukePayload.east ?? []),
    ...(banzukePayload.west ?? []),
  ];
  if (!banzukeRows.every(isBanzukeRow)) return false;
  const outcomesByRikishiId = new Map<
    string,
    { result: "win" | "loss"; isFusen: boolean }
  >();
  for (const row of rows) {
    const winnerId = resolveWinnerRikishiId(row);
    const eastId = sourceRikishiId("sumo-api", row.eastId);
    const westId = sourceRikishiId("sumo-api", row.westId);
    const loserId = winnerId === eastId ? westId : eastId;
    const fusen = isFusen(row.kimarite);
    outcomesByRikishiId.set(winnerId, { result: "win", isFusen: fusen });
    outcomesByRikishiId.set(loserId, { result: "loss", isFusen: fusen });
  }
  const banzukeIds = banzukeRows.map((row) =>
    sourceRikishiId("sumo-api", row.rikishiID),
  );
  return (
    banzukeRows.length > 0 &&
    new Set(banzukeIds).size === banzukeIds.length &&
    banzukeRows.every((rikishi) => {
      const dayRecord = rikishi.record?.[day - 1];
      const result = dayRecord?.result?.trim().toLowerCase();

      if (result === undefined || result === "") {
        return false;
      }

      if (result === "absent") {
        return !outcomesByRikishiId.has(
          sourceRikishiId("sumo-api", rikishi.rikishiID),
        );
      }

      const outcome = outcomesByRikishiId.get(
        sourceRikishiId("sumo-api", rikishi.rikishiID),
      );

      // Explicit forfeit records must agree with the bout's absence marker,
      // which the result mapper preserves for scoring and historical records.
      if (result === "fusen win" || result === "fusen loss") {
        return (
          outcome?.isFusen === true && result === `fusen ${outcome.result}`
        );
      }

      return (
        (result === "win" || result === "loss") && outcome?.result === result
      );
    })
  );
}

function normalizeSumoApiBanzukePayload(
  payload: unknown,
): SumoApiBanzukePayload | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  if (
    !isOptionalString(payload.bashoId) ||
    !isOptionalString(payload.division) ||
    !isOptionalBanzukeRows(payload.east) ||
    !isOptionalBanzukeRows(payload.west)
  ) {
    return undefined;
  }

  return payload as SumoApiBanzukePayload;
}

function isOptionalBanzukeRows(
  value: unknown,
): value is SumoApiBanzukeRow[] | undefined {
  return (
    value === undefined || (Array.isArray(value) && value.every(isBanzukeRow))
  );
}

function isBanzukeRow(value: unknown): value is SumoApiBanzukeRow {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.rikishiID === "number" &&
    Number.isSafeInteger(value.rikishiID) &&
    value.rikishiID > 0 &&
    typeof value.shikonaEn === "string" &&
    value.shikonaEn.trim().length > 0 &&
    (value.record === undefined ||
      (Array.isArray(value.record) &&
        value.record.every(
          (entry) =>
            isRecord(entry) &&
            (entry.result === undefined || typeof entry.result === "string"),
        )))
  );
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasResolvedWinner(row: SumoApiTorikumiRow): boolean {
  return (
    row.winnerId !== undefined ||
    (row.winnerEn !== undefined && row.winnerEn.trim() !== "")
  );
}

export function mapSumoApiTorikumiPayload(
  payload: SumoApiTorikumiPayload,
  options: { bashoId: string; day: number },
): BoutResultsImportCommand {
  const rows = payload.torikumi ?? [];

  return {
    source: "sumo-api-results",
    bashoId: options.bashoId,
    rikishi: uniqueRikishi(
      rows.flatMap((row) => [
        toSourceRikishi(
          requiredString(row.eastShikona, "eastShikona"),
          "sumo-api",
          row.eastId,
        ),
        toSourceRikishi(
          requiredString(row.westShikona, "westShikona"),
          "sumo-api",
          row.westId,
        ),
      ]),
    ),
    results: rows.map((row, index) => {
      const matchNo = row.matchNo ?? index + 1;
      const eastId = sourceRikishiId("sumo-api", row.eastId);
      const westId = sourceRikishiId("sumo-api", row.westId);
      const winnerId = resolveWinnerRikishiId(row);

      return {
        id: `${options.bashoId}-day-${options.day}-match-${matchNo}`,
        bashoId: toLocalBashoId(row.bashoId ?? options.bashoId),
        day: row.day ?? options.day,
        winnerRikishiId: winnerId,
        loserRikishiId: winnerId === eastId ? westId : eastId,
        ...(row.kimarite === undefined || row.kimarite === ""
          ? {}
          : { kimarite: row.kimarite }),
        ...(isFusen(row.kimarite) ? { loserAbsent: true } : {}),
      };
    }),
  };
}

function isFusen(kimarite: string | undefined): boolean {
  return kimarite?.trim().toLowerCase() === "fusen";
}

function sourceRikishiId(source: "jsa" | "sumo-api", id: unknown): string {
  const value = String(id);
  if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`Missing or invalid ${source} rikishi ID.`);
  }
  return `${source}:${value}`;
}

function toSourceRikishi(
  shikona: string,
  source: "jsa" | "sumo-api",
  id: unknown,
): SourceRikishi {
  const reference = sourceRikishiId(source, id);
  return {
    id: reference,
    shikona,
    sourceIdentity: {
      source,
      sourceRikishiId: reference.slice(source.length + 1),
    },
  };
}

function uniqueRikishi(rikishi: SourceRikishi[]) {
  const byId = new Map<string, SourceRikishi>();
  for (const entry of rikishi) {
    // Provider ID establishes identity even when two endpoints use different
    // display names. The attesting banzuke is appended last and supplies the
    // preferred source metadata; persisted JSA snapshots remain authoritative.
    byId.set(entry.id, entry);
  }
  return [...byId.values()];
}

async function fetchJson<T>(fetchFn: SourceFetch, url: string): Promise<T> {
  const response = await fetchFn(url);

  if (!response.ok) {
    throw new Error(`Import source request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

function isUsableJsaBanzukeRow(row: JsaBanzukeRow) {
  const hasName = typeof row.shikona === "string" && row.shikona.trim() !== "";
  const hasRank =
    typeof row.banzuke_name === "string" && row.banzuke_name.trim() !== "";
  const hasId = row.rikishi_id !== undefined && row.rikishi_id !== "";
  if (!hasName && !hasRank && !hasId) return false;
  if (!hasName || !hasRank)
    throw new Error("JSA banzuke row is missing shikona or rank.");
  sourceRikishiId("jsa", row.rikishi_id);
  return true;
}

function formatJsaBashoName(payload: JsaBanzukePayload) {
  const year = payload.BashoInfo?.year_eng;
  const name = payload.basho_name ?? payload.BashoInfo?.basho_name_eng;

  return [year, name].filter(Boolean).join(" ");
}

function resolveBashoStatus(payload: JsaBanzukePayload) {
  if (payload.BashoInfo?.BattleNow === 1) {
    return "active";
  }

  const currentDay = resolveCurrentDay(payload);
  const today = payload.BashoInfo?.today;
  const endDate = payload.BashoInfo?.end_date;

  if (today !== undefined && endDate !== undefined && today > endDate) {
    // Only a verified day-15 result import may complete a basho. The JSA
    // banzuke date is calendar context, not evidence that all results arrived.
    return "active";
  }

  if (currentDay !== undefined && currentDay > 0) {
    return "locked";
  }

  return "upcoming";
}

function resolveCurrentDay(payload: JsaBanzukePayload) {
  const today = payload.BashoInfo?.today;
  const startDate = payload.BashoInfo?.start_date;
  const endDate = payload.BashoInfo?.end_date;

  if (today === undefined || startDate === undefined || endDate === undefined) {
    return undefined;
  }

  if (today < startDate) {
    return 0;
  }

  const bashoLength = daysBetween(startDate, endDate) + 1;
  const day = daysBetween(startDate, today) + 1;

  return Math.min(Math.max(day, 0), bashoLength);
}

function daysBetween(startDate: string, endDate: string) {
  return Math.floor(
    (Date.parse(`${endDate}T00:00:00.000Z`) -
      Date.parse(`${startDate}T00:00:00.000Z`)) /
      86_400_000,
  );
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Sumo API torikumi row is missing ${field}.`);
  }

  return value;
}

function resolveWinnerRikishiId(row: SumoApiTorikumiRow): string {
  const eastId = sourceRikishiId("sumo-api", row.eastId);
  const westId = sourceRikishiId("sumo-api", row.westId);
  if (eastId === westId)
    throw new Error("A bout requires two distinct source rikishi IDs.");
  if (row.winnerId !== undefined) {
    const winnerId = sourceRikishiId("sumo-api", row.winnerId);
    if (winnerId === eastId || winnerId === westId) return winnerId;
    throw new Error("Sumo API winner ID does not match either participant.");
  }
  const winnerEn = requiredString(row.winnerEn, "winnerEn");
  const eastShikona = requiredString(row.eastShikona, "eastShikona");
  const westShikona = requiredString(row.westShikona, "westShikona");
  if (eastShikona !== westShikona) {
    if (winnerEn === eastShikona) return eastId;
    if (winnerEn === westShikona) return westId;
  }
  throw new Error(
    "Sumo API torikumi row winner does not uniquely match either rikishi.",
  );
}
