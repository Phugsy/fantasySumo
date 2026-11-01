import { createHash, randomUUID, randomBytes } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import {
  PUSH_LIMITS,
  pushBashoEnd,
  pushPayload,
  pushQuietHours,
} from "@fantasy-sumo/domain";
import type { AppDatabase } from "./client.js";
import {
  createJokerOperations,
  type JokerSnapshot,
} from "./joker-repositories.js";
import { executeStatements } from "./sql-transaction.js";
type Row = Record<string, unknown>;
export interface PushSubscriptionData {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
  timezone: string;
}
export interface PushClaim {
  id: string;
  bashoId: string;
  day: number;
  ownerId: string;
  revision: string;
  subscription: PushSubscriptionData;
  ttl: number;
  payload: ReturnType<typeof pushPayload>;
}
export interface PushPreferences {
  available: boolean;
  subscribed: boolean;
  revision: string | null;
  deviceId?: string;
  timezone?: string;
}
export class PushError extends Error {}
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function createPushRepositories(database: AppDatabase) {
  const execute = <T>(op: Generator<SQL, T, Row[]>) =>
    executeStatements(database, op);
  const lock = database.provider === "postgres" ? sql` FOR UPDATE` : sql``;
  const joker = createJokerOperations(database);
  function* load(
    id: string,
  ): Generator<SQL, { basho: Row; pilot: Row | undefined }, Row[]> {
    if (database.provider === "postgres")
      yield sql`SELECT pg_advisory_xact_lock(1169732011)`;
    const [basho] = yield sql`SELECT * FROM basho WHERE id=${id}${lock}`;
    if (!basho) throw new PushError("basho-not-found");
    const [pilot] = yield sql`SELECT * FROM push_pilots WHERE basho_id=${id}`;
    return { basho, pilot };
  }
  function active(
    basho: Row,
    pilot: Row | undefined,
    owner: string,
    now: string,
  ) {
    return (
      (basho.is_demo === true || basho.is_demo === 1) &&
      basho.status !== "complete" &&
      !!pilot &&
      Number(pilot.enabled) === 1 &&
      now < pushBashoEnd(String(basho.end_date)) &&
      (JSON.parse(String(pilot.roster_json)) as string[]).includes(owner)
    );
  }
  function* eligibility(
    id: string,
    owner: string,
    now: () => Date,
  ): Generator<SQL, JokerSnapshot | undefined, Row[]> {
    // Existing Joker operations deliberately reject live presets. Reuse that
    // fail-closed boundary until trustworthy live pre-bout attestation exists.
    const [team] =
      yield sql`SELECT locked_at FROM fantasy_teams WHERE basho_id=${id} AND owner_user_id=${owner}`;
    if (!team?.locked_at) return undefined;
    try {
      return yield* joker.getJokerSnapshot(id, now, owner);
    } catch {
      return undefined;
    }
  }
  function eligible(snapshot: JokerSnapshot | undefined, day: number) {
    const w = snapshot?.windows[day - 1];
    return (
      !!snapshot &&
      !snapshot.budgetDiscrepancy &&
      snapshot.remaining > 0 &&
      w?.status === "open" &&
      w.targets.length > 0 &&
      !snapshot.allocations.some((a) => a.day === day && a.state !== "removed")
    );
  }
  const repos = {
    listPushPilotRoster: (id: string) =>
      execute(
        (function* (): Generator<SQL, string[], Row[]> {
          const { pilot } = yield* load(id);
          return pilot
            ? (JSON.parse(String(pilot.roster_json)) as string[])
            : [];
        })(),
      ),
    preparePushPilot: (id: string, owners: readonly string[]) =>
      execute(
        (function* (): Generator<SQL, void, Row[]> {
          const { pilot } = yield* load(id);
          const roster = [...new Set(owners)].sort();
          if (
            roster.length !== owners.length ||
            !roster.length ||
            roster.length > PUSH_LIMITS.testers ||
            roster.some((o) => !o || o.length > 200)
          )
            throw new PushError("invalid-roster");
          const json = JSON.stringify(roster);
          if (pilot && pilot.roster_json !== json)
            throw new PushError("roster-immutable");
          yield sql`INSERT INTO push_pilots(basho_id,roster_json) VALUES(${id},${json}) ON CONFLICT(basho_id) DO NOTHING RETURNING basho_id`;
        })(),
      ),
    // Operator boundary only, not exposed by any activation API or env switch.
    setPushPilotEnabled: (id: string, enabled: boolean) =>
      execute(
        (function* (): Generator<SQL, void, Row[]> {
          const { pilot } = yield* load(id);
          if (!pilot) throw new PushError("pilot-not-prepared");
          yield sql`UPDATE push_pilots SET enabled=${enabled ? 1 : 0} WHERE basho_id=${id} RETURNING basho_id`;
        })(),
      ),
    getPushPreferences: (id: string, owner: string, now: () => Date) =>
      execute(
        (function* (): Generator<SQL, PushPreferences, Row[]> {
          const { basho, pilot } = yield* load(id);
          const [s] =
            yield sql`SELECT * FROM push_subscriptions WHERE owner_id=${owner}`;
          const data = s
            ? (JSON.parse(String(s.payload_json)) as PushSubscriptionData)
            : undefined;
          const subscribed =
            !!s &&
            s.basho_id === id &&
            (data!.expirationTime === null ||
              data!.expirationTime > now().getTime());
          return {
            available: active(basho, pilot, owner, now().toISOString()),
            subscribed,
            revision: subscribed ? String(s.revision) : null,
            ...(subscribed
              ? { deviceId: String(s.device_id), timezone: data!.timezone }
              : {}),
          };
        })(),
      ),
    savePushSubscription: (
      id: string,
      owner: string,
      device: string,
      expectedRevision: string | null,
      data: PushSubscriptionData,
      now: () => Date,
      revokeToken = randomBytes(32).toString("base64url"),
    ) =>
      execute(
        (function* (): Generator<SQL, string, Row[]> {
          const { basho, pilot } = yield* load(id);
          const at = now().toISOString();
          if (!active(basho, pilot, owner, at))
            throw new PushError("pilot-unavailable");
          pushQuietHours(data.timezone, at);
          if (
            data.expirationTime !== null &&
            (!Number.isFinite(data.expirationTime) ||
              data.expirationTime <= Date.parse(at))
          )
            throw new PushError("expired-subscription");
          const [old] =
            yield sql`SELECT * FROM push_subscriptions WHERE owner_id=${owner}`;
          if ((old ? String(old.revision) : null) !== expectedRevision)
            throw new PushError("stale-subscription");
          const [collision] =
            yield sql`SELECT owner_id FROM push_subscriptions WHERE (device_id=${device} OR endpoint_hash=${hash(data.endpoint)}) AND owner_id<>${owner}`;
          if (collision) throw new PushError("device-unavailable");
          const revision = randomUUID();
          yield sql`INSERT INTO push_subscriptions(owner_id,basho_id,device_id,endpoint_hash,revoke_hash,revision,payload_json,consent_at) VALUES(${owner},${id},${device},${hash(data.endpoint)},${hash(revokeToken)},${revision},${JSON.stringify(data)},${at}) ON CONFLICT(owner_id) DO UPDATE SET basho_id=excluded.basho_id,device_id=excluded.device_id,endpoint_hash=excluded.endpoint_hash,revoke_hash=excluded.revoke_hash,revision=excluded.revision,payload_json=excluded.payload_json,consent_at=excluded.consent_at RETURNING owner_id`;
          return revision;
        })(),
      ),
    revokePushDevice: (id: string, device: string, token: string) =>
      execute(
        (function* (): Generator<SQL, void, Row[]> {
          yield* load(id);
          yield sql`DELETE FROM push_subscriptions WHERE device_id=${device} AND revoke_hash=${hash(token)} RETURNING owner_id`;
        })(),
      ),
    disablePushSubscriptions: (id: string, owner: string, device?: string) =>
      execute(
        (function* (): Generator<SQL, void, Row[]> {
          yield* load(id);
          yield sql`DELETE FROM push_subscriptions WHERE owner_id=${owner}${device === undefined ? sql`` : sql` AND device_id=${device}`} RETURNING owner_id`;
        })(),
      ),
    claimPushOpening: (
      id: string,
      day: number,
      owner: string,
      now: () => Date,
    ) =>
      execute(
        (function* (): Generator<SQL, PushClaim | undefined, Row[]> {
          if (!Number.isInteger(day) || day < 1 || day > 15)
            throw new PushError("invalid-day");
          const { basho, pilot } = yield* load(id);
          const at = now().toISOString();
          if (!active(basho, pilot, owner, at)) return;
          // Minimal per-owner/day quota bits survive delivery-status retention.
          // Purging statuses must not create another opening opportunity.
          const decisions = JSON.parse(String(pilot!.decisions_json)) as Record<
            string,
            number
          >;
          const ownerKey = hash(owner),
            bit = 1 << (day - 1);
          if (((decisions[ownerKey] ?? 0) & bit) !== 0) return;
          decisions[ownerKey] = (decisions[ownerKey] ?? 0) | bit;
          const [s] =
            yield sql`SELECT * FROM push_subscriptions WHERE owner_id=${owner} AND basho_id=${id}`;
          const data = s
            ? (JSON.parse(String(s.payload_json)) as PushSubscriptionData)
            : undefined;
          let reason: string | undefined;
          if (!s) reason = "not-opted-in";
          else if (
            data!.expirationTime !== null &&
            data!.expirationTime <= Date.parse(at)
          )
            reason = "expired";
          else if (pushQuietHours(data!.timezone, at)) reason = "quiet-hours";
          const snapshot = reason
            ? undefined
            : yield* eligibility(id, owner, now);
          if (!reason && !eligible(snapshot, day)) reason = "ineligible";
          const window = snapshot?.windows[day - 1];
          const ttl = window
            ? Math.floor(
                (Date.parse(window.deadline) - Date.parse(snapshot!.now)) /
                  1000,
              )
            : 0;
          if (!reason && ttl < 1) reason = "late";
          const counts = JSON.parse(String(pilot!.day_counts_json)) as Record<
            string,
            number
          >;
          if (
            !reason &&
            (Number(pilot!.total_attempts) >= PUSH_LIMITS.total ||
              (counts[day] ?? 0) >= PUSH_LIMITS.daily)
          )
            reason = "cap";
          const openingId = randomUUID();
          yield sql`INSERT INTO push_openings(id,basho_id,owner_key,day,status,reason,attempted,subscription_revision,created_at) VALUES(${openingId},${id},${hash(owner)},${day},${reason ? "skipped" : "reserved"},${reason ?? null},${reason ? 0 : 1},${s ? String(s.revision) : null},${at}) RETURNING id`;
          if (reason) {
            yield sql`UPDATE push_pilots SET decisions_json=${JSON.stringify(decisions)} WHERE basho_id=${id} RETURNING basho_id`;
            return;
          }
          counts[day] = (counts[day] ?? 0) + 1;
          yield sql`UPDATE push_pilots SET total_attempts=total_attempts+1,day_counts_json=${JSON.stringify(counts)},decisions_json=${JSON.stringify(decisions)} WHERE basho_id=${id} RETURNING basho_id`;
          return {
            id: openingId,
            bashoId: id,
            day,
            ownerId: owner,
            revision: String(s!.revision),
            subscription: data!,
            ttl,
            payload: pushPayload(id, day, window!.deadline),
          };
        })(),
      ),
    recheckPushClaim: (claim: PushClaim, now: () => Date) =>
      execute(
        (function* (): Generator<SQL, PushClaim | undefined, Row[]> {
          const { basho, pilot } = yield* load(claim.bashoId);
          const at = now().toISOString();
          const [s] =
            yield sql`SELECT * FROM push_subscriptions WHERE owner_id=${claim.ownerId} AND revision=${claim.revision}`;
          const [opening] =
            yield sql`SELECT * FROM push_openings WHERE id=${claim.id}`;
          let okay =
            active(basho, pilot, claim.ownerId, at) &&
            !!s &&
            opening?.status === "reserved";
          if (
            okay &&
            claim.subscription.expirationTime !== null &&
            claim.subscription.expirationTime <= Date.parse(at)
          )
            okay = false;
          if (okay && pushQuietHours(claim.subscription.timezone, at))
            okay = false;
          const snapshot = okay
            ? yield* eligibility(claim.bashoId, claim.ownerId, now)
            : undefined;
          const ttl = snapshot
            ? Math.floor(
                (Date.parse(claim.payload.expiresAt) -
                  Date.parse(snapshot.now)) /
                  1000,
              )
            : 0;
          if (!okay || !eligible(snapshot, claim.day) || ttl < 1) {
            yield sql`UPDATE push_openings SET status='skipped',reason='changed-before-handoff' WHERE id=${claim.id} AND status='reserved' RETURNING id`;
            return;
          }
          const handedOff =
            yield sql`UPDATE push_openings SET status='unknown' WHERE id=${claim.id} AND status='reserved' RETURNING id`;
          return handedOff.length ? { ...claim, ttl } : undefined;
        })(),
      ),
    finishPushAttempt: (
      claim: PushClaim,
      outcome: "accepted" | "failed" | "expired" | "unknown",
    ) =>
      execute(
        (function* (): Generator<SQL, void, Row[]> {
          yield* load(claim.bashoId);
          const settled =
            yield sql`UPDATE push_openings SET status=${outcome} WHERE id=${claim.id} AND (status='unknown' OR (status='reserved' AND ${outcome}='failed')) RETURNING id`;
          if (settled.length && outcome === "expired")
            yield sql`DELETE FROM push_subscriptions WHERE owner_id=${claim.ownerId} AND revision=${claim.revision} RETURNING owner_id`;
        })(),
      ),
    cleanPushRetention: (id: string, now: () => Date) =>
      execute(
        (function* (): Generator<
          SQL,
          { subscriptions: number; statuses: number },
          Row[]
        > {
          const { basho } = yield* load(id);
          const at = now().toISOString();
          const end = pushBashoEnd(String(basho.end_date));
          if (at >= end || basho.status === "complete")
            yield sql`UPDATE push_pilots SET enabled=0 WHERE basho_id=${id} RETURNING basho_id`;
          const rows =
            yield sql`SELECT * FROM push_subscriptions WHERE basho_id=${id}`;
          let subscriptions = 0;
          for (const s of rows) {
            const data = JSON.parse(
              String(s.payload_json),
            ) as PushSubscriptionData;
            if (
              Date.parse(at) >= Date.parse(end) + 7 * 86400000 ||
              (data.expirationTime !== null &&
                data.expirationTime <= Date.parse(at))
            ) {
              yield sql`DELETE FROM push_subscriptions WHERE owner_id=${String(s.owner_id)} RETURNING owner_id`;
              subscriptions++;
            }
          }
          const cutoff = new Date(Date.parse(at) - 30 * 86400000).toISOString();
          const deleted =
            yield sql`DELETE FROM push_openings WHERE basho_id=${id} AND created_at<=${cutoff} RETURNING id`;
          yield sql`UPDATE push_pilots SET last_cleanup_at=${at} WHERE basho_id=${id} RETURNING basho_id`;
          return { subscriptions, statuses: deleted.length };
        })(),
      ),
  };
  return repos;
}
export type PushRepositories = ReturnType<typeof createPushRepositories>;
