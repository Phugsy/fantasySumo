import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import * as authClient from "./authClient";
import type { LeaderboardEntry } from "./types";

const currentBasho = {
  id: "2026-05",
  isDemo: false,
  name: "May 2026 Sample Basho",
  startDate: "2026-05-10",
  endDate: "2026-05-24",
  status: "upcoming",
  currentDay: 0,
  teamSize: 2,
};

const rankedRikishi = [
  {
    id: "onosato",
    shikona: "Onosato",
    heya: "Nishonoseki",
    rank: "Ozeki",
    rankOrder: 1,
  },
  {
    id: "kotozakura",
    shikona: "Kotozakura",
    heya: "Sadogatake",
    rank: "Ozeki",
    rankOrder: 2,
  },
  {
    id: "hoshoryu",
    shikona: "Hoshoryu",
    heya: "Tatsunami",
    rank: "Sekiwake",
    rankOrder: 3,
  },
];

const leaderboard: LeaderboardEntry[] = [
  {
    rank: 1,
    teamId: "team-east",
    displayName: "East Side",
    score: 2,
    latestDayScore: {
      day: 2,
      score: 1,
    },
    scoreHistory: [
      {
        day: 1,
        dailyScore: 1,
        cumulativeScore: 1,
        rikishiScores: [
          { rikishiId: "onosato", outcome: "win", score: 1 },
          { rikishiId: "kirishima", outcome: "loss", score: 0 },
        ],
      },
      {
        day: 2,
        dailyScore: 1,
        cumulativeScore: 2,
        rikishiScores: [
          { rikishiId: "onosato", outcome: "no-result", score: 0 },
          { rikishiId: "kirishima", outcome: "win", score: 1 },
        ],
      },
    ],
    rikishiScores: [
      {
        rikishiId: "onosato",
        wins: 1,
        score: 1,
      },
      {
        rikishiId: "kirishima",
        wins: 1,
        score: 1,
      },
    ],
  },
  {
    rank: 2,
    teamId: "team-west",
    displayName: "West Side",
    score: 1,
    latestDayScore: {
      day: 2,
      score: 0,
    },
    scoreHistory: [
      {
        day: 1,
        dailyScore: 1,
        cumulativeScore: 1,
        rikishiScores: [
          { rikishiId: "kotozakura", outcome: "win", score: 1 },
          { rikishiId: "hoshoryu", outcome: "loss", score: 0 },
        ],
      },
      {
        day: 2,
        dailyScore: 0,
        cumulativeScore: 1,
        rikishiScores: [
          { rikishiId: "kotozakura", outcome: "no-result", score: 0 },
          { rikishiId: "hoshoryu", outcome: "loss", score: 0 },
        ],
      },
    ],
    rikishiScores: [
      {
        rikishiId: "kotozakura",
        wins: 1,
        score: 1,
      },
      {
        rikishiId: "hoshoryu",
        wins: 0,
        score: 0,
      },
    ],
  },
  {
    rank: 3,
    teamId: "team-tie",
    displayName: "Tie Side",
    score: 1,
    scoreHistory: [],
    rikishiScores: [],
  },
];

