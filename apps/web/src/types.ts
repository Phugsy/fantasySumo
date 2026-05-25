export interface Basho {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "upcoming" | "active" | "complete";
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
  };
  picks: Array<{
    rikishiId: string;
  }>;
}

export interface LeaderboardResponse {
  bashoId: string;
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
export type ActiveView = "selection" | "leaderboard";
