import { createHash } from "node:crypto";
import {
  getIdentityRosterKey,
  type IdentityRosterExpectation,
  type Repositories,
  type RikishiSourceIdentity,
} from "@fantasy-sumo/db";
import type { Rikishi } from "@fantasy-sumo/domain";
import type {
  BanzukeImportCommand,
  BoutResultsImportCommand,
  ScheduledBoutsImportCommand,
  SourceRikishi,
} from "./types.js";
import { ImportValidationError } from "./validation.js";

type ImportCommand =
  | BanzukeImportCommand
  | BoutResultsImportCommand
  | ScheduledBoutsImportCommand;
type Resolved<T> = T & {
  sourceIdentities: RikishiSourceIdentity[];
  identityRoster?: IdentityRosterExpectation;
};
type IdentityPlan = Awaited<ReturnType<typeof resolveRikishiIdentities>>;

const nameKey = (name: string) => name.normalize("NFKC").trim().toLowerCase();

function conflict(message: string): never {
  throw new ImportValidationError([
    { path: "rikishi.sourceIdentity", message },
  ]);
}

/** Read-only planning: aliases are saved only inside the eventual import transaction. */
export async function resolveRikishiIdentities(
  repositories: Repositories,
  bashoId: string,
  incoming: readonly SourceRikishi[],
) {
  const [known, aliases, roster, basho] = await Promise.all([
    repositories.listRikishi(),
    repositories.listRikishiSourceIdentities(),
    repositories.listBanzukeEntriesForBasho(bashoId),
    repositories.getBasho(bashoId),
  ]);
  const knownById = new Map(known.map((entry) => [entry.id, entry]));
  const idMap = new Map<string, string>();
  const sourceIdentities: RikishiSourceIdentity[] = [];
  const rikishi = new Map<string, Rikishi>();
  const seen = new Map<string, SourceRikishi>();

  for (const entry of incoming) {
    const previous = seen.get(entry.id);
    if (
      previous !== undefined &&
      (previous.shikona !== entry.shikona ||
        previous.heya !== entry.heya ||
        previous.sourceIdentity?.source !== entry.sourceIdentity?.source ||
        previous.sourceIdentity?.sourceRikishiId !==
          entry.sourceIdentity?.sourceRikishiId)
    ) {
      conflict(`Conflicting source rows for ${entry.id}.`);
    }
    seen.set(entry.id, entry);
    const identity = entry.sourceIdentity;
    let canonicalId = entry.id;
    if (identity !== undefined) {
      if (basho?.isDemo)
        conflict("Live source identities cannot attach to a demo basho.");
      if (
        !["jsa", "sumo-api"].includes(identity.source) ||
        !/^[1-9][0-9]*$/.test(identity.sourceRikishiId)
      ) {
        conflict(`Invalid source identity for ${entry.id}.`);
      }
      const existing = aliases.find(
        (alias) =>
          alias.source === identity.source &&
          alias.sourceRikishiId === identity.sourceRikishiId,
      );
      if (existing !== undefined) {
        canonicalId = existing.rikishiId;
      } else {
        // Only a same-tournament snapshot can bridge providers or adopt a legacy
        // row. A shared current/historical name alone is never identity evidence.
        const matches = roster.filter(
          (rank) =>
            nameKey(
              rank.shikona ?? knownById.get(rank.rikishiId)?.shikona ?? "",
            ) === nameKey(entry.shikona),
        );
        if (matches.length > 1)
          conflict(
            `Ambiguous same-basho shikona ${entry.shikona}; attach a verified alias manually.`,
          );
        const match = matches[0];
        if (match !== undefined) {
          canonicalId = match.rikishiId;
        } else {
          if (
            known.some(
              (candidate) =>
                nameKey(candidate.shikona) === nameKey(entry.shikona),
            )
          ) {
            conflict(
              `Shikona ${entry.shikona} exists outside the target roster; attach a verified alias manually.`,
            );
          }
          // Stable across retries and dry runs, opaque to shikona changes. It is
          // a local ID, never a provider ID used in another provider's namespace.
          canonicalId = `rk_${createHash("sha256").update(`${identity.source}:${identity.sourceRikishiId}`).digest("hex").slice(0, 32)}`;
        }
        const sameProvider = [...aliases, ...sourceIdentities].find(
          (alias) =>
            alias.source === identity.source &&
            alias.rikishiId === canonicalId &&
            alias.sourceRikishiId !== identity.sourceRikishiId,
        );
        if (sameProvider !== undefined)
          conflict(
            `Source ID collision for ${entry.shikona}; existing aliases cannot be reassigned.`,
          );
      }
      sourceIdentities.push({ ...identity, rikishiId: canonicalId });
    }
    idMap.set(entry.id, canonicalId);
    rikishi.set(canonicalId, {
      id: canonicalId,
      shikona: entry.shikona,
      ...(entry.heya === undefined ? {} : { heya: entry.heya }),
    });
  }
  const resolve = (id: string): string => {
    const resolved = idMap.get(id);
    if (resolved === undefined && /^(jsa|sumo-api):/.test(id))
      conflict(`Missing source identity for ${id}.`);
    return resolved ?? id;
  };
  return {
    resolve,
    rikishi: [...rikishi.values()],
    sourceIdentities,
    identityRoster:
      sourceIdentities.length === 0
        ? undefined
        : {
            bashoId,
            key: getIdentityRosterKey(
              roster.map((entry) => ({
                rikishiId: entry.rikishiId,
                shikona:
                  entry.shikona ?? knownById.get(entry.rikishiId)?.shikona,
              })),
            ),
          },
  };
}

