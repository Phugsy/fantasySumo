import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiRequestError,
  createFantasyTeam,
  fetchCurrentBasho,
  fetchSchedule,
  getCurrentBashoUrl,
  reportAuthClientTokenUnavailable,
  setAuthTokenProvider,
  updateFantasyTeam,
} from "./api";

afterEach(() => {
  setAuthTokenProvider(null);
  vi.unstubAllGlobals();
});

describe("api auth headers", () => {
  it("sends the configured bearer token when saving a fantasy team", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            picks: [],
            team: {
              id: "team-east",
              displayName: "East Stand",
            },
          }),
          {
            headers: { "content-type": "application/json" },
            status: 201,
          },
        ),
      ),
    );

    vi.stubGlobal("fetch", fetchMock);
    setAuthTokenProvider(async () => "verified-token");

    await createFantasyTeam("2026-05", {
      displayName: "East Stand",
      rikishiIds: ["onosato", "kotozakura"],
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/basho/2026-05/teams", {
      body: JSON.stringify({
        displayName: "East Stand",
        rikishiIds: ["onosato", "kotozakura"],
      }),
      credentials: "same-origin",
      headers: {
        Authorization: "Bearer verified-token",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  });

  it("uses the current-user endpoint when updating a fantasy team", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            picks: [],
            team: {
              id: "team-east",
              displayName: "East Stand Updated",
            },
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          },
        ),
      ),
    );

    vi.stubGlobal("fetch", fetchMock);
    setAuthTokenProvider(async () => "verified-token");

    await updateFantasyTeam("2026-05", {
      displayName: "East Stand Updated",
      rikishiIds: ["hoshoryu", "kirishima"],
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/basho/2026-05/my-team", {
      body: JSON.stringify({
        displayName: "East Stand Updated",
        rikishiIds: ["hoshoryu", "kirishima"],
      }),
      credentials: "same-origin",
      headers: {
        Authorization: "Bearer verified-token",
        "Content-Type": "application/json",
      },
      method: "PUT",
    });
  });

  it("preserves lock details from a rejected team update", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: "picks-locked",
              message: "This basho has started, so picks are locked.",
              bashoStatus: "active",
              teamLockedAt: "2026-05-08T02:00:00.000Z",
            }),
            {
              headers: { "content-type": "application/json" },
              status: 409,
            },
          ),
        ),
      ),
    );

    const error = await updateFantasyTeam("2026-05", {
      displayName: "Too Late",
      rikishiIds: ["onosato", "kotozakura"],
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      status: 409,
      code: "picks-locked",
      bashoStatus: "active",
      teamLockedAt: "2026-05-08T02:00:00.000Z",
      message: "This basho has started, so picks are locked.",
    });
  });

  it("does not consult the auth provider for public basho reads", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ id: "2026-09" }), {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
      ),
    );
    const tokenProvider = vi.fn(() =>
      Promise.reject(new Error("Token refresh failed")),
    );

    vi.stubGlobal("fetch", fetchMock);
    setAuthTokenProvider(tokenProvider);

    await expect(fetchCurrentBasho()).resolves.toMatchObject({ id: "2026-09" });
    expect(tokenProvider).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("/api/basho/current", {
      credentials: "same-origin",
      headers: {},
    });
  });

  it("loads published schedules through the public basho boundary", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ bashoId: "2026-05", publishedDays: [], bouts: [] }),
          { headers: { "content-type": "application/json" }, status: 200 },
        ),
      ),
    );
    const tokenProvider = vi.fn(() => Promise.resolve("verified-token"));

    vi.stubGlobal("fetch", fetchMock);
    setAuthTokenProvider(tokenProvider);

    await expect(fetchSchedule("2026-05")).resolves.toMatchObject({
      publishedDays: [],
    });
    expect(tokenProvider).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("/api/basho/2026-05/schedule", {
      credentials: "same-origin",
      headers: {},
    });
  });

  it("reports a safe client auth diagnostic without requesting a token", async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    const tokenProvider = vi.fn(() =>
      Promise.reject(new Error("provider detail must stay private")),
    );

    vi.stubGlobal("fetch", fetchMock);
    setAuthTokenProvider(tokenProvider);

    expect(reportAuthClientTokenUnavailable()).toBeUndefined();
    expect(tokenProvider).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("/api/session", {
      credentials: "same-origin",
      headers: {
        "X-Fantasy-Sumo-Auth-Diagnostic": "access-token-unavailable",
      },
    });
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(
      "provider detail must stay private",
    );
  });
});

describe("getCurrentBashoUrl", () => {
  it("uses the normal current-basho route by default", () => {
    expect(getCurrentBashoUrl(undefined)).toBe("/api/basho/current");
  });

  it("selects the demo basho only in explicit demo mode", () => {
    expect(getCurrentBashoUrl("demo")).toBe("/api/basho/current?mode=demo");
  });
});
