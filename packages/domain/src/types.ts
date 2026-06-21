export type BashoStatus = "upcoming" | "locked" | "active" | "complete";

export interface Basho {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: BashoStatus;
  currentDay?: number;
}

export interface Rikishi {
  id: string;
  shikona: string;
  heya?: string;
}

export interface BanzukeEntry {
  id: string;
  bashoId: Basho["id"];
  rikishiId: Rikishi["id"];
  rank: string;
  rankOrder: number;
}

export interface FantasyTeam {
  id: string;
  bashoId: Basho["id"];
  displayName: string;
  ownerName?: string;
  createdAt?: string;
  lockedAt?: string;
}

export interface FantasyPick {
  id?: string;
  teamId: FantasyTeam["id"];
  rikishiId: Rikishi["id"];
}

export interface BoutResult {
  id: string;
  bashoId: Basho["id"];
  day: number;
  winnerRikishiId: Rikishi["id"];
  loserRikishiId: Rikishi["id"];
  kimarite?: string;
  winnerAbsent?: boolean;
  loserAbsent?: boolean;
}

export interface RikishiScore {
  rikishiId: Rikishi["id"];
  wins: number;
  score: number;
}

export interface ScoringOptions {
  throughDay?: BoutResult["day"];
}

export interface TeamScore {
  teamId: FantasyTeam["id"];
  displayName: FantasyTeam["displayName"];
  score: number;
  rikishiScores: RikishiScore[];
}

export interface LeaderboardEntry extends TeamScore {
  rank: number;
}

export type PickValidationErrorCode = "duplicate-pick" | "invalid-team-size";

export interface PickValidationError {
  code: PickValidationErrorCode;
  message: string;
  rikishiId?: Rikishi["id"];
  expectedTeamSize?: number;
  actualTeamSize?: number;
}

export interface PickValidationOptions {
  teamSize?: number;
}
