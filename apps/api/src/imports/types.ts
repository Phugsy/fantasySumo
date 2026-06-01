import type {
  BanzukeEntry,
  Basho,
  BoutResult,
  Rikishi,
} from "@fantasy-sumo/domain";

export type ImportEntityName = "basho" | "rikishi" | "banzuke" | "results";

export interface ImportEntitySummary {
  created: number;
  updated: number;
  skipped: number;
}

export type ImportSummary = Record<ImportEntityName, ImportEntitySummary>;

export interface ImportValidationIssue {
  path: string;
  message: string;
}

export interface BanzukeImportCommand {
  basho: Basho;
  rikishi: Rikishi[];
  banzukeEntries: BanzukeEntry[];
  source: string;
}

export interface BoutResultsImportCommand {
  bashoId: Basho["id"];
  results: BoutResult[];
  source: string;
}

export interface ImportOptions {
  dryRun?: boolean;
}

export interface ImportResult {
  dryRun: boolean;
  source: string;
  summary: ImportSummary;
}

export interface JsaBanzukeImportOptions {
  divisionId?: number;
  page?: number;
}

export interface SumoApiResultsImportOptions {
  bashoId: Basho["id"];
  day: number;
  division?: string;
}

export type SourceFetch = typeof fetch;
