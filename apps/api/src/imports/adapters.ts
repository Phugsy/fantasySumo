import type {
  BanzukeImportCommand,
  JsaBanzukeImportOptions,
  SourceFetch,
  SumoApiResultsImportOptions,
  BoutResultsImportCommand,
} from "./types.js";
import { toCompactBashoId, toLocalBashoId, toLocalRikishiId } from "./ids.js";

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
      name: formatJsaBashoName(payload),
      startDate,
      endDate,
      status: resolveBashoStatus(payload),
      currentDay: resolveCurrentDay(payload),
    },
    rikishi: rows.map((row) => ({
      id: toLocalRikishiId(String(row.shikona)),
      shikona: String(row.shikona),
      ...(row.heya_name === undefined || row.heya_name === ""
        ? {}
        : { heya: String(row.heya_name) }),
    })),
    banzukeEntries: rows.map((row, index) => {
      const rikishiId = toLocalRikishiId(String(row.shikona));
      const rankOrder = Number(row.banzuke_id) || index + 1;

      return {
        id: `${bashoId}-${rikishiId}`,
        bashoId,
        rikishiId,
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

export function mapSumoApiTorikumiPayload(
  payload: SumoApiTorikumiPayload,
  options: { bashoId: string; day: number },
): BoutResultsImportCommand {
  return {
    source: "sumo-api-results",
    bashoId: options.bashoId,
    results: (payload.torikumi ?? []).map((row, index) => {
      const matchNo = row.matchNo ?? index + 1;
      const eastId = row.eastId;
      const westId = row.westId;
      const eastShikona = requiredString(row.eastShikona, "eastShikona");
      const westShikona = requiredString(row.westShikona, "westShikona");
      const winnerShikona = resolveWinnerShikona(row, {
        eastId,
        eastShikona,
        westId,
        westShikona,
      });
      const loserShikona =
        winnerShikona === eastShikona ? westShikona : eastShikona;

      return {
        id: `${options.bashoId}-day-${options.day}-match-${matchNo}`,
        bashoId: toLocalBashoId(row.bashoId ?? options.bashoId),
        day: row.day ?? options.day,
        winnerRikishiId: toLocalRikishiId(winnerShikona),
        loserRikishiId: toLocalRikishiId(loserShikona),
        ...(row.kimarite === undefined || row.kimarite === ""
          ? {}
          : { kimarite: row.kimarite }),
      };
    }),
  };
}

async function fetchJson<T>(fetchFn: SourceFetch, url: string): Promise<T> {
  const response = await fetchFn(url);

  if (!response.ok) {
    throw new Error(`Import source request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

function isUsableJsaBanzukeRow(row: JsaBanzukeRow) {
  return (
    row.rikishi_id !== undefined &&
    row.rikishi_id !== "" &&
    row.shikona !== undefined &&
    row.shikona !== "" &&
    row.banzuke_name !== undefined &&
    row.banzuke_name !== ""
  );
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
    return "complete";
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
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Sumo API torikumi row is missing ${field}.`);
  }

  return value;
}

function resolveWinnerShikona(
  row: SumoApiTorikumiRow,
  wrestlers: {
    eastId?: number;
    eastShikona: string;
    westId?: number;
    westShikona: string;
  },
): string {
  if (row.winnerId !== undefined) {
    if (row.winnerId === wrestlers.eastId) {
      return wrestlers.eastShikona;
    }

    if (row.winnerId === wrestlers.westId) {
      return wrestlers.westShikona;
    }
  }

  const winnerEn = requiredString(row.winnerEn, "winnerEn");

  if (
    winnerEn === wrestlers.eastShikona ||
    winnerEn === wrestlers.westShikona
  ) {
    return winnerEn;
  }

  throw new Error(
    "Sumo API torikumi row winner does not match either rikishi.",
  );
}
