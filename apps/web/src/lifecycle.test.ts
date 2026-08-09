import { describe, expect, it } from "vitest";
import type { Basho } from "./types";
import { canEditFantasyPicks, getPickLockMessage } from "./lifecycle";

const upcomingBasho: Basho = {
  id: "2026-05",
  isDemo: false,
  name: "May 2026 Basho",
  startDate: "2026-05-10",
  endDate: "2026-05-24",
  status: "upcoming",
  teamSize: 2,
};

describe("fantasy pick lifecycle", () => {
  it("keeps an individually locked team read-only while the basho is upcoming", () => {
    const teamLockedAt = "2026-05-08T02:00:00.000Z";

    expect(canEditFantasyPicks(upcomingBasho, teamLockedAt)).toBe(false);
    expect(getPickLockMessage(upcomingBasho, teamLockedAt)).toBe(
      "Picks are locked for this basho.",
    );
  });

  it("keeps picks editable for an unlocked team before the basho", () => {
    expect(canEditFantasyPicks(upcomingBasho)).toBe(true);
    expect(getPickLockMessage(upcomingBasho)).toBeUndefined();
  });
});
