import { executeStatements } from "./sql-transaction.js";
import { randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import {
  JOKER_PRESET,
  jokerDeadline,
  jokerWindow,
  resolveJoker,
  type Basho,
  type BoutResult,
  type ScheduledBout,
  type ScheduledBoutPublication,
  type JokerAllocation,
  type JokerFacts,
  type ScoringMode,
} from "@fantasy-sumo/domain";
import type { AppDatabase } from "./client.js";
import { DEMO_BASHO_ID } from "./demo-constants.js";

type Row = Record<string, unknown>;
export interface JokerTrial {
  bashoId: string;
  preset: typeof JOKER_PRESET;
  baseMode: ScoringMode;
  clock: string;
}
export interface JokerCommand {
  ownerUserId: string;
  day: number;
  rikishiId: string | null;
  boutId: string | null;
  opponentId: string | null;
  expectedRevision: number;
  requestId: string;
}
export interface JokerSnapshot {
  trial: JokerTrial;
  now: string;
  allocations: JokerAllocation[];
  windows: {
    day: number;
    deadline: string;
    status: "open" | "closed" | "unavailable";
    targets: { rikishiId: string; boutId: string; opponentId: string }[];
  }[];
  teamId?: string;
  remaining: number;
  budgetDiscrepancy: boolean;
}
export interface JokerRepositories {
  configureDemoJokers: (
    clock?: string,
    now?: () => Date,
  ) => Promise<JokerTrial>;
  getJokerSnapshot: (
    bashoId: string,
    now: () => Date,
    ownerUserId?: string,
    command?: JokerCommand,
  ) => Promise<JokerSnapshot | undefined>;
}
export class JokerError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
type JokerOperations = {
  [K in keyof JokerRepositories]: (
    ...args: Parameters<JokerRepositories[K]>
  ) => Generator<SQL, Awaited<ReturnType<JokerRepositories[K]>>, Row[]>;
};
export function createJokerRepositories(
  database: AppDatabase,
): JokerRepositories {
  const operations = createJokerOperations(database);
  return {
    configureDemoJokers: (...args) =>
      executeStatements(database, operations.configureDemoJokers(...args)),
    getJokerSnapshot: (...args) =>
      executeStatements(database, operations.getJokerSnapshot(...args)),
  };
}
export function createJokerOperations(database: AppDatabase): JokerOperations {
  const lock = database.provider === "postgres" ? sql` FOR UPDATE` : sql``;
  function* loadBasho(id: string): Generator<SQL, Basho, Row[]> {
    const [row] = yield sql`SELECT * FROM basho WHERE id=${id}${lock}`;
    if (!row) throw new JokerError("basho-not-found");
    return {
      id: String(row.id),
      name: String(row.name),
      isDemo: row.is_demo === true || row.is_demo === 1,
      startDate: String(row.start_date),
      endDate: String(row.end_date),
      status: row.status as Basho["status"],
      currentDay: row.current_day == null ? undefined : Number(row.current_day),
    };
  }
  return {
    configureDemoJokers: (clock, realNow = () => new Date()) =>
      (function* (): Generator<SQL, JokerTrial, Row[]> {
        const basho = yield* loadBasho(DEMO_BASHO_ID);
        if (!basho.isDemo) throw new JokerError("demo-only");
        const [config] =
          yield sql`SELECT * FROM basho_scoring_config WHERE basho_id=${basho.id}`;
        const [old] =
          yield sql`SELECT * FROM basho_joker_trial WHERE basho_id=${basho.id}`;
        if (!config) throw new JokerError("rules-unavailable");
        if (!old && (basho.status !== "upcoming" || Boolean(config.locked)))
          throw new JokerError("rules-locked");
        if (old && old.base_mode !== config.mode)
          throw new JokerError("base-mode-mismatch");
        const serverNow = realNow().toISOString();
        const oldClock = old ? effectiveClock(old, serverNow) : undefined;
        const nextClock =
          clock ?? (old ? oldClock! : `${basho.startDate}T02:00:00.000Z`);
        if (
          !Number.isFinite(Date.parse(nextClock)) ||
          new Date(nextClock).toISOString() !== nextClock
        )
          throw new JokerError("invalid-clock");
        if (old && nextClock < oldClock!)
          throw new JokerError("clock-cannot-rewind");
        yield sql`INSERT INTO basho_joker_trial(basho_id,preset,base_mode,clock,clock_set_at) VALUES(${basho.id},${JOKER_PRESET},${config.mode},${nextClock},${serverNow}) ON CONFLICT(basho_id) DO UPDATE SET clock=excluded.clock,clock_set_at=excluded.clock_set_at RETURNING basho_id`;
        return {
          bashoId: basho.id,
          preset: JOKER_PRESET,
          baseMode: config.mode as ScoringMode,
          clock: nextClock,
        };
      })(),
    getJokerSnapshot: (id, realNow, ownerUserId, command) =>
      (function* (): Generator<SQL, JokerSnapshot | undefined, Row[]> {
        const basho = yield* loadBasho(id);
        const [config] =
          yield sql`SELECT * FROM basho_joker_trial WHERE basho_id=${id}`;
        if (!config) return undefined;
        if (
          id !== DEMO_BASHO_ID ||
          !basho.isDemo ||
          config.preset !== JOKER_PRESET
        )
          throw new JokerError("demo-only");
        const [base] =
          yield sql`SELECT * FROM basho_scoring_config WHERE basho_id=${id}`;
        if (!base || base.mode !== config.base_mode)
          throw new JokerError("base-mode-mismatch");
        // Read time after acquiring the row lock, never trust a request timestamp.
        const now = effectiveClock(config, realNow().toISOString());
        const trial: JokerTrial = {
          bashoId: id,
          preset: JOKER_PRESET,
          baseMode: base.mode as ScoringMode,
          clock: now,
        };
        const teams =
          yield sql`SELECT * FROM fantasy_teams WHERE basho_id=${id}`;
        const team =
          ownerUserId === undefined
            ? undefined
            : teams.find((t) => t.owner_user_id === ownerUserId);
        if (ownerUserId !== undefined && !team)
          throw new JokerError("team-not-found");
        const teamId = team ? String(team.id) : undefined;
        if (command && (command.ownerUserId !== ownerUserId || !teamId))
          throw new JokerError("not-owner");
        const picks =
          yield sql`SELECT p.* FROM fantasy_picks p JOIN fantasy_teams t ON p.team_id=t.id WHERE t.basho_id=${id}`;
        const boutRows =
          yield sql`SELECT * FROM scheduled_bouts WHERE basho_id=${id}`;
        const publicationRows =
          yield sql`SELECT * FROM scheduled_bout_publications WHERE basho_id=${id}`;
        const resultRows =
          yield sql`SELECT * FROM bout_results WHERE basho_id=${id}`;
        const bouts: ScheduledBout[] = boutRows.map((r) => ({
          id: String(r.id),
          bashoId: id,
          day: Number(r.day),
          eastRikishiId: String(r.east_rikishi_id),
          westRikishiId: String(r.west_rikishi_id),
          status: r.status as ScheduledBout["status"],
        }));
        const publications: ScheduledBoutPublication[] = publicationRows.map(
          (r) => ({
            id: String(r.id),
            bashoId: id,
            day: Number(r.day),
            source: String(r.source),
            publishedAt: String(r.published_at),
          }),
        );
        const results: BoutResult[] = resultRows.map((r) => ({
          id: String(r.id),
          bashoId: id,
          day: Number(r.day),
          winnerRikishiId: String(r.winner_rikishi_id),
          loserRikishiId: String(r.loser_rikishi_id),
          winnerAbsent: Boolean(r.winner_absent),
          loserAbsent: Boolean(r.loser_absent),
          kimarite: r.kimarite == null ? undefined : String(r.kimarite),
        }));
        const facts: JokerFacts = { basho, bouts, publications, results };
        const rows =
          yield sql`SELECT * FROM joker_allocations WHERE basho_id=${id}`;
        const allocations = rows.map(
          (r) => JSON.parse(String(r.payload_json)) as JokerAllocation,
        );
        allocations.sort(
          (a, b) => a.teamId.localeCompare(b.teamId) || a.day - b.day,
        );
        for (const a of allocations) {
          const state = resolveJoker(a, facts, now);
          if (a.state !== state) {
            if (
              a.state === "reserved" &&
              (state === "consumed" || state === "refunded")
            ) {
              yield sql`INSERT INTO joker_events(id,basho_id,team_id,request_id,fingerprint,payload_json,created_at) VALUES(${randomUUID()},${id},${a.teamId},NULL,'reconcile',${JSON.stringify({ ...a, state: "locked" })},${now}) RETURNING id`;
            }
            a.state = state;
            yield sql`UPDATE joker_allocations SET payload_json=${JSON.stringify(a)} WHERE team_id=${a.teamId} AND day=${a.day} RETURNING day`;
            yield sql`INSERT INTO joker_events(id,basho_id,team_id,request_id,fingerprint,payload_json,created_at) VALUES(${randomUUID()},${id},${a.teamId},NULL,'reconcile',${JSON.stringify(a)},${now}) RETURNING id`;
          }
        }
        const own = () =>
          allocations.filter(
            (a) => teamId === undefined || a.teamId === teamId,
          );
        const used = () =>
          own().filter((a) => a.state !== "removed" && a.state !== "refunded")
            .length;
        const windows = Array.from({ length: 15 }, (_, i) => {
          const day = i + 1;
          return {
            day,
            deadline: jokerDeadline(basho.startDate, day),
            status: jokerWindow(facts, day, now),
            targets:
              teamId === undefined
                ? []
                : bouts
                    .filter((b) => b.day === day && b.status === "scheduled")
                    .flatMap((b) =>
                      [b.eastRikishiId, b.westRikishiId]
                        .filter((r) =>
                          picks.some(
                            (p) => p.team_id === teamId && p.rikishi_id === r,
                          ),
                        )
                        .map((r) => ({
                          rikishiId: r,
                          boutId: b.id,
                          opponentId:
                            r === b.eastRikishiId
                              ? b.westRikishiId
                              : b.eastRikishiId,
                        })),
                    ),
          };
        });
        const snapshot = (): JokerSnapshot => ({
          trial,
          now,
          allocations: own(),
          windows,
          teamId,
          remaining: Math.max(0, 3 - used()),
          budgetDiscrepancy:
            teamId === undefined
              ? teams.some(
                  (t) =>
                    allocations.filter(
                      (a) =>
                        a.teamId === t.id &&
                        a.state !== "removed" &&
                        a.state !== "refunded",
                    ).length > 3,
                )
              : used() > 3,
        });
        if (!command) return snapshot();
        const {
          day,
          rikishiId,
          boutId,
          opponentId,
          expectedRevision,
          requestId,
        } = command;
        if (
          !Number.isInteger(day) ||
          day < 1 ||
          day > 15 ||
          !Number.isInteger(expectedRevision) ||
          expectedRevision < 0 ||
          !requestId ||
          requestId.length > 80
        )
          throw new JokerError("invalid-command");
        const fingerprint = JSON.stringify({
          day,
          rikishiId,
          boutId,
          opponentId,
          expectedRevision,
        });
        const [prior] =
          yield sql`SELECT * FROM joker_events WHERE team_id=${teamId!} AND request_id=${requestId}`;
        if (prior) {
          if (prior.fingerprint !== fingerprint)
            throw new JokerError("request-id-reused");
          return JSON.parse(String(prior.payload_json)) as JokerSnapshot;
        }
        const window = windows[day - 1]!;
        if (window.status !== "open" || !team?.locked_at)
          throw new JokerError("window-not-open");
        const existing = allocations.find(
          (a) => a.teamId === teamId && a.day === day,
        );
        if ((existing?.revision ?? 0) !== expectedRevision)
          throw new JokerError("stale-revision");
        const target = window.targets.find(
          (t) =>
            t.rikishiId === rikishiId &&
            t.boutId === boutId &&
            t.opponentId === opponentId,
        );
        if (rikishiId !== null && !target)
          throw new JokerError("stale-or-unowned-matchup");
        if (rikishiId === null && (boutId !== null || opponentId !== null))
          throw new JokerError("invalid-command");
        if (
          rikishiId !== null &&
          (used() > 3 ||
            ((!existing ||
              existing.state === "removed" ||
              existing.state === "refunded") &&
              used() >= 3))
        )
          throw new JokerError("joker-budget-exhausted");
        if (rikishiId === null && !existing)
          throw new JokerError("nothing-to-remove");
        const next: JokerAllocation = {
          teamId: teamId!,
          day,
          rikishiId: target?.rikishiId ?? existing!.rikishiId,
          boutId: target?.boutId ?? existing!.boutId,
          opponentId: target?.opponentId ?? existing!.opponentId,
          revision: expectedRevision + 1,
          selectedAt: now,
          state: rikishiId === null ? "removed" : "reserved",
        };
        yield sql`INSERT INTO joker_allocations(basho_id,team_id,day,payload_json) VALUES(${id},${teamId!},${day},${JSON.stringify(next)}) ON CONFLICT(team_id,day) DO UPDATE SET payload_json=excluded.payload_json RETURNING day`;
        if (existing)
          allocations.splice(allocations.indexOf(existing), 1, next);
        else allocations.push(next);
        const response = snapshot();
        yield sql`INSERT INTO joker_events(id,basho_id,team_id,request_id,fingerprint,payload_json,created_at) VALUES(${randomUUID()},${id},${teamId!},${requestId},${fingerprint},${JSON.stringify(response)},${now}) RETURNING id`;
        return response;
      })(),
  };
}

function effectiveClock(row: Row, now: string): string {
  return new Date(
    Date.parse(String(row.clock)) +
      Math.max(0, Date.parse(now) - Date.parse(String(row.clock_set_at))),
  ).toISOString();
}
