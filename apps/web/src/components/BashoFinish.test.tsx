import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { BashoFantasyFinish } from "@fantasy-sumo/domain";
import {
  BashoFinishSummary,
  CompletedBashoStandings,
  FinishAnnouncement,
} from "./BashoFinish";
import {
  fetchAllTimeLeaderboard,
  fetchLeaderboard,
  fetchMyHistory,
} from "../api";

vi.mock("../api", () => ({
  fetchAllTimeLeaderboard: vi.fn(),
  fetchMyHistory: vi.fn(),
  fetchLeaderboard: vi.fn(),
  getErrorMessage: (error: unknown) => String(error),
}));
const finish: BashoFantasyFinish = {
  bashoId: "2026-09",
  bashoName: "September",
  startDate: "2026-09-13",
  endDate: "2026-09-27",
  outcome: {
    status: "confirmed",
    yusho: [
      {
        teamId: "a",
        displayName: "First Stable",
        ownerName: "Alice",
        score: 40,
      },
    ],
    junYusho: [
      {
        teamId: "b",
        displayName: "Second Stable",
        ownerName: "Bob",
        score: 37,
      },
    ],
  },
};
beforeEach(() => {
  vi.resetAllMocks();
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      clear: () => values.clear(),
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
  vi.mocked(fetchAllTimeLeaderboard).mockResolvedValue({
    bashoCount: 1,
    leaderboard: [],
    finishes: [finish],
    latestFinish: finish,
  });
  vi.mocked(fetchMyHistory).mockResolvedValue({
    score: 40,
    history: [
      {
        basho: {
          id: "2026-09",
          isDemo: false,
          name: "September",
          startDate: "2026-09-13",
          endDate: "2026-09-27",
          status: "complete",
        },
        team: { id: "a", displayName: "First Stable" },
        score: 40,
        picks: [],
      },
    ],
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

it("shows shared recipients without inventing a runner-up and keeps a final standings link", () => {
  const shared: BashoFantasyFinish = {
    ...finish,
    outcome: {
      status: "confirmed",
      yusho: [
        ...(finish.outcome.status === "confirmed" ? finish.outcome.yusho : []),
        { teamId: "c", displayName: "Joint Stable", score: 40 },
      ],
      junYusho: [],
    },
  };
  render(<BashoFinishSummary finish={shared} />);
  expect(
    screen.getByRole("heading", { name: "Shared yusho" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Joint Stable")).toBeInTheDocument();
  expect(
    screen.getByText("No runner-up: first place was shared."),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "View final standings" }),
  ).toHaveAttribute("href", "/history?basho=2026-09");
});
it("dismisses with Escape, restores focus and remembers per user/basho across mounts", async () => {
  const first = render(
    <>
      <button>Return target</button>
      <FinishAnnouncement userId="alice" refreshKey="next-basho" />
    </>,
  );
  const opener = screen.getByRole("button", { name: "Return target" });
  opener.focus();
  const dialog = await screen.findByRole("dialog");
  expect(screen.getByRole("button", { name: "Dismiss result" })).toHaveFocus();
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(opener).toHaveFocus();
  expect(window.localStorage.getItem("fantasy-sumo:finish:alice:2026-09")).toBe(
    "dismissed",
  );
  first.unmount();
  render(<FinishAnnouncement userId="alice" refreshKey="next-basho" />);
  await waitFor(() => expect(fetchAllTimeLeaderboard).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("does not announce a tournament the signed-in player did not enter", async () => {
  vi.mocked(fetchMyHistory).mockResolvedValue({ score: 0, history: [] });
  render(<FinishAnnouncement userId="new-player" refreshKey="active" />);
  await waitFor(() => expect(fetchMyHistory).toHaveBeenCalled());
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("refreshes on return to the app when the result becomes verified", async () => {
  vi.mocked(fetchAllTimeLeaderboard).mockResolvedValueOnce({
    bashoCount: 0,
    leaderboard: [],
    finishes: [],
  });
  render(<FinishAnnouncement userId="alice" refreshKey="active" />);
  await waitFor(() => expect(fetchAllTimeLeaderboard).toHaveBeenCalledOnce());
  await waitFor(() => expect(fetchMyHistory).toHaveBeenCalledOnce());
  fireEvent(window, new Event("focus"));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
});
it("keeps a prematurely closed archive explicitly unconfirmed", async () => {
  vi.mocked(fetchLeaderboard).mockResolvedValue({
    basho: {
      id: "2026-09",
      isDemo: false,
      name: "September",
      startDate: "2026-09-13",
      endDate: "2026-09-27",
      status: "complete",
    },
    bashoId: "2026-09",
    leaderboard: [],
    finish: {
      ...finish,
      outcome: { status: "pending", reason: "results-pending" },
    },
  });
  render(<CompletedBashoStandings bashoId="2026-09" />);
  expect(
    await screen.findByText(/Fantasy honours are unavailable until/),
  ).toBeInTheDocument();
  expect(screen.queryByText("First Stable")).toBeNull();
});
