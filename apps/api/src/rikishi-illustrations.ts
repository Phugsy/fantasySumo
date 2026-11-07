import type { RikishiSourceIdentity } from "@fantasy-sumo/db";
import { rikishiIllustrations } from "./rikishi-illustration-catalog.js";

// Names are labels only: established, namespaced aliases determine identity.
export function getRikishiIllustration(
  rikishiId: string,
  isDemo: boolean,
  aliases: RikishiSourceIdentity[],
): { url: string } | undefined {
  if (isDemo) {
    const demoJsaId =
      rikishiId === "onosato"
        ? "4227"
        : rikishiId === "hoshoryu"
          ? "3842"
          : undefined;
    const entry = rikishiIllustrations.find(
      (entry) => entry.jsaId === demoJsaId,
    );
    return entry ? { url: entry.url } : undefined;
  }
  const matches = rikishiIllustrations.filter((entry) =>
    aliases.some(
      (alias) =>
        alias.rikishiId === rikishiId &&
        ((alias.source === "jsa" && alias.sourceRikishiId === entry.jsaId) ||
          (alias.source === "sumo-api" &&
            alias.sourceRikishiId === entry.sumoApiId)),
    ),
  );
  // Conflicting provider identities must never silently select a likeness.
  return matches.length === 1 ? { url: matches[0]!.url } : undefined;
}
