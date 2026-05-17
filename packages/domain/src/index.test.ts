import { describe, expect, it } from "vitest";
import { foundationLabel } from "./index";

describe("foundationLabel", () => {
  it("identifies the shared domain package boundary", () => {
    expect(foundationLabel).toBe("foundation");
  });
});
