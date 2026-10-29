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
): Promise<Resolved<BanzukeImportCommand>>;
export function reconcileImportCommand(
  repositories: Repositories,
  bashoId: string,
  command: BoutResultsImportCommand,
): Promise<Resolved<BoutResultsImportCommand>>;
export function reconcileImportCommand(
  repositories: Repositories,
  bashoId: string,
  command: ScheduledBoutsImportCommand,
): Promise<Resolved<ScheduledBoutsImportCommand>>;
export async function reconcileImportCommand(
  repositories: Repositories,
  bashoId: string,
  command: ImportCommand,
): Promise<Resolved<ImportCommand>> {
  const plan = await resolveRikishiIdentities(
    repositories,
    bashoId,
    command.rikishi ?? [],
  );
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
