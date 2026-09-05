import type {
  BanzukeEntry,
  Basho,
  BoutResult,
  Rikishi,
  ScheduledBout,
} from "@fantasy-sumo/domain";
import { toCompleteScheduledBoutPublicationSource } from "@fantasy-sumo/domain";

export { isCompleteScheduledBoutPublicationSource } from "@fantasy-sumo/domain";

export type ImportEntityName =
  | "basho"
  | "rikishi"
  | "banzuke"
  | "results"
  | "scheduledBouts";

export interface ImportEntitySummary {
  created: number;
  updated: number;
  skipped: number;
  deleted: number;
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
  rikishi?: Rikishi[];
  results: BoutResult[];
  source: string;
}

export interface ScheduledBoutsImportCommand {
  bashoId: Basho["id"];
  day: number;
  isComplete?: boolean;
  rikishi?: Rikishi[];
  bouts: ScheduledBout[];
  source: string;
}

export function toScheduledBoutPublicationSource(
  command: Pick<ScheduledBoutsImportCommand, "isComplete" | "source">,
): string {
  return command.isComplete === true
    ? toCompleteScheduledBoutPublicationSource(command.source)
    : command.source;
}

export interface ImportOptions {
  dryRun?: boolean;
  expectedBanzukeRikishiIds?: readonly string[];
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

export type SumoApiScheduleImportOptions = SumoApiResultsImportOptions;

export type SourceFetch = typeof fetch;
