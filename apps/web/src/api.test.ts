import { afterEach, describe, expect, it, vi } from "vitest";
import { createFantasyTeam, setAuthTokenProvider } from "./api";

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
            headers: {
              "content-type": "application/json",
            },
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
});
