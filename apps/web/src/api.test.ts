import { describe, expect, it } from "vitest";
import { getCurrentBashoUrl } from "./api";

describe("getCurrentBashoUrl", () => {
  it("uses the normal current-basho route by default", () => {
    expect(getCurrentBashoUrl(undefined)).toBe("/api/basho/current");
  });

  it("selects the demo basho only in explicit demo mode", () => {
    expect(getCurrentBashoUrl("demo")).toBe("/api/basho/current?mode=demo");
  });
});
