import type {
  Basho,
  BashoRikishiResponse,
  CreatedTeamResponse,
  LeaderboardResponse,
} from "./types";

interface ApiErrorBody {
  message?: string;
  details?: Array<{
    message?: string;
  }>;
}

export async function fetchCurrentBasho(): Promise<Basho> {
  return getJson<Basho>("/api/basho/current");
}

export async function fetchBashoRikishi(
  bashoId: string,
): Promise<BashoRikishiResponse> {
  return getJson<BashoRikishiResponse>(`/api/basho/${bashoId}/rikishi`);
}

export async function fetchLeaderboard(
  bashoId: string,
): Promise<LeaderboardResponse> {
  return getJson<LeaderboardResponse>(`/api/basho/${bashoId}/leaderboard`);
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

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.json() as Promise<T>;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    const details = body.details
      ?.map((detail) => detail.message)
      .filter((message): message is string => message !== undefined);

    if (details !== undefined && details.length > 0) {
      return `${body.message ?? "Request failed"} ${details.join(" ")}`;
    }

    return body.message ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}
