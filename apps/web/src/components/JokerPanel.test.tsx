import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { JokerPanel } from "./JokerPanel";
import { fetchMyJokers, saveMyJoker } from "../api";
vi.mock("../api", () => ({
  fetchMyJokers: vi.fn(),
  saveMyJoker: vi.fn(),
  getErrorMessage: (e: Error) => e.message,
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});
function snapshot(now = "2026-05-10T02:00:00.000Z") {
  return {
    now,
    remaining: 3,
    budgetDiscrepancy: false,
    trial: {
      preset: "three-joker-v1",
      clock: now,
      baseMode: "wins-v0" as const,
    },
    allocations: [],
    windows: [
      {
        day: 1,
        deadline: "2026-05-10T03:00:00.000Z",
        status: "open",
        targets: [
          { rikishiId: "a", boutId: "bout", opponentId: "b" },
          { rikishiId: "b", boutId: "bout", opponentId: "a" },
        ],
      },
    ],
  };
}
it("distinguishes two owned rikishi in the same bout and sends the selected immutable matchup", async () => {
  const data = snapshot();
  vi.mocked(fetchMyJokers).mockResolvedValue({ snapshot: data });
  vi.mocked(saveMyJoker).mockResolvedValue({
    snapshot: { ...data, remaining: 2 },
  });
  render(<JokerPanel bashoId="demo" names={{ a: "Alpha", b: "Beta" }} />);
  await screen.findByText("Pick Window: Open");
  fireEvent.change(screen.getByLabelText("Joker rikishi"), {
    target: { value: JSON.stringify(["bout", "b"]) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save joker" }));
  await waitFor(() =>
    expect(saveMyJoker).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        rikishiId: "b",
        opponentId: "a",
        boutId: "bout",
        day: 1,
        expectedRevision: 0,
      }),
    ),
  );
  expect(
    await screen.findByText(/2 of 3 jokers remaining/),
  ).toBeInTheDocument();
});
it("closes the displayed window at cutoff independently of the browser wall-clock date", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00.000Z"));
  vi.mocked(fetchMyJokers).mockResolvedValue({
    snapshot: snapshot("2026-05-10T02:59:59.000Z"),
  });
  await act(async () => {
    render(<JokerPanel bashoId="demo" names={{ a: "Alpha", b: "Beta" }} />);
  });
  expect(screen.getByText("Pick Window: Open")).toBeInTheDocument();
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  expect(screen.getByText("Pick Window: Closed")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save joker" })).toBeDisabled();
});
