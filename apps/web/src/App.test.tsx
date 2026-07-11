import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const currentBasho = {
  id: "2026-05",
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

const leaderboard = [
  {
    rank: 1,
    teamId: "team-east",
    displayName: "East Side",
    score: 2,
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
    rikishiScores: [],
  },
];

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(mockSuccessfulFetch));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("loads the current basho and rikishi", async () => {
    render(<App />);

    expect(
      screen.getByText("Loading the current basho..."),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "May 2026 Sample Basho" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Onosato/ })).toBeInTheDocument();
    expect(screen.getByText("0 of 2 selected")).toBeInTheDocument();
  });

  it("lets an anonymous local user sign in before saving a team", async () => {
    vi.stubGlobal("fetch", vi.fn(mockAnonymousFetch));
    render(<App />);

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "player@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "New Player" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("New Player")).toBeInTheDocument();
    expect(screen.getByText("player@example.com")).toBeInTheDocument();
  });

  it("shows public basho data when the session probe is unauthorized", async () => {
    vi.stubGlobal("fetch", vi.fn(mockUnauthorizedSessionFetch));
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "May 2026 Sample Basho" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Onosato/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: /Onosato/ })).toBeInTheDocument();
  });

  it("shows the leaderboard after sign in when the user already has picks", async () => {
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
      await screen.findByRole("heading", { name: "Leaderboard" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Existing Champions")).toBeInTheDocument();
  });

  it("displays leaderboard standings and team score details", async () => {
    render(<App />);

    await screen.findByRole("button", { name: "Leaderboard" });
    fireEvent.click(screen.getByRole("button", { name: "Leaderboard" }));

    expect(
      screen.getByRole("heading", { name: "Leaderboard" }),
    ).toBeInTheDocument();
    expect(screen.getByText("East Side")).toBeInTheDocument();
    expect(screen.getByText("2 pts")).toBeInTheDocument();
    expect(screen.getAllByText("Tied on score")).toHaveLength(2);
    expect(screen.getByText("Onosato")).toBeInTheDocument();
    expect(screen.getAllByText("1 win")).toHaveLength(2);
  });

  it("keeps team selection available when the initial leaderboard load fails", async () => {
    vi.stubGlobal("fetch", vi.fn(mockInitialLeaderboardErrorFetch));
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "May 2026 Sample Basho" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Onosato/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Leaderboard" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Leaderboard" }));

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

    await screen.findByRole("button", { name: /Onosato/ });
    fireEvent.change(screen.getByLabelText("Team name"), {
      target: { value: "East Stand Heroes" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Onosato/ }));
    fireEvent.click(screen.getByRole("button", { name: /Kotozakura/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit team" }));

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
      await screen.findByText("This basho has started, so picks are locked."),
    ).toBeInTheDocument();
    expect(screen.getByText("Scoring in progress")).toBeInTheDocument();
    expect(screen.getByText(/Day 5/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Onosato/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit team" })).toBeDisabled();
  });

  it("submits a selected team and shows confirmation", async () => {
    const fetchMock = vi.fn(mockSuccessfulFetch);
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

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
      screen.getByRole("heading", { name: "Leaderboard" }),
    ).toBeInTheDocument();
  });

  it("stays on team selection and shows the refresh error when standings fail after submit", async () => {
    vi.stubGlobal("fetch", vi.fn(mockSubmitLeaderboardErrorFetch()));
    render(<App />);

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
      screen.getByText("Unable to refresh leaderboard."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Selection" }),
    ).toBeInTheDocument();
  });

  it("displays API validation errors", async () => {
    vi.stubGlobal("fetch", vi.fn(mockValidationErrorFetch));
    render(<App />);

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

  it("shows an empty leaderboard state", async () => {
    vi.stubGlobal("fetch", vi.fn(mockEmptyLeaderboardFetch));
    render(<App />);

    await screen.findByRole("button", { name: "Leaderboard" });
    fireEvent.click(screen.getByRole("button", { name: "Leaderboard" }));

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

    await screen.findByRole("button", { name: "Leaderboard" });
    fireEvent.click(screen.getByRole("button", { name: "Leaderboard" }));

    expect(
      screen.getByText("May 2026 Sample Basho - Day 1 of 15"),
    ).toBeInTheDocument();
    expect(screen.getByText("Status: Scoring in progress")).toBeInTheDocument();
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
    return jsonResponse({
      team: {
        id: "team-existing",
        displayName: "Existing Champions",
      },
      picks: [{ rikishiId: "onosato" }, { rikishiId: "kotozakura" }],
    });
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
            rikishiScores: [],
          },
        ],
      }),
    );
  }

  return mockSuccessfulFetch(input);
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
