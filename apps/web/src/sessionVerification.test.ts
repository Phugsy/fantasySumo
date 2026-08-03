import { describe, expect, it, vi } from "vitest";
import { IncompleteSessionError } from "./authClient";
import { waitForVerifiedSession } from "./sessionVerification";
import type { SessionResponse } from "./types";

describe("waitForVerifiedSession", () => {
  it("retries while the post-login session token becomes available", async () => {
    const authenticatedSession: SessionResponse = {
      mode: "neon",
      user: {
        id: "neon-user",
        email: "player@example.com",
      },
    };
    const fetchSession = vi
      .fn<() => Promise<SessionResponse>>()
      .mockRejectedValueOnce(new IncompleteSessionError())
      .mockResolvedValueOnce(authenticatedSession);
    const waitForRetry = vi.fn(async () => undefined);

    await expect(
      waitForVerifiedSession(fetchSession, waitForRetry),
    ).resolves.toEqual(authenticatedSession);
    expect(fetchSession).toHaveBeenCalledTimes(2);
    expect(waitForRetry).toHaveBeenCalledOnce();
    expect(waitForRetry).toHaveBeenCalledWith(250);
  });
});
