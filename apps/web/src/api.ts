import type { ScoringMode } from "@fantasy-sumo/domain";
import type {
  AdminActionResponse,
  AdminBashoResponse,
  AdminDemoAction,
  AdminGameConfigResponse,
  AdminImportResponse,
  AdminLifecycleAction,
  AllTimeLeaderboardResponse,
  Basho,
  BashoArchiveResponse,
  BashoRikishiResponse,
  CreatedTeamResponse,
  LeaderboardResponse,
  MyTeamResponse,
  MyHistoryResponse,
  ScheduleResponse,
  SessionResponse,
} from "./types";

interface ApiErrorBody {
  error?: string;
  message?: string;
  basho?: Omit<Basho, "teamSize">;
  bashoStatus?: Basho["status"];
  teamLockedAt?: string;
  teamSize?: number;
  details?: Array<{
    message?: string;
  }>;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | undefined = undefined,
    readonly bashoStatus: Basho["status"] | undefined = undefined,
    readonly teamLockedAt: string | undefined = undefined,
    readonly basho: Omit<Basho, "teamSize"> | undefined = undefined,
    readonly teamSize: number | undefined = undefined,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

let authTokenProvider: (() => Promise<string | null>) | null = null;

const AUTH_CLIENT_DIAGNOSTIC_HEADER = "X-Fantasy-Sumo-Auth-Diagnostic";
const ACCESS_TOKEN_UNAVAILABLE_DIAGNOSTIC = "access-token-unavailable";

export function setAuthTokenProvider(
  provider: (() => Promise<string | null>) | null,
) {
  authTokenProvider = provider;
}

export async function fetchCurrentBasho(): Promise<Basho> {
  return getJson<Basho>(getCurrentBashoUrl(), false);
}

export function getCurrentBashoUrl(
  mode: string | undefined = import.meta.env.VITE_BASHO_MODE,
): string {
  return mode === "demo"
    ? "/api/basho/current?mode=demo"
    : "/api/basho/current";
}

export async function fetchBashoRikishi(
  bashoId: string,
): Promise<BashoRikishiResponse> {
  return getJson<BashoRikishiResponse>(`/api/basho/${bashoId}/rikishi`, false);
}

export async function fetchLeaderboard(
  bashoId: string,
): Promise<LeaderboardResponse> {
  return getJson<LeaderboardResponse>(
    `/api/basho/${bashoId}/leaderboard`,
    false,
  );
}

export async function fetchBashoArchive(): Promise<BashoArchiveResponse> {
  return getJson<BashoArchiveResponse>("/api/bashos", false);
}

export async function fetchAllTimeLeaderboard(): Promise<AllTimeLeaderboardResponse> {
  return getJson<AllTimeLeaderboardResponse>(
    "/api/leaderboard/all-time",
    false,
  );
}

export async function fetchMyHistory(): Promise<MyHistoryResponse> {
  return getJson<MyHistoryResponse>("/api/my-history");
}

export async function fetchSession(): Promise<SessionResponse> {
  return getJson<SessionResponse>("/api/session");
}

export async function fetchAdminBasho(
  mode: "live" | "demo",
): Promise<AdminBashoResponse> {
  return getJson<AdminBashoResponse>(
    mode === "demo"
      ? "/api/admin/basho/current?mode=demo"
      : "/api/admin/basho/current",
  );
}

export async function runAdminLifecycleAction(
  bashoId: string,
  action: AdminLifecycleAction,
): Promise<AdminActionResponse> {
  return postJson<AdminActionResponse>(
    `/api/admin/basho/${bashoId}/${action}`,
    {},
  );
}

export async function runAdminDemoAction(
  action: AdminDemoAction,
): Promise<AdminActionResponse> {
  return postJson<AdminActionResponse>(`/api/admin/demo/${action}`, {});
}

export async function fetchAdminGameConfig(
  bashoId: string,
): Promise<AdminGameConfigResponse> {
  return getJson<AdminGameConfigResponse>(
    `/api/admin/basho/${bashoId}/game-config`,
  );
}

export async function updateAdminGameConfig(
  bashoId: string,
  teamSize: number,
): Promise<AdminGameConfigResponse> {
  return putJson<AdminGameConfigResponse>(
    `/api/admin/basho/${bashoId}/game-config`,
    { teamSize },
  );
}

export async function runAdminBanzukeImport(
  options: {
    confirmedSourceBashoId?: string;
    expectedBashoId?: string;
  },
  dryRun: boolean,
): Promise<AdminImportResponse> {
  return postJson<AdminImportResponse>(
    `/api/admin/import-banzuke?dryRun=${String(dryRun)}`,
    options,
  );
}

export async function runAdminResultsImport(
  bashoId: string,
  day: number,
  dryRun: boolean,
): Promise<AdminImportResponse> {
  return postJson<AdminImportResponse>(
    `/api/admin/basho/${bashoId}/import-results?dryRun=${String(dryRun)}`,
    { day, division: "Makuuchi" },
  );
}

export async function runAdminScheduleImport(
  bashoId: string,
  day: number,
  dryRun: boolean,
): Promise<AdminImportResponse> {
  return postJson<AdminImportResponse>(
    `/api/admin/basho/${bashoId}/import-schedule?dryRun=${String(dryRun)}`,
    { day, division: "Makuuchi" },
  );
}

export function reportAuthClientTokenUnavailable(): void {
  void fetch("/api/session", {
    credentials: "same-origin",
    headers: {
      [AUTH_CLIENT_DIAGNOSTIC_HEADER]: ACCESS_TOKEN_UNAVAILABLE_DIAGNOSTIC,
    },
  }).catch(() => {
    // Diagnostics are best-effort and must never replace the original auth error.
  });
}

export async function createSession(body: {
  email: string;
  displayName: string;
}): Promise<SessionResponse> {
  return postJson<SessionResponse>("/api/session", body);
}

export async function clearSession(): Promise<void> {
  const response = await fetch("/api/session", {
    credentials: "same-origin",
    headers: await getAuthHeaders(),
    method: "DELETE",
  });

  if (!response.ok) {
    throw await createApiRequestError(response);
  }
}

export async function fetchMyTeam(bashoId: string): Promise<MyTeamResponse> {
  return getJson<MyTeamResponse>(`/api/basho/${bashoId}/my-team`);
}

export async function fetchSchedule(
  bashoId: string,
): Promise<ScheduleResponse> {
  return getJson<ScheduleResponse>(`/api/basho/${bashoId}/schedule`, false);
}

export async function createFantasyTeam(
  bashoId: string,
  body: {
    displayName: string;
    rikishiIds: string[];
  },
): Promise<CreatedTeamResponse> {
  return postJson<CreatedTeamResponse>(`/api/basho/${bashoId}/teams`, body);
}

export async function updateFantasyTeam(
  bashoId: string,
  body: {
    displayName: string;
    rikishiIds: string[];
  },
): Promise<CreatedTeamResponse> {
  return putJson<CreatedTeamResponse>(`/api/basho/${bashoId}/my-team`, body);
}

async function getJson<T>(url: string, includeAuth = true): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: includeAuth ? await getAuthHeaders() : {},
  });

  if (!response.ok) {
    throw await createApiRequestError(response);
  }

  return response.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  return sendJson<T>(url, body, "POST");
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  return sendJson<T>(url, body, "PUT");
}

