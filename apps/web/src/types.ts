export interface Basho {
  id: string;
  isDemo: boolean;
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
    lockedAt?: string;
    ownerUserId?: string;
  };
  picks: Array<{
    rikishiId: string;
  }>;
}

export interface MyTeamResponse {
  basho: Omit<Basho, "teamSize">;
  team: CreatedTeamResponse["team"];
  totalScore: number;
  picks: Array<
    CreatedTeamResponse["picks"][number] & {
      shikona: string;
      heya?: string;
      rank?: string;
      rankOrder?: number;
      wins: number;
      score: number;
    }
  >;
}

export interface SessionUser {
  id: string;
  email?: string;
  displayName?: string;
  isAdmin?: boolean;
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
  latestDayScore?: {
    day: number;
    score: number;
  };
  scoreHistory: TeamScoreHistoryEntry[];
}

export interface RikishiScore {
  rikishiId: string;
  wins: number;
  score: number;
}

export interface TeamScoreHistoryEntry {
  day: number;
  dailyScore: number;
  cumulativeScore: number;
  rikishiScores: Array<{
    rikishiId: string;
    outcome: "win" | "loss" | "absent" | "no-result";
    score: number;
  }>;
}

export type LoadState = "loading" | "ready" | "empty" | "error";
export type LeaderboardLoadState = "loading" | "ready";
export interface AdminBashoResponse {
  basho: Omit<Basho, "teamSize">;
}

export type AdminLifecycleAction = "open-picks" | "start" | "close";
export type AdminDemoAction = "reset" | "start" | "advance-day" | "complete";

export interface AdminActionResponse extends AdminBashoResponse {
  action: AdminLifecycleAction | AdminDemoAction;
  changed?: boolean;
  appliedResults?: number;
}

export type ActiveView = "home" | "login" | "stable" | "team" | "admin";
