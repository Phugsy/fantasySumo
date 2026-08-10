import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminPanel } from "./AdminPanel";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AdminPanel", () => {
  it("runs the confirmed isolated demo reset and reports refreshed state", async () => {
    const liveBasho = {
      id: "2026-05",
      isDemo: false,
      name: "May 2026 Basho",
      startDate: "2026-05-10",
      endDate: "2026-05-24",
      status: "active",
      currentDay: 3,
    };
    const demoBasho = {
      id: "demo-2026-05",
      isDemo: true,
      name: "Demo Basho",
      startDate: "2026-05-10",
      endDate: "2026-05-24",
      status: "upcoming",
      currentDay: 0,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ basho: liveBasho }))
      .mockResolvedValueOnce(jsonResponse({ basho: demoBasho }))
      .mockResolvedValueOnce(
        jsonResponse({ action: "reset", appliedResults: 0, basho: demoBasho }),
      );
    const onPlayerDataRefresh = vi.fn(() => Promise.resolve());

    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AdminPanel onPlayerDataRefresh={onPlayerDataRefresh} />);

    expect(
      await screen.findByRole("heading", { name: "May 2026 Basho" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Demo fixture" }));
    expect(
      await screen.findByRole("heading", { name: "Demo Basho" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Reset and open picks" }),
    );

    await waitFor(() => expect(onPlayerDataRefresh).toHaveBeenCalled());
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("never live data"),
    );
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/demo/reset", {
      body: "{}",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    expect(
      screen.getByText("Demo fixture reset. Picks are open at day 0."),
    ).toBeInTheDocument();
  });

  it("confirms closing a live basho", async () => {
    const activeBasho = {
      id: "2026-05",
      isDemo: false,
      name: "May 2026 Basho",
      startDate: "2026-05-10",
      endDate: "2026-05-24",
      status: "active",
      currentDay: 15,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ basho: activeBasho }))
      .mockResolvedValueOnce(
        jsonResponse({
          action: "close",
          changed: true,
          basho: { ...activeBasho, status: "complete" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AdminPanel onPlayerDataRefresh={() => Promise.resolve()} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Close the basho" }),
    );

    expect(
      await screen.findByText("Basho marked complete."),
    ).toBeInTheDocument();
    expect(window.confirm).toHaveBeenCalled();
  });

  it("keeps a successful admin action distinct from a player data refresh failure", async () => {
    const demoBasho = {
      id: "demo-2026-05",
      isDemo: true,
      name: "Demo Basho",
      startDate: "2026-05-10",
      endDate: "2026-05-24",
      status: "active",
      currentDay: 0,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ basho: demoBasho }))
      .mockResolvedValueOnce(
        jsonResponse({
          action: "advance-day",
          appliedResults: 1,
          basho: { ...demoBasho, currentDay: 1 },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);
    render(
      <AdminPanel
        onPlayerDataRefresh={() =>
          Promise.reject(new Error("Player data is temporarily unavailable."))
        }
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Advance one day" }),
    );

    expect(
      await screen.findByText("Demo advanced by one result day."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The action succeeded, but player data could not be refreshed: Player data is temporarily unavailable.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Advance one day" }),
    ).toBeEnabled();
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}
