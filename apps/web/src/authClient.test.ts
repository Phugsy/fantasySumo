import { describe, expect, it, vi } from "vitest";
import {
  createNeonSessionCompletionTokenProvider,
  getNeonAuthErrorMessage,
  IncompleteSessionError,
  requestFreshNeonAccessToken,
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
        data: { session: { token: " signed-jwt " } },
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
      data: { session: { token: "" } },
      error: null,
    },
  ])("raises a safe error when Neon does not issue a token", (response) => {
    let thrownError: unknown;

    try {
      requireNeonAccessToken(response);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(IncompleteSessionError);
    expect(thrownError).toMatchObject({
      message:
        "We signed you in, but could not complete your session. Refresh the page or try signing in again.",
    });
    expect(String(thrownError)).not.toMatch(/Neon|access token/i);
    expect(String(thrownError)).not.toContain(
      "provider detail must stay private",
    );
  });
});

describe("requestFreshNeonAccessToken", () => {
  it("bypasses Neon's cache while refreshing the post-login session", async () => {
    const requestSession = vi.fn(async () => ({
      data: { session: { token: "signed-jwt" } },
      error: null,
    }));

    await expect(requestFreshNeonAccessToken(requestSession)).resolves.toBe(
      "signed-jwt",
    );
    expect(requestSession).toHaveBeenCalledOnce();
    expect(requestSession).toHaveBeenCalledWith({
      fetchOptions: {
        headers: {
          "X-Force-Fetch": "true",
        },
      },
    });
  });
});

describe("createNeonSessionCompletionTokenProvider", () => {
  it("returns to the cached session path after the first fresh token", async () => {
    const getFreshToken = vi.fn(async () => "fresh-jwt");
    const getCachedToken = vi.fn(async () => "cached-jwt");
    const getToken = createNeonSessionCompletionTokenProvider(
      getFreshToken,
      getCachedToken,
    );

    await expect(getToken()).resolves.toBe("fresh-jwt");
    await expect(getToken()).resolves.toBe("cached-jwt");
    await expect(getToken()).resolves.toBe("cached-jwt");
    expect(getFreshToken).toHaveBeenCalledOnce();
    expect(getCachedToken).toHaveBeenCalledTimes(2);
  });

  it("retries the fresh session path until Neon issues a token", async () => {
    const getFreshToken = vi
      .fn<AccessTokenProvider>()
      .mockRejectedValueOnce(new IncompleteSessionError())
      .mockResolvedValueOnce("fresh-jwt");
    const getCachedToken = vi.fn(async () => "cached-jwt");
    const getToken = createNeonSessionCompletionTokenProvider(
      getFreshToken,
      getCachedToken,
    );

    await expect(getToken()).rejects.toBeInstanceOf(IncompleteSessionError);
    await expect(getToken()).resolves.toBe("fresh-jwt");
    await expect(getToken()).resolves.toBe("cached-jwt");
    expect(getFreshToken).toHaveBeenCalledTimes(2);
    expect(getCachedToken).toHaveBeenCalledOnce();
  });

  it("shares one forced request between concurrent completion checks", async () => {
    let resolveFreshToken: (token: string) => void = () => undefined;
    const freshToken = new Promise<string>((resolve) => {
      resolveFreshToken = resolve;
    });
    const getFreshToken = vi.fn(() => freshToken);
    const getCachedToken = vi.fn(async () => "cached-jwt");
    const getToken = createNeonSessionCompletionTokenProvider(
      getFreshToken,
      getCachedToken,
    );

    const firstRequest = getToken();
    const concurrentRequest = getToken();

    expect(getFreshToken).toHaveBeenCalledOnce();
    resolveFreshToken("fresh-jwt");
    await expect(
      Promise.all([firstRequest, concurrentRequest]),
    ).resolves.toEqual(["fresh-jwt", "fresh-jwt"]);
    await expect(getToken()).resolves.toBe("cached-jwt");
    expect(getCachedToken).toHaveBeenCalledOnce();
  });
});

type AccessTokenProvider = () => Promise<string | null>;