async function sendJson<T>(
  url: string,
  body: unknown,
  method: "POST" | "PUT",
): Promise<T> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(await getAuthHeaders()),
    },
    method,
  });

  if (!response.ok) {
    throw await createApiRequestError(response);
  }

  return response.json() as Promise<T>;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (authTokenProvider === null) {
    return {};
  }

  const token = await authTokenProvider();

  if (token === null) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

async function createApiRequestError(
  response: Response,
): Promise<ApiRequestError> {
  const error = await readApiError(response);

  return new ApiRequestError(
    error.message,
    response.status,
    error.code,
    error.bashoStatus,
    error.teamLockedAt,
    error.basho,
    error.teamSize,
  );
}

async function readApiError(response: Response): Promise<{
  message: string;
  code?: string;
  basho?: Omit<Basho, "teamSize">;
  bashoStatus?: Basho["status"];
  teamLockedAt?: string;
  teamSize?: number;
}> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    const details = body.details
      ?.map((detail) => detail.message)
      .filter((message): message is string => message !== undefined);

    if (details !== undefined && details.length > 0) {
      return {
        message: `${body.message ?? "Request failed"} ${details.join(" ")}`,
        ...(body.error === undefined ? {} : { code: body.error }),
        ...(body.basho === undefined ? {} : { basho: body.basho }),
        ...(body.bashoStatus === undefined
          ? {}
          : { bashoStatus: body.bashoStatus }),
        ...(body.teamLockedAt === undefined
          ? {}
          : { teamLockedAt: body.teamLockedAt }),
        ...(body.teamSize === undefined ? {} : { teamSize: body.teamSize }),
      };
    }

    return {
      message: body.message ?? `Request failed with status ${response.status}.`,
      ...(body.error === undefined ? {} : { code: body.error }),
      ...(body.basho === undefined ? {} : { basho: body.basho }),
      ...(body.bashoStatus === undefined
        ? {}
        : { bashoStatus: body.bashoStatus }),
      ...(body.teamLockedAt === undefined
        ? {}
        : { teamLockedAt: body.teamLockedAt }),
      ...(body.teamSize === undefined ? {} : { teamSize: body.teamSize }),
    };
  } catch {
    return { message: `Request failed with status ${response.status}.` };
  }
}

export async function updateAdminScoringMode(
  bashoId: string,
  scoringMode: ScoringMode,
): Promise<void> {
  await putJson(`/api/admin/basho/${bashoId}/game-config/scoring`, {
    scoringMode,
  });
}
export async function runAdminPrizesImport(
  bashoId: string,
  dryRun: boolean,
): Promise<{ status: "confirmed"; count: number; dryRun: boolean }> {
  return postJson(
    `/api/admin/basho/${bashoId}/import-prizes?dryRun=${dryRun}`,
    {},
  );
}
