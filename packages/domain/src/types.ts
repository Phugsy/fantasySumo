export type BashoStatus = "upcoming" | "locked" | "active" | "complete";

export interface Basho {
  id: string;
  isDemo: boolean;
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
  shikona?: string;
  heya?: string;
  rank: string;
  rankOrder: number;
}

export interface PreviousBashoRecord {
  bashoId: Basho["id"];
  bashoName: Basho["name"];
  startDate: Basho["startDate"];
  rank: BanzukeEntry["rank"];
  wins: number;
  losses: number;
  absences: number;
}

export type PreviousBashoRecordState =
  | ({ status: "available" } & PreviousBashoRecord)
  | {
      status: "did-not-compete";
      bashoId: Basho["id"];
      bashoName: Basho["name"];
      startDate: Basho["startDate"];
    }
  | {
      status: "unavailable";
      bashoId?: Basho["id"];
      bashoName?: Basho["name"];
      startDate?: Basho["startDate"];
    };

export interface FantasyTeam {
  id: string;
  bashoId: Basho["id"];
  displayName: string;
  ownerName?: string;
  ownerUserId?: string;
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

export type ScheduledBoutStatus = "scheduled" | "cancelled";

export interface ScheduledBout {
  id: string;
  bashoId: Basho["id"];
  day: number;
  eastRikishiId: Rikishi["id"];
  westRikishiId: Rikishi["id"];
  status: ScheduledBoutStatus;
  withdrawnRikishiId?: Rikishi["id"];
}

export interface ScheduledBoutPublication {
  id: string;
  bashoId: Basho["id"];
  day: number;
  source: string;
  publishedAt: string;
}

export type RikishiTournamentStatusType = "withdrawn" | "returned";

export type RikishiTournamentAchievementType =
  | "kachi-koshi"
  | "make-koshi"
  | "gold-star";

export type RikishiTournamentNoteProvenance = "source" | "derived";

export interface RikishiTournamentStatus {
  type: RikishiTournamentStatusType;
  effectiveDay: number;
  provenance: RikishiTournamentNoteProvenance;
}

export interface RikishiTournamentAchievement {
  type: RikishiTournamentAchievementType;
  day: number;
  provenance: RikishiTournamentNoteProvenance;
}

export interface RikishiTournamentNotes {
  statuses: RikishiTournamentStatus[];
  achievements: RikishiTournamentAchievement[];
}

export interface RikishiScore {
  rikishiId: Rikishi["id"];
  wins: number;
  score: number;
}

export type RikishiDayOutcome = "win" | "loss" | "absent" | "no-result";

export interface RikishiDayScore {
  rikishiId: Rikishi["id"];
  outcome: RikishiDayOutcome;
  score: number;
}

export interface TeamScoreHistoryEntry {
  day: BoutResult["day"];
  dailyScore: number;
  cumulativeScore: number;
  rikishiScores: RikishiDayScore[];
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
  latestDayScore?: {
    day: BoutResult["day"];
    score: number;
  };
  scoreHistory: TeamScoreHistoryEntry[];
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
