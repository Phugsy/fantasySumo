import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HistoryPanel } from "./HistoryPanel";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HistoryPanel", () => {
  it("shows the public archive and cumulative standings", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/bashos") {
        return jsonResponse({
          bashos: [
            {
              id: "2026-07",
              isDemo: false,
              name: "July 2026 Basho",
              startDate: "2026-07-12",
              endDate: "2026-07-26",
              status: "complete",
            },
          ],
        });
      }

      if (url === "/api/leaderboard/all-time") {
        return jsonResponse({
          bashoCount: 2,
          leaderboard: [
            {
              rank: 1,
              displayName: "North Star",
              score: 19,
              tournamentsPlayed: 2,
              bashos: [],
            },
          ],
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HistoryPanel signedIn={false} />);

    expect(
      await screen.findByRole("heading", { name: "All-time standings" }),
    ).toBeInTheDocument();
    expect(screen.getByText("North Star")).toBeInTheDocument();
    expect(screen.getByText("July 2026 Basho")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/my-history",
      expect.anything(),
    );
    expect(
      screen.queryByRole("heading", { name: "My tournament history" }),
    ).toBeNull();
  });

  it("shows preserved rikishi records for a signed-in player", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/bashos") return jsonResponse({ bashos: [] });
        if (url === "/api/leaderboard/all-time") {
          return jsonResponse({ bashoCount: 0, leaderboard: [] });
        }
        if (url === "/api/my-history") {
          return jsonResponse({
            score: 11,
            history: [
              {
                basho: {
                  id: "2026-07",
                  isDemo: false,
                  name: "July 2026 Basho",
                  startDate: "2026-07-12",
                  endDate: "2026-07-26",
                  status: "complete",
                },
                team: { id: "team-1", displayName: "North Star" },
                score: 11,
                picks: [
                  {
                    rikishiId: "kirishima",
                    shikona: "Kirishima",
                    heya: "Oitekaze",
                    rank: "Maegashira",
                    wins: 8,
                    score: 8,
                  },
                ],
              },
            ],
          });
        }

        throw new Error(`Unexpected request: ${url}`);
      }),
    );

    render(<HistoryPanel signedIn />);

    expect(
      await screen.findByRole("heading", { name: "My tournament history" }),
    ).toBeInTheDocument();
    expect(screen.getByText("11 all-time pts")).toBeInTheDocument();
    fireEvent.click(screen.getByText("North Star"));
    expect(screen.getByText("Kirishima")).toBeInTheDocument();
    expect(screen.getByText("8 wins · 8 pts")).toBeInTheDocument();
  });
});

function jsonResponse(body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
      status: 200,
    }),
  );
}
