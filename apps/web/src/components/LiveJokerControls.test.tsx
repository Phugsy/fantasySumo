import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LiveJokerControls } from "./LiveJokerControls";
import { enableLiveJokerTrial, fetchLiveJokerTrial } from "../api";
vi.mock("../api", () => ({
  fetchLiveJokerTrial: vi.fn(),
  enableLiveJokerTrial: vi.fn(),
  getErrorMessage: (e: Error) => e.message,
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const trial = {
  bashoId: "2026-11",
  preset: "three-joker-v1",
  baseMode: "wins-v0" as const,
  enabledAt: "2026-11-07T10:00:00Z",
  enabledBy: "admin",
};
it("requires confirmation and refreshes the saved rules after successful activation", async () => {
  vi.mocked(fetchLiveJokerTrial).mockResolvedValue({ trial: null });
  vi.mocked(enableLiveJokerTrial).mockResolvedValue({ trial });
  const refresh = vi.fn().mockResolvedValue(undefined);
  render(<LiveJokerControls onRefresh={refresh} />);
  const button = await screen.findByRole("button", {
    name: "Enable November jokers",
  });
  expect(button).toBeDisabled();
  await waitFor(() => expect(screen.getByRole("checkbox")).toBeEnabled());
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(button);
  await screen.findByText(/Jokers are enabled for November/);
  expect(enableLiveJokerTrial).toHaveBeenCalledWith("2026-11");
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});
it("shows a rejected activation without claiming that jokers are enabled", async () => {
  vi.mocked(fetchLiveJokerTrial).mockResolvedValue({ trial: null });
  vi.mocked(enableLiveJokerTrial).mockRejectedValue(
    new Error("Trial setup is closed"),
  );
  render(<LiveJokerControls onRefresh={vi.fn()} />);
  await waitFor(() => expect(screen.getByRole("checkbox")).toBeEnabled());
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Enable November jokers" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Trial setup is closed",
  );
  expect(
    screen.queryByText(/Jokers are enabled for November/),
  ).not.toBeInTheDocument();
});
