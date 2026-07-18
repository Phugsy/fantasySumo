import { describe, expect, it } from "vitest";
import type { Basho } from "./types.js";
import {
  canEditFantasyPicks,
  getBashoLifecycleLabel,
  getPickLockMessage,
  preserveBashoLifecycleProgress,
} from "./lifecycle.js";

const baseBasho: Basho = {
  id: "2026-05",
  name: "May 2026 Basho",
  startDate: "2026-05-10",
  endDate: "2026-05-24",
  status: "upcoming",
};

describe("basho lifecycle", () => {
  it("allows fantasy picks only while the basho is upcoming", () => {
    expect(canEditFantasyPicks({ ...baseBasho, status: "upcoming" })).toBe(
      true,
    );
    expect(canEditFantasyPicks({ ...baseBasho, status: "locked" })).toBe(false);
    expect(canEditFantasyPicks({ ...baseBasho, status: "active" })).toBe(false);
    expect(canEditFantasyPicks({ ...baseBasho, status: "complete" })).toBe(
      false,
    );
  });

  it("preserves the furthest lifecycle and calendar progress", () => {
    expect(
      preserveBashoLifecycleProgress(
        { ...baseBasho, status: "locked", currentDay: 0 },
        {
          ...baseBasho,
          name: "Refreshed May Basho",
          status: "upcoming",
          currentDay: 3,
        },
      ),
    ).toMatchObject({
      name: "Refreshed May Basho",
      status: "locked",
      currentDay: 3,
    });
  });

  it("labels each lifecycle status for user-facing state", () => {
    expect(getBashoLifecycleLabel("upcoming")).toBe("Picks open");
    expect(getBashoLifecycleLabel("locked")).toBe("Picks locked");
    expect(getBashoLifecycleLabel("active")).toBe("Scoring in progress");
    expect(getBashoLifecycleLabel("complete")).toBe("Final scores");
  });

  it("explains why picks cannot be edited after lock", () => {
    expect(getPickLockMessage({ ...baseBasho, status: "upcoming" })).toBe(
      undefined,
    );
    expect(getPickLockMessage({ ...baseBasho, status: "locked" })).toBe(
      "Picks are locked for this basho.",
    );
    expect(getPickLockMessage({ ...baseBasho, status: "active" })).toBe(
      "This basho has started, so picks are locked.",
    );
    expect(getPickLockMessage({ ...baseBasho, status: "complete" })).toBe(
      "This basho is complete, so picks are closed.",
    );
  });
});
