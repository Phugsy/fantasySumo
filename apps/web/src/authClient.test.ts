import { describe, expect, it } from "vitest";
import { getNeonAuthErrorMessage } from "./authClient";

describe("getNeonAuthErrorMessage", () => {
  it("clarifies Neon password policy errors", () => {
    expect(
      getNeonAuthErrorMessage(
        "Password does not meet security requirements",
        "Unable to create account.",
      ),
    ).toBe(
      "Choose a stronger password. Use at least 8 characters and avoid common passwords.",
    );
  });

  it("keeps unrelated auth errors intact", () => {
    expect(
      getNeonAuthErrorMessage(
        "Invalid email or password",
        "Unable to sign in.",
      ),
    ).toBe("Invalid email or password");
  });
});
