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
import type { JokerSnapshotResponse } from "../api";
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
function snapshot(
  now = "2026-05-10T02:00:00.000Z",
): NonNullable<JokerSnapshotResponse["snapshot"]> {
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
      {
        day: 2,
        deadline: "2026-05-11T03:00:00.000Z",
        status: "open",
        targets: [{ rikishiId: "a", boutId: "bout-2", opponentId: "b" }],
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
  expect(screen.queryByLabelText("Basho day")).not.toBeInTheDocument();
  expect(
    screen.getByRole("option", { name: "Alpha (fights Beta)" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("option", { name: "Beta (fights Alpha)" }),
  ).toBeInTheDocument();
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
  expect(
    screen.getByText("Current basho day: 1 (Japan time)."),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save joker" })).toBeDisabled();
});

it("uses the server's Japan date rather than the first open future window", async () => {
  const data = snapshot("2026-05-10T15:30:00.000Z");
  data.windows[0]!.status = "closed";
  vi.mocked(fetchMyJokers).mockResolvedValue({ snapshot: data });
  render(<JokerPanel bashoId="demo" names={{ a: "Alpha", b: "Beta" }} />);
  expect(
    await screen.findByText("Current basho day: 2 (Japan time)."),
  ).toBeInTheDocument();
  expect(screen.getByText("Pick Window: Open")).toBeInTheDocument();
  expect(screen.getByLabelText("Joker rikishi")).toHaveValue("");
});

it("keeps today's closed window on load even when tomorrow's card is already open", async () => {
  const data = snapshot("2026-05-10T04:00:00.000Z");
  data.windows[0]!.status = "closed";
  vi.mocked(fetchMyJokers).mockResolvedValue({ snapshot: data });
  render(<JokerPanel bashoId="demo" names={{ a: "Alpha", b: "Beta" }} />);
  expect(
    await screen.findByText("Current basho day: 1 (Japan time)."),
  ).toBeInTheDocument();
  expect(screen.getByText("Pick Window: Closed")).toBeInTheDocument();
  expect(screen.getByLabelText("Joker rikishi")).toBeDisabled();
});

it.each(["2026-05-09T02:00:00.000Z", "2026-05-12T02:00:00.000Z"])(
  "offers no other day's window outside the basho dates (%s)",
  async (now) => {
    vi.mocked(fetchMyJokers).mockResolvedValue({ snapshot: snapshot(now) });
    render(<JokerPanel bashoId="demo" names={{ a: "Alpha", b: "Beta" }} />);
    expect(await screen.findByText(/No Pick Window today/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Joker rikishi")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh joker window" }),
    ).toBeEnabled();
  },
);

it("follows Japan midnight while the panel stays open without reusing yesterday's selection", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-04T10:00:00.000Z"));
  const data = snapshot("2026-05-10T14:59:59.000Z");
  data.windows[0]!.status = "closed";
  data.allocations = [
    { day: 1, rikishiId: "b", boutId: "bout", revision: 1, state: "consumed" },
  ];
  vi.mocked(fetchMyJokers).mockResolvedValue({ snapshot: data });
  await act(async () => {
    render(<JokerPanel bashoId="demo" names={{ a: "Alpha", b: "Beta" }} />);
  });
  expect(
    screen.getByText("Current basho day: 1 (Japan time)."),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Joker rikishi")).toHaveValue(
    JSON.stringify(["bout", "b"]),
  );
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  expect(
    screen.getByText("Current basho day: 2 (Japan time)."),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Joker rikishi")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Save joker" })).toBeDisabled();
  expect(
    screen.getByRole("list", { name: "Joker allocation history" }),
  ).toHaveTextContent("Day 1: Beta · consumed");
});

it("refreshes to today's authoritative allocation and saves against today's revision", async () => {
  const data = snapshot();
  const tomorrow = snapshot("2026-05-11T02:00:00.000Z");
  tomorrow.allocations = [
    {
      day: 2,
      rikishiId: "a",
      boutId: "bout-2",
      revision: 3,
      state: "reserved",
    },
  ];
  vi.mocked(fetchMyJokers)
    .mockResolvedValueOnce({ snapshot: data })
    .mockResolvedValueOnce({ snapshot: tomorrow });
  vi.mocked(saveMyJoker).mockResolvedValue({ snapshot: tomorrow });
  render(<JokerPanel bashoId="demo" names={{ a: "Alpha", b: "Beta" }} />);
  await screen.findByText("Pick Window: Open");
  fireEvent.change(screen.getByLabelText("Joker rikishi"), {
    target: { value: JSON.stringify(["bout", "b"]) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Refresh joker window" }));
  await screen.findByText("Current basho day: 2 (Japan time).");
  expect(screen.getByLabelText("Joker rikishi")).toHaveValue(
    JSON.stringify(["bout-2", "a"]),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save joker" }));
  await waitFor(() =>
    expect(saveMyJoker).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        day: 2,
        rikishiId: "a",
        boutId: "bout-2",
        expectedRevision: 3,
      }),
    ),
  );
});
