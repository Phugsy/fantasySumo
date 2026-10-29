/** The exact stored evidence used for a same-basho identity attachment. */
export interface IdentityRosterExpectation {
  bashoId: string;
  key: string;
}

export function getIdentityRosterKey(
  entries: readonly { rikishiId: string; shikona?: string | null }[],
): string {
  return JSON.stringify(
    entries
      .map((entry) => [entry.rikishiId, entry.shikona ?? ""] as const)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
  );
}
