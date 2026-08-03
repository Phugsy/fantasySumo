import { describe, expect, it } from "vitest";
import {
  getNeonAuthErrorMessage,
  NeonAccessTokenError,
  requireNeonAccessToken,
} from "./authClient";

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

  it("adds the current origin to Neon invalid-origin errors", () => {
    expect(
      getNeonAuthErrorMessage("Invalid origin", "Unable to sign in."),
    ).toBe(
      "Neon Auth rejected this origin (http://localhost:3000). Add this exact URL in Neon Auth trusted domains.",
    );
  });
});

describe("requireNeonAccessToken", () => {
  it("returns a non-empty Neon access token", () => {
    expect(
      requireNeonAccessToken({
        data: { token: " signed-jwt " },
        error: null,
      }),
    ).toBe("signed-jwt");
  });

  it.each([
    {
      data: null,
      error: { message: "provider detail must stay private" },
    },
    {
      data: { token: "" },
      error: null,
    },
  ])("raises a safe error when Neon does not issue a token", (response) => {
    let thrownError: unknown;

    try {
      requireNeonAccessToken(response);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(NeonAccessTokenError);
    expect(thrownError).toMatchObject({
      message:
        "Neon Auth signed you in, but did not issue an access token. Please sign in again.",
    });
    expect(String(thrownError)).not.toContain(
      "provider detail must stay private",
    );
  });
});