beforeEach(() => {
  window.history.replaceState({}, "", "/stable");
  vi.stubGlobal("fetch", vi.fn(mockSuccessfulFetch));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("loads the current basho and rikishi", async () => {
    render(<App />);

    expect(screen.getByText("Checking your session...")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "May 2026 Sample Basho" }),
    ).toBeInTheDocument();
    await openTeamEditor();
    expect(screen.getByRole("button", { name: /Onosato/ })).toBeInTheDocument();
    expect(screen.getByText("0 of 2 selected")).toBeInTheDocument();
  });

  it("lets an anonymous local user sign in before saving a team", async () => {
    vi.stubGlobal("fetch", vi.fn(mockAnonymousFetch));
    render(<App />);

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
    expect(window.location.search).toBe("?returnTo=%2Fstable");
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "player@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "New Player" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("heading", {
        name: "No team for this basho yet",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/stable");
    expect(document.title).toBe("My stable | Fantasy Sumo");
    await waitFor(() => {
      const pageTitle = screen.getByRole("heading", { name: "My stable" });

      expect(pageTitle).toHaveFocus();
      expect(pageTitle).toHaveAttribute("data-focus-visible", "false");
    });
  });

  it("marks route-heading focus as visible after keyboard navigation", async () => {
    render(<App />);

    const leaderboardLink = await screen.findByRole("link", {
      name: "Leaderboard",
    });
    leaderboardLink.focus();
    fireEvent.keyDown(leaderboardLink, { key: "Enter" });
    fireEvent.click(leaderboardLink);

    await waitFor(() => {
      const pageTitle = screen.getByRole("heading", {
        name: "Follow the leaderboard",
      });

      expect(pageTitle).toHaveFocus();
      expect(pageTitle).toHaveAttribute("data-focus-visible", "true");
    });
  });

  it("keeps account submission single-flight across rapid form submits", async () => {
    const sessionRequest = createDeferred<Response>();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/session" && init?.method === "POST") {
        return sessionRequest.promise;
      }

      return mockAnonymousFetch(input, init);
    });

    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "player@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "New Player" },
    });
    const signInButton = screen.getByRole("button", { name: "Sign in" });
    const accountForm = signInButton.closest("form");

    expect(accountForm).not.toBeNull();
    fireEvent.submit(accountForm!);
    fireEvent.submit(accountForm!);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(
          ([input, init]) =>
            String(input) === "/api/session" && init?.method === "POST",
        ),
      ).toHaveLength(1);
    });

    await act(async () => {
      sessionRequest.resolve(
        await jsonResponse(
          {
            mode: "local",
            user: {
              id: "local-user",
              email: "player@example.com",
              displayName: "New Player",
            },
          },
          { status: 201 },
        ),
      );
    });

    expect(await screen.findByText("New Player")).toBeInTheDocument();
  });

  it("does not expose the team form until private picks finish loading", async () => {
    const myTeamRequest = createDeferred<Response>();

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/basho/2026-05/my-team") {
          return myTeamRequest.promise;
        }

        return mockAnonymousFetch(input, init);
      }),
    );
    render(<App />);

    await signInThroughAccountPanel();

    expect(
      await screen.findByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Team name")).not.toBeInTheDocument();

    await act(async () => {
      myTeamRequest.resolve(
        await jsonResponse(
          { message: "You do not have a fantasy team for this basho yet." },
          { status: 404 },
        ),
      );
    });

    expect(
      await screen.findByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No team for this basho yet" }),
    ).toBeInTheDocument();
    await openTeamEditor();
    expect(screen.getByLabelText("Team name")).toHaveValue("");
  });

  it("does not treat a private-team server error as an empty team", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/session" && init?.method === "DELETE") {
          return Promise.resolve(new Response(null, { status: 204 }));
        }

        if (String(input) === "/api/basho/2026-05/my-team") {
          return jsonResponse(
            { message: "Unable to load your fantasy team." },
            { status: 503 },
          );
        }

        return mockAnonymousFetch(input, init);
      }),
    );
    render(<App />);

    await signInThroughAccountPanel();

    expect(
      await screen.findByText("Unable to load your fantasy team."),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "My stable" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Team name")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(
      await screen.findByRole("heading", { name: "Follow the leaderboard" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("link", { name: "Log in / Join" })[0]!);
    expect(await screen.findByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Display name")).toHaveValue("");
  });

  it("keeps public standings available when private-team loading fails", async () => {
    window.history.replaceState({}, "", "/");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/basho/2026-05/my-team") {
          return jsonResponse(
            { message: "Unable to load your fantasy team." },
            { status: 503 },
          );
        }

        return mockSuccessfulFetch(input, init ?? currentBasho);
      }),
    );
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Leaderboard" }),
    ).toBeInTheDocument();
    expect(await screen.findAllByText("East Side")).not.toHaveLength(0);
    expect(
      screen.queryByText("Unable to load your fantasy team."),
    ).not.toBeInTheDocument();
  });

  it("stays on the private page and reports a failed sign-out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/session" && init?.method === "DELETE") {
          return jsonResponse(
            { message: "Unable to sign out right now." },
            { status: 503 },
          );
        }

        return mockSuccessfulFetch(input, init ?? currentBasho);
      }),
    );
    render(<App />);

    await screen.findByRole("heading", { name: "No team for this basho yet" });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(
      await screen.findByText("Unable to sign out right now."),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/stable");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
  });

  it("shows public basho data when the session probe is unauthorized", async () => {
    window.history.replaceState({}, "", "/");
    const fetchMock = vi.fn(mockUnauthorizedSessionFetch);
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "May 2026 Sample Basho" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Leaderboard" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Log in / Join" }),
    ).not.toHaveLength(0);
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/my-team"),
      ),
    ).toBe(false);
  });

  it("hides the public join prompt when picks are closed", async () => {
    window.history.replaceState({}, "", "/");
    const activeBasho = {
      ...currentBasho,
      status: "active" as const,
      currentDay: 1,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        if (String(input) === "/api/session") {
          return jsonResponse({ mode: "local", user: null });
        }

        return mockSuccessfulFetch(input, activeBasho);
      }),
    );
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Leaderboard" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Build your own stable" }),
    ).not.toBeInTheDocument();
  });

  it("marks the signed-in player's team on the public leaderboard", async () => {
    window.history.replaceState({}, "", "/");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url === "/api/basho/2026-05/my-team") {
          return jsonResponse(createExistingMyTeamResponse());
        }

        if (url === "/api/basho/2026-05/leaderboard") {
          return jsonResponse(
            createLeaderboardResponse({
              entries: [
                {
                  rank: 1,
                  teamId: "team-existing",
                  displayName: "Existing Champions",
                  score: 0,
                  scoreHistory: [],
                  rikishiScores: [],
                },
              ],
            }),
          );
        }

        return mockSuccessfulFetch(input, init ?? currentBasho);
      }),
    );
    render(<App />);

    expect(await screen.findAllByText("Your team")).not.toHaveLength(0);
  });

  it("keeps the account panel available when initial basho loading is unauthorized", async () => {
    vi.stubGlobal("fetch", vi.fn(mockUnauthorizedBashoFetch));
    render(<App />);

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByText("Use at least 8 characters and avoid common passwords."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Sign in before loading data."),
    ).toBeInTheDocument();
  });

  it("carries the login email and safe return path into password recovery", async () => {
    window.history.replaceState({}, "", "/login?returnTo=%2Fteam");
    vi.stubGlobal("fetch", vi.fn(mockUnauthorizedBashoFetch));
    render(<App />);

    const email = await screen.findByLabelText("Email");
    fireEvent.change(email, { target: { value: "player@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect(window.location.pathname).toBe("/reset-password");
    expect(window.location.search).toBe("?returnTo=%2Fteam");
    expect(
      await screen.findByRole("heading", { name: "Request a reset link" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("player@example.com");
    expect(screen.getByRole("link", { name: "Back to login" })).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fteam",
    );
  });

  it("renders provider token and invalid-link password reset states", async () => {
    window.history.replaceState(
      {},
      "",
      "/reset-password?token=valid-token&returnTo=%2Fstable",
    );
    vi.stubGlobal("fetch", vi.fn(mockUnauthorizedBashoFetch));
    const { unmount } = render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Complete password reset" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();

    unmount();
    window.history.replaceState(
      {},
      "",
      "/reset-password?error=INVALID_TOKEN&returnTo=%2Fstable",
    );
    render(<App />);

    expect(
      await screen.findByText(
        "This password reset link is invalid, expired, or has already been used. Request a new link to continue.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("removes a reset token before initial API requests without losing the reset form", async () => {
    window.history.replaceState(
      {},
      "",
      "/reset-password?token=secret-token&returnTo=%2Fstable",
    );
    const requestLocations: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        requestLocations.push(window.location.href);
        return mockUnauthorizedBashoFetch(input);
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Complete password reset" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(requestLocations.length).toBeGreaterThan(0));
    expect(requestLocations).not.toContainEqual(
      expect.stringContaining("secret-token"),
    );
    expect(window.location.pathname).toBe("/reset-password");
    expect(window.location.search).toBe("?returnTo=%2Fstable");
  });

  it("clears an existing account session after completing a password reset", async () => {
    window.history.replaceState(
      {},
      "",
      "/reset-password?token=valid-token&returnTo=%2Fstable",
    );
    const myTeamRequest = createDeferred<Response>();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/basho/2026-05/my-team") {
        return myTeamRequest.promise;
      }

      if (url === "/api/basho/2026-05/leaderboard") {
        return jsonResponse(
          createLeaderboardResponse({
            entries: [
              {
                rank: 1,
                teamId: "team-existing",
                displayName: "Existing Champions",
                score: 0,
                scoreHistory: [],
                rikishiScores: [],
              },
            ],
          }),
        );
      }

      return mockExistingNeonSessionFetch(input);
    });
    vi.stubGlobal("fetch", fetchMock);
    const resetPassword = vi
      .spyOn(authClient, "resetPasswordWithNeon")
      .mockResolvedValue();
    const signOut = vi.spyOn(authClient, "signOutNeon").mockResolvedValue();

    render(<App />);

    fireEvent.change(await screen.findByLabelText("New password"), {
      target: { value: "new-strong-password" },
    });
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input]) => String(input) === "/api/basho/2026-05/my-team",
        ),
      ).toBe(true),
    );
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "new-strong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    const continueToSignIn = await screen.findByRole("link", {
      name: "Continue to sign in",
    });
    expect(resetPassword).toHaveBeenCalledWith({
      newPassword: "new-strong-password",
      token: "valid-token",
    });
    expect(signOut).toHaveBeenCalledOnce();
    expect(signOut.mock.invocationCallOrder[0]!).toBeLessThan(
      resetPassword.mock.invocationCallOrder[0]!,
    );

    fireEvent.click(continueToSignIn);

    expect(window.location.pathname).toBe("/login");
    expect(
      await screen.findByRole("heading", { name: "Log in or join" }),
    ).toBeInTheDocument();
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Leaderboard" }));
    expect(await screen.findByText("Existing Champions")).toBeInTheDocument();

    await act(async () => {
      myTeamRequest.resolve(createJsonResponse(createExistingMyTeamResponse()));
      await flushPromises();
    });

    expect(screen.queryByText("Your team")).not.toBeInTheDocument();
  });

  it("does not consume the reset token when the previous session cannot sign out", async () => {
    window.history.replaceState(
      {},
      "",
      "/reset-password?token=valid-token&returnTo=%2Fstable",
    );
    vi.stubGlobal("fetch", vi.fn(mockExistingNeonSessionFetch));
    const resetPassword = vi
      .spyOn(authClient, "resetPasswordWithNeon")
      .mockResolvedValue();
    vi.spyOn(authClient, "signOutNeon").mockRejectedValue(
      new Error("private provider detail"),
    );

    render(<App />);

    fireEvent.change(await screen.findByLabelText("New password"), {
      target: { value: "new-strong-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "new-strong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not securely end the current session. Check your connection and try again.",
    );
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Continue to sign in" }),
    ).not.toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("clears a previously entered password after recovery completes", async () => {
    window.history.replaceState({}, "", "/login?returnTo=%2Fstable");
    vi.stubGlobal("fetch", vi.fn(mockUnauthorizedBashoFetch));
    vi.spyOn(authClient, "resetPasswordWithNeon").mockResolvedValue();
    vi.spyOn(authClient, "signOutNeon").mockResolvedValue();

    render(<App />);

    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "player@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "old-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect(
      await screen.findByRole("heading", { name: "Request a reset link" }),
    ).toBeInTheDocument();

    act(() => {
      window.history.pushState(
        {},
        "",
        "/reset-password?token=valid-token&returnTo=%2Fstable",
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    fireEvent.change(await screen.findByLabelText("New password"), {
      target: { value: "new-strong-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "new-strong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    fireEvent.click(
      await screen.findByRole("link", { name: "Continue to sign in" }),
    );

    expect(await screen.findByLabelText("Password")).toHaveValue("");
  });

  it("explains raw public API 401 responses as deployment access issues", async () => {
    window.history.replaceState({}, "", "/");
    vi.stubGlobal("fetch", vi.fn(mockRawUnauthorizedBashoFetch));
    render(<App />);

    expect(
      await screen.findByText(
        "Public basho data is unavailable because this deployment is returning HTTP 401 for anonymous API requests.",
      ),
    ).toBeInTheDocument();
  });

  it("reloads basho data after sign in if startup was unauthorized", async () => {
    vi.stubGlobal("fetch", vi.fn(mockBashoUnauthorizedUntilLoginFetch()));
    render(<App />);

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(
      screen.getByText("Sign in before loading data."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "player@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "New Player" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("heading", { name: "May 2026 Sample Basho" }),
    ).toBeInTheDocument();
    await openTeamEditor();
    expect(screen.getByRole("button", { name: /Onosato/ })).toBeInTheDocument();
  });

  it("shows My Stable after sign in when the user already has picks", async () => {
    vi.stubGlobal("fetch", vi.fn(mockExistingTeamAfterLoginFetch));
    render(<App />);

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "player@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "New Player" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("heading", { name: "Existing Champions" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("0 total points")).toBeInTheDocument();
    expect(screen.getByText("Onosato")).toBeInTheDocument();
  });

  it("edits the current user's stable and shows the saved picks immediately", async () => {
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        if (
          String(input) === "/api/basho/2026-05/my-team" &&
          init?.method === "PUT"
        ) {
          return jsonResponse({
            team: {
              id: "team-existing",
              displayName: "Updated Champions",
            },
            picks: [{ rikishiId: "kotozakura" }, { rikishiId: "hoshoryu" }],
          });
        }

        return mockExistingTeamAfterLoginFetch(input, init);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await signInThroughAccountPanel();
    await screen.findByRole("heading", { name: "Existing Champions" });
    fireEvent.click(screen.getByRole("button", { name: "Edit picks" }));

    expect(await screen.findByLabelText("Team name")).toHaveValue(
      "Existing Champions",
    );
    expect(
      screen.getByRole("heading", { name: "Edit stable" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Team name"), {
      target: { value: "Updated Champions" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove Onosato" }));
    fireEvent.click(screen.getByRole("button", { name: /Hoshoryu/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/basho/2026-05/my-team", {
        body: JSON.stringify({
          displayName: "Updated Champions",
          rikishiIds: ["kotozakura", "hoshoryu"],
        }),
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        method: "PUT",
      }),
    );
    await waitFor(() => {
      expect(window.location.pathname).toBe("/stable");
      expect(
        screen.getByText("Changes saved for Updated Champions."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Updated Champions" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Hoshoryu")).toBeInTheDocument();
    expect(screen.queryByText("Onosato")).not.toBeInTheDocument();
  });

  it("shows a saved stable as read-only when the post-save leaderboard reports a lock", async () => {
    let teamUpdated = false;

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (
          String(input) === "/api/basho/2026-05/my-team" &&
          init?.method === "PUT"
        ) {
          teamUpdated = true;

          return jsonResponse({
            team: {
              id: "team-existing",
              displayName: "Updated Champions",
            },
            picks: [{ rikishiId: "onosato" }, { rikishiId: "kotozakura" }],
          });
        }

        if (String(input) === "/api/basho/2026-05/leaderboard" && teamUpdated) {
          return jsonResponse(
            createLeaderboardResponse({
              basho: {
                ...currentBasho,
                status: "active",
              },
            }),
          );
        }

        return mockExistingTeamAfterLoginFetch(input, init);
      }),
    );
    render(<App />);

    await signInThroughAccountPanel();
    await screen.findByRole("heading", { name: "Existing Champions" });
    fireEvent.click(screen.getByRole("button", { name: "Edit picks" }));
    fireEvent.change(await screen.findByLabelText("Team name"), {
      target: { value: "Updated Champions" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText(
        "This basho has started, so picks are locked. Your line-up is read-only.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Updated Champions" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit picks" }),
    ).not.toBeInTheDocument();
  });

  it("switches an open editor to read-only when the basho locks before save", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (
          String(input) === "/api/basho/2026-05/my-team" &&
          init?.method === "PUT"
        ) {
          return jsonResponse(
            {
              error: "picks-locked",
              message: "Fantasy team picks are locked for this basho.",
              bashoStatus: "upcoming",
              teamLockedAt: "2026-05-08T02:00:00.000Z",
            },
            { status: 409 },
          );
        }

        return mockExistingTeamAfterLoginFetch(input, init);
      }),
    );
    render(<App />);

    await signInThroughAccountPanel();
    await screen.findByRole("heading", { name: "Existing Champions" });
    fireEvent.click(screen.getByRole("button", { name: "Edit picks" }));
    fireEvent.change(await screen.findByLabelText("Team name"), {
      target: { value: "Too Late Stable" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove Onosato" }));
    fireEvent.click(screen.getByRole("button", { name: /Hoshoryu/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText(
        "Picks are locked for this basho. Your line-up is read-only.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Existing Champions" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Onosato")).toBeInTheDocument();
    expect(screen.queryByText("Hoshoryu")).not.toBeInTheDocument();
    expect(screen.queryByText("Too Late Stable")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit picks" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
  });

  it("cancels stable edits and restores the saved picks", async () => {
    vi.stubGlobal("fetch", vi.fn(mockExistingTeamAfterLoginFetch));
    render(<App />);

    await signInThroughAccountPanel();
    await screen.findByRole("heading", { name: "Existing Champions" });
    fireEvent.click(screen.getByRole("button", { name: "Edit picks" }));
    fireEvent.change(await screen.findByLabelText("Team name"), {
      target: { value: "Unsaved Name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove Onosato" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      await screen.findByRole("heading", { name: "Existing Champions" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit picks" }));

    expect(await screen.findByLabelText("Team name")).toHaveValue(
      "Existing Champions",
    );
    expect(screen.getByText("2 of 2 selected")).toBeInTheDocument();
  });

  it("keeps My Stable lifecycle aligned with its private score snapshot", async () => {
    const ownerSnapshotBasho = {
      ...currentBasho,
      status: "active" as const,
      currentDay: 1,
    };
    const newerLeaderboardBasho = {
      ...ownerSnapshotBasho,
      currentDay: 2,
    };

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url === "/api/basho/2026-05/my-team") {
          return jsonResponse({
            ...createExistingMyTeamResponse(),
            basho: ownerSnapshotBasho,
            totalScore: 1,
          });
        }

        if (url === "/api/basho/2026-05/leaderboard") {
          return jsonResponse(
            createLeaderboardResponse({
              basho: newerLeaderboardBasho,
              entries: leaderboard,
            }),
          );
        }

        return mockExistingTeamAfterLoginFetch(input, init);
      }),
    );
    render(<App />);

    await signInThroughAccountPanel();

    expect(
      await screen.findByText(
        "May 2026 Sample Basho · Scoring in progress · Day 1",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("1 total points")).toBeInTheDocument();
    expect(
      screen.queryByText("May 2026 Sample Basho · Scoring in progress · Day 2"),
    ).not.toBeInTheDocument();
  });

  it("drops saved picks that are no longer on the current banzuke", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/basho/2026-05/my-team") {
          return jsonResponse({
            basho: currentBasho,
            team: {
              id: "team-existing",
              displayName: "Existing Champions",
            },
            totalScore: 0,
            picks: [
              {
                rikishiId: "onosato",
                shikona: "Onosato",
                wins: 0,
                score: 0,
              },
              {
                rikishiId: "removed-rikishi",
                shikona: "Removed Rikishi",
                wins: 0,
                score: 0,
              },
            ],
          });
        }

        return mockExistingTeamAfterLoginFetch(input, init);
      }),
    );
    render(<App />);

    await signInThroughAccountPanel();
    await screen.findByRole("heading", { name: "Existing Champions" });
    fireEvent.click(screen.getByRole("button", { name: "Edit picks" }));

    expect(
      await screen.findByRole("heading", { name: "Edit stable" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 of 2 selected")).toBeInTheDocument();
    expect(screen.getByText("Pick slot")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hoshoryu/ })).toBeEnabled();
  });

  it("ignores a stale anonymous load that finishes after authenticated picks", async () => {
    const initialCurrentBashoRequest = createDeferred<Response>();
    let currentBashoRequestCount = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/basho/current") {
          currentBashoRequestCount += 1;

          return currentBashoRequestCount === 1
            ? initialCurrentBashoRequest.promise
            : jsonResponse(currentBasho);
        }

        return mockExistingTeamAfterLoginFetch(input, init);
      }),
    );
    render(<App />);

    await signInThroughAccountPanel();

    expect(
      await screen.findByRole("heading", { name: "Existing Champions" }),
    ).toBeInTheDocument();

    await act(async () => {
      initialCurrentBashoRequest.resolve(await jsonResponse(currentBasho));
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Existing Champions" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Selection" }),
      ).not.toBeInTheDocument();
    });
  });

  it("clears the previous user's private picks when another user has no team", async () => {
    vi.stubGlobal("fetch", vi.fn(mockUserSwitchFetch()));
    render(<App />);

    await signInThroughAccountPanel();
    expect(
      await screen.findByRole("heading", { name: "Existing Champions" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findAllByRole("link", { name: "Log in / Join" });
    await signInThroughAccountPanel();

    expect(
      await screen.findByRole("heading", {
        name: "No team for this basho yet",
      }),
    ).toBeInTheDocument();
    await openTeamEditor();
    expect(screen.getByLabelText("Team name")).toHaveValue("");
    expect(screen.getByText("0 of 2 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Onosato/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("displays leaderboard standings and team score details", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("link", { name: "Leaderboard" }));

    expect(
      screen.getByRole("heading", { name: "Leaderboard" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("East Side").length).toBeGreaterThan(0);
    expect(screen.getByText("2 pts")).toBeInTheDocument();
    expect(screen.getAllByText("Tied on score")).toHaveLength(2);
    expect(screen.getByText("Onosato")).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        "Recent results for Onosato: day 1 Win, day 2 No result",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("1 win")).toHaveLength(2);
  });

  it("keeps team selection available when the initial leaderboard load fails", async () => {
    vi.stubGlobal("fetch", vi.fn(mockInitialLeaderboardErrorFetch));
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "May 2026 Sample Basho" }),
    ).toBeInTheDocument();
    await openTeamEditor();
    expect(screen.getByRole("button", { name: /Onosato/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Leaderboard" }));

    expect(
      screen.getByText("Leaderboard unavailable right now."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No teams have joined this basho yet. Picks are still open.",
      ),
    ).toBeInTheDocument();
  });

  it("shows leaderboard loading before the initial standings request settles", async () => {
    const leaderboardRequest = createDeferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi.fn(mockSlowInitialLeaderboardFetch(leaderboardRequest)),
    );
    render(<App />);

    await screen.findByRole("heading", { name: "May 2026 Sample Basho" });
    fireEvent.click(screen.getByRole("link", { name: "Leaderboard" }));

    expect(screen.getByText("Loading leaderboard...")).toBeInTheDocument();
    expect(
      screen.queryByText("No teams have joined this basho yet."),
    ).not.toBeInTheDocument();

    leaderboardRequest.resolve(
      createJsonResponse(createLeaderboardResponse({ entries: leaderboard })),
    );
  });

  it("keeps newer submitted standings when the initial leaderboard request resolves late", async () => {
    const initialLeaderboardRequest = createDeferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi.fn(mockStaleInitialLeaderboardFetch(initialLeaderboardRequest)),
    );
    render(<App />);

    await openTeamEditor();
    await screen.findByRole("button", { name: /Onosato/ });
    fireEvent.change(screen.getByLabelText("Team name"), {
      target: { value: "East Stand Heroes" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Onosato/ }));
    fireEvent.click(screen.getByRole("button", { name: /Kotozakura/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit team" }));

    await screen.findByRole("heading", { name: "East Stand Heroes" });
    fireEvent.click(screen.getByRole("link", { name: "Leaderboard" }));
    expect(await screen.findByText("4 pts")).toBeInTheDocument();

    initialLeaderboardRequest.resolve(
      createJsonResponse(createLeaderboardResponse({ entries: leaderboard })),
    );
    await initialLeaderboardRequest.promise;
    await flushPromises();

    expect(screen.getByText("4 pts")).toBeInTheDocument();
    expect(screen.queryByText("East Side")).not.toBeInTheDocument();
  });

  it("allows selecting and removing rikishi up to the team size", async () => {
    render(<App />);

    await openTeamEditor();
    await screen.findByRole("button", { name: /Onosato/ });
    fireEvent.click(screen.getByRole("button", { name: /Onosato/ }));
    fireEvent.click(screen.getByRole("button", { name: /Kotozakura/ }));

    expect(screen.getByText("2 of 2 selected")).toBeInTheDocument();
    expect(screen.getByText("Team full")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hoshoryu/ })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Remove Onosato" }));

    expect(screen.getByText("1 of 2 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hoshoryu/ })).not.toBeDisabled();
  });

  it("shows locked basho messaging and prevents team selection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) =>
        mockSuccessfulFetch(input, {
          ...currentBasho,
          status: "active",
          currentDay: 5,
        }),
      ),
    );
    render(<App />);

    expect(
      await screen.findByText(
        "This basho has started, so new stables can no longer enter.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Scoring in progress")).toBeInTheDocument();
    expect(screen.getByText(/Day 5/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create your stable" }),
    ).not.toBeInTheDocument();
  });

  it("submits a selected team and shows confirmation", async () => {
    const fetchMock = vi.fn(mockSuccessfulFetch);
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await openTeamEditor();
    await screen.findByRole("button", { name: /Onosato/ });
    fireEvent.change(screen.getByLabelText("Team name"), {
      target: { value: "East Stand Heroes" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Onosato/ }));
    fireEvent.click(screen.getByRole("button", { name: /Kotozakura/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit team" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/basho/2026-05/teams", {
        body: JSON.stringify({
          displayName: "East Stand Heroes",
          rikishiIds: ["onosato", "kotozakura"],
        }),
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );
    expect(
      await screen.findByText("East Stand Heroes submitted."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "East Stand Heroes" }),
    ).toBeInTheDocument();
  });

  it("hydrates a stale missing team and keeps selection locked after a create race", async () => {
    let myTeamRequestCount = 0;
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);

        if (url === "/api/basho/2026-05/my-team") {
          myTeamRequestCount += 1;

          if (myTeamRequestCount === 1) {
            return jsonResponse(
              {
                message: "You do not have a fantasy team for this basho yet.",
              },
              { status: 404 },
            );
          }

          const existingTeam = createExistingMyTeamResponse();

          return jsonResponse({
            ...existingTeam,
            team: {
              ...existingTeam.team,
              lockedAt: "2026-05-08T02:00:00.000Z",
            },
          });
        }

        if (url === "/api/basho/2026-05/teams" && init?.method === "POST") {
          return jsonResponse(
            {
              error: "picks-locked",
              message: "Fantasy team picks are locked for this basho.",
              bashoStatus: "upcoming",
              teamLockedAt: "2026-05-08T02:00:00.000Z",
            },
            { status: 409 },
          );
        }

        return mockSuccessfulFetch(input, init ?? currentBasho);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await openTeamEditor();
    fireEvent.change(screen.getByLabelText("Team name"), {
      target: { value: "Stale Draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Onosato/ }));
    fireEvent.click(screen.getByRole("button", { name: /Kotozakura/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit team" }));

    expect(
      await screen.findByRole("heading", { name: "Existing Champions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Picks are locked for this basho. Your line-up is read-only.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create your stable" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit picks" }),
    ).not.toBeInTheDocument();
    expect(myTeamRequestCount).toBe(2);
  });

  it("keeps the saved stable available when standings fail to refresh", async () => {
    vi.stubGlobal("fetch", vi.fn(mockSubmitLeaderboardErrorFetch()));
    render(<App />);

    await openTeamEditor();
    await screen.findByRole("button", { name: /Onosato/ });
    fireEvent.change(screen.getByLabelText("Team name"), {
      target: { value: "East Stand Heroes" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Onosato/ }));
    fireEvent.click(screen.getByRole("button", { name: /Kotozakura/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit team" }));

    expect(
      await screen.findByText("East Stand Heroes submitted."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "East Stand Heroes" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Leaderboard" }));
    expect(
      screen.getByText("Unable to refresh leaderboard."),
    ).toBeInTheDocument();
  });

  it("displays API validation errors", async () => {
    vi.stubGlobal("fetch", vi.fn(mockValidationErrorFetch));
    render(<App />);

    await openTeamEditor();
    await screen.findByRole("button", { name: /Onosato/ });
    fireEvent.change(screen.getByLabelText("Team name"), {
      target: { value: "East Stand Heroes" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Onosato/ }));
    fireEvent.click(screen.getByRole("button", { name: /Kotozakura/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit team" }));

    expect(
      await screen.findByText(
        "Fantasy team picks are invalid. Expected 2 picks, received 1.",
      ),
    ).toBeInTheDocument();
  });

  it("refreshes a stale team-size limit while preserving the unsaved draft", async () => {
    let currentBashoRequestCount = 0;
    let teamSaveRequestCount = 0;
    const updatedBasho = { ...currentBasho, teamSize: 3 };

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/basho/current") {
          currentBashoRequestCount += 1;
          return jsonResponse(
            currentBashoRequestCount === 1 ? currentBasho : updatedBasho,
          );
        }

        if (url === "/api/basho/2026-05/teams") {
          teamSaveRequestCount += 1;

          if (teamSaveRequestCount === 1) {
            return jsonResponse(
              {
                error: "team-size-changed",
                message:
                  "Team size changed to 3. Review your picks and try again.",
                teamSize: 3,
              },
              { status: 409 },
            );
          }

          return jsonResponse(
            {
              team: {
                id: "team-east-stand",
                displayName: "East Stand Heroes",
              },
              picks: rankedRikishi.map((rikishi) => ({
                rikishiId: rikishi.id,
              })),
            },
            { status: 201 },
          );
        }

        return mockSuccessfulFetch(
          input,
          currentBashoRequestCount > 1 ? updatedBasho : currentBasho,
        );
      }),
    );
    render(<App />);

    await openTeamEditor();
    fireEvent.change(screen.getByLabelText("Team name"), {
      target: { value: "East Stand Heroes" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /Onosato/ }));
    fireEvent.click(screen.getByRole("button", { name: /Kotozakura/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit team" }));

    expect(
      await screen.findByText(
        "Team size changed to 3. Review your picks and try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Team name")).toHaveValue("East Stand Heroes");
    expect(screen.getByText("2 of 3 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hoshoryu/ })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /Hoshoryu/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit team" }));

    expect(
      await screen.findByText("East Stand Heroes submitted."),
    ).toBeInTheDocument();
    expect(currentBashoRequestCount).toBe(2);
    expect(teamSaveRequestCount).toBe(2);
  });

  it("shows an empty leaderboard state", async () => {
    vi.stubGlobal("fetch", vi.fn(mockEmptyLeaderboardFetch));
    render(<App />);

    fireEvent.click(await screen.findByRole("link", { name: "Leaderboard" }));

    expect(
      screen.getByText(
        "No teams have joined this basho yet. Picks are still open.",
      ),
    ).toBeInTheDocument();
  });

  it("uses leaderboard metadata to show the simulated basho day", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) =>
        mockSuccessfulFetch(input, {
          ...currentBasho,
          status: "active",
          currentDay: 1,
        }),
      ),
    );
    render(<App />);

    await screen.findByRole("link", { name: "Leaderboard" });
    fireEvent.click(screen.getByRole("link", { name: "Leaderboard" }));

    expect(
      screen.getByText("May 2026 Sample Basho - Day 1 of 15"),
    ).toBeInTheDocument();
    expect(screen.getByText("Status: Scoring in progress")).toBeInTheDocument();
  });

  it("restores the previous player view when browser history returns from admin", async () => {
    vi.stubGlobal("fetch", vi.fn(mockAdminExistingTeamFetch));
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "My stable" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Leaderboard" }));
    expect(
      await screen.findByRole("heading", { name: "Follow the leaderboard" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Admin" }));
    expect(
      await screen.findByRole("heading", { name: "Admin controls" }),
    ).toBeInTheDocument();

    act(() => {
      window.history.back();
    });

    expect(
      await screen.findByRole("heading", { name: "Follow the leaderboard" }),
    ).toBeInTheDocument();
  });
});

function mockSuccessfulFetch(
  input: RequestInfo | URL,
  maybeBasho: typeof currentBasho | RequestInit = currentBasho,
): Promise<Response> {
  const url = String(input);
  const basho = "id" in maybeBasho ? maybeBasho : currentBasho;

  if (url === "/api/session") {
    return jsonResponse({
      mode: "local",
      user: {
        id: "local-user",
        email: "player@example.com",
        displayName: "New Player",
      },
    });
  }

  if (url === "/api/basho/current") {
    return jsonResponse(basho);
  }

  if (url === "/api/basho/2026-05/rikishi") {
    return jsonResponse({
      basho,
      rikishi: rankedRikishi,
    });
  }

  if (url === "/api/basho/2026-05/leaderboard") {
    return jsonResponse(
      createLeaderboardResponse({
        basho,
        entries: leaderboard,
      }),
    );
  }

  if (url === "/api/basho/2026-05/my-team") {
    return jsonResponse(
      {
        message: "You do not have a fantasy team for this basho yet.",
      },
      { status: 404 },
    );
  }

  if (url === "/api/basho/2026-05/teams") {
    return jsonResponse(
      {
        team: {
          id: "team-east-stand",
          displayName: "East Stand Heroes",
        },
        picks: [{ rikishiId: "onosato" }, { rikishiId: "kotozakura" }],
      },
      { status: 201 },
    );
  }

  return jsonResponse({ message: "Not found" }, { status: 404 });
}

function mockAdminExistingTeamFetch(
  input: RequestInfo | URL,
): Promise<Response> {
  const url = String(input);

  if (url === "/api/session") {
    return jsonResponse({
      mode: "local",
      user: {
        id: "admin-user",
        email: "admin@example.com",
        displayName: "Admin User",
        isAdmin: true,
      },
    });
  }

  if (url === "/api/basho/2026-05/my-team") {
    return jsonResponse(createExistingMyTeamResponse());
  }

  if (url === "/api/admin/basho/current") {
    return jsonResponse({ basho: currentBasho });
  }

  return mockSuccessfulFetch(input);
}

function mockAnonymousFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = String(input);

  if (url === "/api/session" && init?.method === "POST") {
    return jsonResponse(
      {
        mode: "local",
        user: {
          id: "local-user",
          email: "player@example.com",
          displayName: "New Player",
        },
      },
      { status: 201 },
    );
  }

  if (url === "/api/session") {
    return jsonResponse({
      mode: "local",
      user: null,
    });
  }

  return mockSuccessfulFetch(input);
}

function mockUnauthorizedSessionFetch(
  input: RequestInfo | URL,
): Promise<Response> {
  const url = String(input);

  if (url === "/api/session") {
    return jsonResponse(
      {
        message: "Sign in before loading your session.",
      },
      { status: 401 },
    );
  }

  return mockSuccessfulFetch(input);
}

function mockUnauthorizedBashoFetch(
  input: RequestInfo | URL,
): Promise<Response> {
  const url = String(input);

  if (url === "/api/session") {
    return jsonResponse({
      mode: "neon",
      user: null,
    });
  }

  if (url === "/api/basho/current") {
    return jsonResponse(
      {
        message: "Sign in before loading data.",
      },
      { status: 401 },
    );
  }

  return mockSuccessfulFetch(input);
}

function mockExistingNeonSessionFetch(
  input: RequestInfo | URL,
): Promise<Response> {
  if (String(input) === "/api/session") {
    return jsonResponse({
      mode: "neon",
      user: {
        id: "existing-user",
        email: "existing@example.com",
        displayName: "Existing Player",
      },
    });
  }

  return mockSuccessfulFetch(input);
}

function mockRawUnauthorizedBashoFetch(
  input: RequestInfo | URL,
): Promise<Response> {
  const url = String(input);

  if (url === "/api/session") {
    return jsonResponse({
      mode: "neon",
      user: null,
    });
  }

  if (url === "/api/basho/current") {
    return Promise.resolve(new Response("HTTP 401", { status: 401 }));
  }

  return mockSuccessfulFetch(input);
}

function mockBashoUnauthorizedUntilLoginFetch(): (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response> {
  let signedIn = false;

  return (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url === "/api/session" && init?.method === "POST") {
      signedIn = true;

      return jsonResponse(
        {
          mode: "local",
          user: {
            id: "local-user",
            email: "player@example.com",
            displayName: "New Player",
          },
        },
        { status: 201 },
      );
    }

    if (url === "/api/session") {
      return jsonResponse({
        mode: "local",
        user: null,
      });
    }

    if (url === "/api/basho/current" && !signedIn) {
      return jsonResponse(
        {
          message: "Sign in before loading data.",
        },
        { status: 401 },
      );
    }

    return mockSuccessfulFetch(input);
  };
}

function mockExistingTeamAfterLoginFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = String(input);

  if (url === "/api/session" && init?.method === "POST") {
    return jsonResponse(
      {
        mode: "local",
        user: {
          id: "local-user",
          email: "player@example.com",
          displayName: "New Player",
        },
      },
      { status: 201 },
    );
  }

  if (url === "/api/session") {
    return jsonResponse({
      mode: "local",
      user: null,
    });
  }

  if (url === "/api/basho/2026-05/my-team") {
    return jsonResponse(createExistingMyTeamResponse());
  }

  if (url === "/api/basho/2026-05/leaderboard") {
    return jsonResponse(
      createLeaderboardResponse({
        entries: [
          {
            rank: 1,
            teamId: "team-existing",
            displayName: "Existing Champions",
            score: 0,
            scoreHistory: [],
            rikishiScores: [],
          },
        ],
      }),
    );
  }

  return mockSuccessfulFetch(input);
}

function mockUserSwitchFetch() {
  let signedInUser = 0;

  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);

    if (url === "/api/session" && init?.method === "POST") {
      signedInUser += 1;

      return jsonResponse(
        {
          mode: "local",
          user: {
            id: `local-user-${signedInUser}`,
            email: `player-${signedInUser}@example.com`,
            displayName: `Player ${signedInUser}`,
          },
        },
        { status: 201 },
      );
    }

    if (url === "/api/session" && init?.method === "DELETE") {
      return Promise.resolve(new Response(null, { status: 204 }));
    }

    if (url === "/api/session") {
      return jsonResponse({ mode: "local", user: null });
    }

    if (url === "/api/basho/2026-05/my-team" && signedInUser === 1) {
      return jsonResponse(createExistingMyTeamResponse());
    }

    if (url === "/api/basho/2026-05/my-team") {
      return jsonResponse(
        { message: "You do not have a fantasy team for this basho yet." },
        { status: 404 },
      );
    }

    if (url === "/api/basho/2026-05/leaderboard") {
      return jsonResponse(
        createLeaderboardResponse({
          entries:
            signedInUser === 0
              ? []
              : [
                  {
                    rank: 1,
                    teamId: "team-existing",
                    displayName: "Existing Champions",
                    score: 0,
                    scoreHistory: [],
                    rikishiScores: [],
                  },
                ],
        }),
      );
    }

    return mockSuccessfulFetch(input);
  };
}

async function signInThroughAccountPanel() {
  if (screen.queryByLabelText("Email") === null) {
    fireEvent.click(
      (await screen.findAllByRole("link", { name: "Log in / Join" }))[0]!,
    );
  }

  fireEvent.change(await screen.findByLabelText("Email"), {
    target: { value: "player@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "New Player" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

async function openTeamEditor() {
  if (screen.queryByLabelText("Team name") !== null) {
    return;
  }

  const createButton = await screen.findByRole("button", {
    name: "Create your stable",
  });
  fireEvent.click(createButton);
  await screen.findByLabelText("Team name");
}

function createExistingMyTeamResponse() {
  return {
    basho: currentBasho,
    team: {
      id: "team-existing",
      displayName: "Existing Champions",
    },
    totalScore: 0,
    picks: rankedRikishi.slice(0, 2).map((rikishi) => ({
      rikishiId: rikishi.id,
      shikona: rikishi.shikona,
      heya: rikishi.heya,
      rank: rikishi.rank,
      rankOrder: rikishi.rankOrder,
      wins: 0,
      score: 0,
    })),
  };
}

function mockEmptyLeaderboardFetch(
  input: RequestInfo | URL,
): Promise<Response> {
  const url = String(input);

  if (url !== "/api/basho/2026-05/leaderboard") {
    return mockSuccessfulFetch(input);
  }

  return jsonResponse(createLeaderboardResponse({ entries: [] }));
}

function mockInitialLeaderboardErrorFetch(
  input: RequestInfo | URL,
): Promise<Response> {
  const url = String(input);

  if (url !== "/api/basho/2026-05/leaderboard") {
    return mockSuccessfulFetch(input);
  }

  return jsonResponse(
    {
      message: "Leaderboard unavailable right now.",
    },
    { status: 503 },
  );
}

function mockSlowInitialLeaderboardFetch(
  leaderboardRequest: Deferred<Response>,
): (input: RequestInfo | URL) => Promise<Response> {
  return (input: RequestInfo | URL) => {
    const url = String(input);

    if (url !== "/api/basho/2026-05/leaderboard") {
      return mockSuccessfulFetch(input);
    }

    return leaderboardRequest.promise;
  };
}

function mockStaleInitialLeaderboardFetch(
  initialLeaderboardRequest: Deferred<Response>,
): (input: RequestInfo | URL) => Promise<Response> {
  let leaderboardRequestCount = 0;

  return (input: RequestInfo | URL) => {
    const url = String(input);

    if (url !== "/api/basho/2026-05/leaderboard") {
      return mockSuccessfulFetch(input);
    }

    leaderboardRequestCount += 1;

    if (leaderboardRequestCount === 1) {
      return initialLeaderboardRequest.promise;
    }

    return jsonResponse(
      createLeaderboardResponse({
        entries: [
          {
            rank: 1,
            teamId: "team-east-stand",
            displayName: "East Stand Heroes",
            score: 4,
            scoreHistory: [],
            rikishiScores: [
              {
                rikishiId: "onosato",
                wins: 2,
                score: 2,
              },
              {
                rikishiId: "kotozakura",
                wins: 2,
                score: 2,
              },
            ],
          },
        ],
      }),
    );
  };
}

function createLeaderboardResponse({
  basho = currentBasho,
  entries = leaderboard,
}: {
  basho?: typeof currentBasho;
  entries?: typeof leaderboard;
} = {}) {
  return {
    basho: {
      id: basho.id,
      name: basho.name,
      startDate: basho.startDate,
      endDate: basho.endDate,
      status: basho.status,
      currentDay: basho.currentDay,
    },
    bashoId: basho.id,
    totalDays: 15,
    leaderboard: entries,
  };
}

function mockSubmitLeaderboardErrorFetch(): (
  input: RequestInfo | URL,
) => Promise<Response> {
  let leaderboardRequestCount = 0;

  return (input: RequestInfo | URL) => {
    const url = String(input);

    if (url !== "/api/basho/2026-05/leaderboard") {
      return mockSuccessfulFetch(input);
    }

    leaderboardRequestCount += 1;

    if (leaderboardRequestCount === 1) {
      return mockSuccessfulFetch(input);
    }

    return jsonResponse(
      {
        message: "Unable to refresh leaderboard.",
      },
      { status: 503 },
    );
  };
}

function mockValidationErrorFetch(input: RequestInfo | URL): Promise<Response> {
  const url = String(input);

  if (url !== "/api/basho/2026-05/teams") {
    return mockSuccessfulFetch(input);
  }

  return jsonResponse(
    {
      message: "Fantasy team picks are invalid.",
      details: [
        {
          message: "Expected 2 picks, received 1.",
        },
      ],
    },
    { status: 400 },
  );
}

function jsonResponse(
  body: unknown,
  init: ResponseInit = {},
): Promise<Response> {
  return Promise.resolve(createJsonResponse(body, init));
}

function createJsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status: init.status ?? 200,
  });
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    reject,
    resolve,
  };
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
