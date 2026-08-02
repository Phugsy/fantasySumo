import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFantasyTeam,
  fetchCurrentBasho,
  getCurrentBashoUrl,
  setAuthTokenProvider,
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
});

describe("getCurrentBashoUrl", () => {
  it("uses the normal current-basho route by default", () => {
    expect(getCurrentBashoUrl(undefined)).toBe("/api/basho/current");
  });

  it("selects the demo basho only in explicit demo mode", () => {
    expect(getCurrentBashoUrl("demo")).toBe("/api/basho/current?mode=demo");
  });
});
