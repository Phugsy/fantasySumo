import type {
  Basho,
  BoutResult,
  ScheduledBout,
  ScheduledBoutPublication,
} from "./types.js";
import { getVerifiedBoutResultsThroughDay } from "./bout-result-completeness.js";
import { isCompleteScheduledBoutPublicationSource } from "./scheduled-bout-publication.js";

export const JOKER_PRESET = "three-joker-v1" as const;
export interface JokerSelection {
  teamId: string;
  day: number;
  rikishiId: string;
  boutId: string;
  opponentId: string;
}
export interface JokerAllocation extends JokerSelection {
  revision: number;
  selectedAt: string;
  state: "reserved" | "locked" | "consumed" | "refunded" | "removed";
}
export interface JokerFacts {
  basho: Basho;
  bouts: ScheduledBout[];
  publications: ScheduledBoutPublication[];
  results: BoutResult[];
}
export function jokerDeadline(startDate: string, day: number): string {
  if (!Number.isInteger(day) || day < 1 || day > 15)
    throw new Error("Invalid basho day.");
  const date = new Date(`${startDate}T03:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid basho date.");
  date.setUTCDate(date.getUTCDate() + day - 1);
  return date.toISOString();
}
export function jokerVerifiedDay(facts: JokerFacts): number {
  return facts.basho.status === "upcoming"
    ? 0
    : getVerifiedBoutResultsThroughDay({
        boutResults: facts.results,
        scheduledBouts: facts.bouts,
        completeScheduleDays: new Set(
          facts.publications
            .filter((p) => isAttestedCard(facts, p))
            .map((p) => p.day),
        ),
        throughDay: 15,
      });
}
export function jokerWindow(
  facts: JokerFacts,
  day: number,
  now: string,
): "open" | "closed" | "unavailable" {
  if (
    now >= jokerDeadline(facts.basho.startDate, day) ||
    facts.basho.status === "complete"
  )
    return "closed";
  const published = facts.publications.some(
    (p) => p.day === day && p.publishedAt <= now && isAttestedCard(facts, p),
  );
  if (!published || !facts.bouts.some((b) => b.day === day))
    return "unavailable";
  if (
    facts.basho.status === "upcoming" ||
    facts.results.some((r) => r.day === day)
  )
    return "closed";
  return "open";
}
export function resolveJoker(
  allocation: JokerAllocation,
  facts: JokerFacts,
  now: string,
): JokerAllocation["state"] {
  if (allocation.state === "removed") return "removed";
  if (now < jokerDeadline(facts.basho.startDate, allocation.day))
    return "reserved";
  const exactPair = (east: string, west: string) =>
    (east === allocation.rikishiId && west === allocation.opponentId) ||
    (west === allocation.rikishiId && east === allocation.opponentId);
  const card = facts.bouts.find(
    (b) =>
      b.id === allocation.boutId &&
      b.day === allocation.day &&
      exactPair(b.eastRikishiId, b.westRikishiId),
  );
  const attested = facts.publications.some(
    (p) => p.day === allocation.day && isAttestedCard(facts, p),
  );
  // Schedule-only corrections retain old results. An exact attested cancellation
  // overrides that stale result before it can consume or boost the joker.
  if (attested && card?.status === "cancelled") return "refunded";
  const result =
    allocation.day <= jokerVerifiedDay(facts)
      ? facts.results.find(
          (r) =>
            r.day === allocation.day &&
            exactPair(r.winnerRikishiId, r.loserRikishiId),
        )
      : undefined;
  if (result)
    return result.winnerAbsent ||
      result.loserAbsent ||
      result.kimarite?.trim().toLowerCase() === "fusen"
      ? "refunded"
      : "consumed";
  return "locked";
}

function isAttestedCard(
  facts: JokerFacts,
  publication: ScheduledBoutPublication,
): boolean {
  return (
    isCompleteScheduledBoutPublicationSource(publication.source) ||
    (facts.basho.isDemo &&
      facts.basho.id === "demo-2026-05" &&
      publication.source === "demo-fixture")
  );
}
