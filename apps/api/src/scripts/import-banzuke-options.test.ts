import { describe, expect, it } from "vitest";
import { parseBanzukeImportArgs } from "./import-banzuke-options.js";

describe("banzuke CLI source selection", () => {
  it("retains JSA discovery by default and supports explicit backup dry runs", () => {
    expect(parseBanzukeImportArgs([])).toEqual({
      source: "jsa",
      bashoId: undefined,
      dryRun: false,
    });
    expect(
      parseBanzukeImportArgs([
        "--",
        "--source",
        "sumo-api",
        "--basho",
        "2026-05",
        "--dry-run",
      ]),
    ).toEqual({ source: "sumo-api", bashoId: "2026-05", dryRun: true });
  });
  it.each([
    ["--source"],
    ["--source", "other"],
    ["--source", "sumo-api"],
    ["--basho", "2026-05"],
    ["--source", "sumo-api", "--basho", "2026-02"],
    ["--source", "sumo-api", "--basho"],
    ["--unknown"],
  ])("rejects invalid invocation %j before database setup", (...args) => {
    expect(() => parseBanzukeImportArgs(args)).toThrow();
  });
});
