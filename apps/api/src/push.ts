import { isCompleteScheduledBoutPublicationSource } from "@fantasy-sumo/domain";
import type { Repositories } from "@fantasy-sumo/db";
import type { PushTransport, PushOutcome } from "./push-transport.js";
export interface PushRuntime {
  bashoId: string;
  origin: string;
  publicKey: string;
  allowedHosts: readonly string[];
  transport: PushTransport;
}
// This is only installed by explicit AppOptions injection. Production entrypoints
// supply no runtime: no activation env switch, keys or live collection is wired.
export function installPushPublicationObserver(
  repositories: Repositories,
  runtime: PushRuntime,
  now: () => Date,
) {
  const schedule = repositories.applyScheduledBoutsImport.bind(repositories);
  const results =
    repositories.applyScheduledBoutsAndBoutResultsImport.bind(repositories);
  async function observe(id: string, day: number, source: string) {
    if (!isCompleteScheduledBoutPublicationSource(source)) return;
    if (id !== runtime.bashoId) return;
    try {
      await deliverPushOpening(repositories, runtime, day, now);
    } catch {
      /* Import has committed. Reminder failure cannot roll it back. */
    }
  }
  repositories.applyScheduledBoutsImport = async (data) => {
    const result = await schedule(data);
    if (result === "applied")
      await observe(
        data.publication.bashoId,
        data.publication.day,
        data.publication.source,
      );
    return result;
  };
  repositories.applyScheduledBoutsAndBoutResultsImport = async (data) => {
    const result = await results(data);
    if (result === "applied")
      await observe(
        data.scheduledBouts.publication.bashoId,
        data.scheduledBouts.publication.day,
        data.scheduledBouts.publication.source,
      );
    return result;
  };
}
export async function deliverPushOpening(
  repositories: Repositories,
  runtime: PushRuntime,
  day: number,
  now: () => Date,
) {
  await repositories.cleanPushRetention(runtime.bashoId, now);
  const roster = await repositories.listPushPilotRoster(runtime.bashoId);
  for (let offset = 0; offset < roster.length; offset += 4) {
    await Promise.allSettled(
      roster.slice(offset, offset + 4).map(async (owner) => {
        const claim = await repositories.claimPushOpening(
          runtime.bashoId,
          day,
          owner,
          now,
        );
        if (!claim) return;
        const prepared = await runtime.transport(claim).catch(() => undefined);
        if (!prepared) {
          await repositories.finishPushAttempt(claim, "failed");
          return;
        }
        const ready = await repositories.recheckPushClaim(claim, now);
        if (!ready) return;
        let outcome: PushOutcome = "unknown";
        try {
          outcome = await prepared.send(ready);
        } catch {
          /* uncertainty is durable; no retry */
        }
        await repositories.finishPushAttempt(ready, outcome);
      }),
    );
  }
}