export function reconcileImportCommand(
  repositories: Repositories,
  bashoId: string,
  command: BanzukeImportCommand,
  sharedPlan?: IdentityPlan,
): Promise<Resolved<BanzukeImportCommand>>;
export function reconcileImportCommand(
  repositories: Repositories,
  bashoId: string,
  command: BoutResultsImportCommand,
  sharedPlan?: IdentityPlan,
): Promise<Resolved<BoutResultsImportCommand>>;
export function reconcileImportCommand(
  repositories: Repositories,
  bashoId: string,
  command: ScheduledBoutsImportCommand,
  sharedPlan?: IdentityPlan,
): Promise<Resolved<ScheduledBoutsImportCommand>>;
export async function reconcileImportCommand(
  repositories: Repositories,
  bashoId: string,
  command: ImportCommand,
  sharedPlan?: IdentityPlan,
): Promise<Resolved<ImportCommand>> {
  const plan =
    sharedPlan ??
    (await resolveRikishiIdentities(
      repositories,
      bashoId,
      command.rikishi ?? [],
    ));
  const identityData = {
    rikishi: plan.rikishi,
    sourceIdentities: plan.sourceIdentities,
    identityRoster: plan.identityRoster,
  };
  if ("banzukeEntries" in command) {
    return {
      ...command,
      ...identityData,
      banzukeEntries: command.banzukeEntries.map((entry) => {
        const rikishiId = plan.resolve(entry.rikishiId);
        return {
          ...entry,
          rikishiId,
          id:
            rikishiId === entry.rikishiId
              ? entry.id
              : `${bashoId}-${rikishiId}`,
        };
      }),
    };
  }
  if ("results" in command) {
    return {
      ...command,
      ...identityData,
      results: command.results.map((result) => ({
        ...result,
        winnerRikishiId: plan.resolve(result.winnerRikishiId),
        loserRikishiId: plan.resolve(result.loserRikishiId),
      })),
    };
  }
  return {
    ...command,
    ...identityData,
    attestedRikishiIds: command.attestedRikishiIds?.map(plan.resolve),
    bouts: command.bouts.map((bout) => ({
      ...bout,
      eastRikishiId: plan.resolve(bout.eastRikishiId),
      westRikishiId: plan.resolve(bout.westRikishiId),
      ...(bout.withdrawnRikishiId === undefined
        ? {}
        : { withdrawnRikishiId: plan.resolve(bout.withdrawnRikishiId) }),
    })),
  };
}

/** Plan both commands from the same roster/alias snapshot without persisting aliases early. */
export async function reconcileScheduledBoutsAndResults(
  repositories: Repositories,
  schedule: ScheduledBoutsImportCommand,
  results: BoutResultsImportCommand,
) {
  const identityKey = (entry: SourceRikishi) =>
    entry.sourceIdentity === undefined
      ? undefined
      : `${entry.sourceIdentity.source}:${entry.sourceIdentity.sourceRikishiId}`;
  const preferredByIdentity = new Map(
    (schedule.rikishi ?? []).flatMap((entry) => {
      const key = identityKey(entry);
      return key === undefined ? [] : [[key, entry] as const];
    }),
  );
  const incoming = [
    ...(schedule.rikishi ?? []),
    ...(results.rikishi ?? []).map((entry) => {
      const key = identityKey(entry);
      const preferred =
        key === undefined ? undefined : preferredByIdentity.get(key);
      // Schedule metadata already prefers the attesting banzuke's name. Only
      // share that preference when provider identities agree; keep each raw
      // reference and identity so conflicting mappings still fail validation.
      return preferred === undefined
        ? entry
        : { ...preferred, id: entry.id, sourceIdentity: entry.sourceIdentity };
    }),
  ];
  const plan = await resolveRikishiIdentities(
    repositories,
    schedule.bashoId,
    incoming,
  );
  const [scheduleCommand, resultsCommand] = await Promise.all([
    reconcileImportCommand(repositories, schedule.bashoId, schedule, plan),
    reconcileImportCommand(repositories, results.bashoId, results, plan),
  ]);
  return { scheduleCommand, resultsCommand };
}
