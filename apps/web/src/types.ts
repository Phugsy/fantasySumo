export interface Basho {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "upcoming" | "locked" | "active" | "complete";
  currentDay?: number;
  teamSize: number;
}

export interface RankedRikishi {
  id: string;
  shikona: string;
  heya?: string;
  rank: string;
  rankOrder: number;
}

export interface BashoRikishiResponse {
  basho: Omit<Basho, "teamSize">;
  rikishi: RankedRikishi[];
}

export interface CreatedTeamResponse {
  team: {
    id: string;
    displayName: string;
    ownerUserId?: string;
  };
  picks: Array<{
    rikishiId: string;
  }>;
}

export type TeamResponse = CreatedTeamResponse;

export interface SessionUser {
  id: string;
  email?: string;
  displayName?: string;
}

export interface SessionResponse {
  user: SessionUser | null;
  mode: "local" | "neon";
}

export interface LeaderboardResponse {
  basho: Omit<Basho, "teamSize">;
  bashoId: string;
  totalDays?: number;
  leaderboard: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  displayName: string;
  score: number;
  rikishiScores: RikishiScore[];
}

export interface RikishiScore {
  rikishiId: string;
  wins: number;
  score: number;
}

export type LoadState = "loading" | "ready" | "empty" | "error";
export type LeaderboardLoadState = "loading" | "ready";
export type ActiveView = "selection" | "leaderboard";
