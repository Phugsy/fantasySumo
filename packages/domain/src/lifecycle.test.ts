import { describe, expect, it } from "vitest";
import type { Basho } from "./types.js";
import {
  canEditFantasyPicks,
  getFantasyPickLockDate,
  getBashoLifecycleLabel,
  getPickLockMessage,
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

  it("locks fantasy picks on the calendar day before the basho starts", () => {
    expect(getFantasyPickLockDate(baseBasho)).toBe("2026-05-09");
    expect(canEditFantasyPicks(baseBasho, "2026-05-08")).toBe(true);
    expect(canEditFantasyPicks(baseBasho, "2026-05-09")).toBe(false);
    expect(canEditFantasyPicks(baseBasho, "2026-05-10")).toBe(false);
  });

  it("fails closed when a dated pick check receives an invalid date", () => {
    expect(
      canEditFantasyPicks({ ...baseBasho, startDate: "invalid" }, "2026-05-08"),
    ).toBe(false);
    expect(canEditFantasyPicks(baseBasho, "invalid")).toBe(false);
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
    expect(getPickLockMessage(baseBasho, "2026-05-09")).toBe(
      "Picks closed the day before this basho starts.",
    );
  });
});
