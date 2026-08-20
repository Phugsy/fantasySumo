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
      .mockResolvedValueOnce(jsonResponse(gameConfigResponse(liveBasho.id)))
      .mockResolvedValueOnce(jsonResponse({ basho: demoBasho }))
      .mockResolvedValueOnce(jsonResponse(gameConfigResponse(demoBasho.id)))
      .mockResolvedValueOnce(
        jsonResponse({ action: "reset", appliedResults: 0, basho: demoBasho }),
      )
      .mockResolvedValueOnce(jsonResponse(gameConfigResponse(demoBasho.id)));
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
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/demo/reset", {
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
      .mockResolvedValueOnce(jsonResponse(gameConfigResponse(activeBasho.id)))
      .mockResolvedValueOnce(
        jsonResponse({
          action: "close",
          changed: true,
          basho: { ...activeBasho, status: "complete" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(gameConfigResponse(activeBasho.id)));

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
      .mockResolvedValueOnce(jsonResponse(gameConfigResponse(demoBasho.id)))
      .mockResolvedValueOnce(
        jsonResponse({
          action: "advance-day",
          appliedResults: 1,
          basho: { ...demoBasho, currentDay: 1 },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(gameConfigResponse(demoBasho.id)));

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

  it("does not refresh player data after an admin action completes post-unmount", async () => {
    const demoBasho = {
      id: "demo-2026-05",
      isDemo: true,
      name: "Demo Basho",
      startDate: "2026-05-10",
      endDate: "2026-05-24",
      status: "active",
      currentDay: 0,
    };
    let resolveAction: (response: Response) => void;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ basho: demoBasho }))
      .mockResolvedValueOnce(jsonResponse(gameConfigResponse(demoBasho.id)))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveAction = resolve;
          }),
      );
    const onPlayerDataRefresh = vi.fn(() => Promise.resolve());

    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(
      <AdminPanel onPlayerDataRefresh={onPlayerDataRefresh} />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Advance one day" }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    unmount();

    resolveAction!(
      jsonResponse({
        action: "advance-day",
        appliedResults: 1,
        basho: { ...demoBasho, currentDay: 1 },
      }),
    );

    await Promise.resolve();
    expect(onPlayerDataRefresh).not.toHaveBeenCalled();
  });

  it("uses the authoritative basho returned by a lifecycle conflict", async () => {
    const lockedBasho = {
      id: "2026-05",
      isDemo: false,
      name: "May 2026 Basho",
      startDate: "2026-05-10",
      endDate: "2026-05-24",
      status: "locked",
      currentDay: 0,
    };
    const activeBasho = { ...lockedBasho, status: "active", currentDay: 1 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ basho: lockedBasho }))
      .mockResolvedValueOnce(
        jsonResponse(
          gameConfigResponse(lockedBasho.id, { canChangeTeamSize: false }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: "invalid-lifecycle-transition",
            message: "Picks can no longer be reopened.",
            basho: activeBasho,
          },
          409,
        ),
      );

    vi.stubGlobal("fetch", fetchMock);
    render(<AdminPanel onPlayerDataRefresh={() => Promise.resolve()} />);

    fireEvent.click(await screen.findByRole("button", { name: "Open picks" }));

    expect(
      await screen.findByText("Picks can no longer be reopened."),
    ).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open picks" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Close the basho" }),
    ).toBeEnabled();
  });

  it("persists team size for the selected basho and refreshes player data", async () => {
    const upcomingBasho = {
      id: "2026-09",
      isDemo: false,
      name: "September 2026 Basho",
      startDate: "2026-09-13",
      endDate: "2026-09-27",
      status: "upcoming",
      currentDay: 0,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ basho: upcomingBasho }))
      .mockResolvedValueOnce(jsonResponse(gameConfigResponse(upcomingBasho.id)))
      .mockResolvedValueOnce(
        jsonResponse({
          ...gameConfigResponse(upcomingBasho.id, { teamSize: 3 }),
          changed: true,
          gameConfig: {
            teamSize: 3,
            teamSizeSource: "basho",
            scoringMode: "wins-v0",
          },
        }),
      );
    const onPlayerDataRefresh = vi.fn(() => Promise.resolve());

    vi.stubGlobal("fetch", fetchMock);
    render(<AdminPanel onPlayerDataRefresh={onPlayerDataRefresh} />);

    const input = await screen.findByLabelText("Rikishi per stable");
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save team size" }));

    expect(
      await screen.findByText("Team size saved as 3."),
    ).toBeInTheDocument();
    expect(input).toHaveValue(3);
    expect(screen.getByText("Saved for this basho")).toBeInTheDocument();
    expect(onPlayerDataRefresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/basho/2026-09/game-config",
      {
        body: JSON.stringify({ teamSize: 3 }),
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      },
    );
  });

  it("dry-runs a partial results import without claiming data was written", async () => {
    const upcomingBasho = {
      id: "2026-09",
      isDemo: false,
      name: "September 2026 Basho",
      startDate: "2026-09-13",
      endDate: "2026-09-27",
      status: "upcoming",
      currentDay: 0,
    };
    const importResponse = {
      dryRun: true,
      source: "sumo-api-results",
      status: "partial",
      summary: {
        results: { created: 21, updated: 0, skipped: 0, deleted: 0 },
      },
      schedule: {
        status: "unavailable",
        day: 2,
        message: "Schedule has not been published.",
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ basho: upcomingBasho }))
      .mockResolvedValueOnce(jsonResponse(gameConfigResponse(upcomingBasho.id)))
      .mockResolvedValueOnce(jsonResponse(importResponse));

    vi.stubGlobal("fetch", fetchMock);
    render(<AdminPanel onPlayerDataRefresh={() => Promise.resolve()} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Validate results" }),
    );

    expect(
      await screen.findByText("Validation completed for results data."),
    ).toBeInTheDocument();
    expect(screen.getByText("Dry-run result")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Results were validated, but day 2 schedule status is unavailable: Schedule has not been published.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Results were saved/)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/basho/2026-09/import-results?dryRun=true",
      {
        body: JSON.stringify({ day: 1, division: "Makuuchi" }),
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

function gameConfigResponse(
  bashoId: string,
  overrides: { canChangeTeamSize?: boolean; teamSize?: number } = {},
) {
  return {
    bashoId,
    canChangeTeamSize: overrides.canChangeTeamSize ?? true,
    gameConfig: {
      teamSize: overrides.teamSize ?? 2,
      teamSizeSource: "default",
      scoringMode: "wins-v0",
    },
  };
}
