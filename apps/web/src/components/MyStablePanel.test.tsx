import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Basho, MyTeamResponse } from "../types";
import { MyStablePanel } from "./MyStablePanel";

const upcomingBasho: Basho = {
  id: "2026-05",
  isDemo: true,
  name: "Demo May Basho",
  startDate: "2026-05-10",
  endDate: "2026-05-24",
  status: "upcoming",
  currentDay: 0,
  teamSize: 2,
};

const myTeam: MyTeamResponse = {
  basho: upcomingBasho,
  team: {
    id: "team-codex",
    displayName: "Codex Stable",
  },
  totalScore: 4,
  picks: [
    {
      rikishiId: "onosato",
      shikona: "Onosato",
      heya: "Nishonoseki",
      rank: "Ozeki",
      rankOrder: 1,
      wins: 3,
      score: 3,
    },
    {
      rikishiId: "hoshoryu",
      shikona: "Hoshoryu",
      heya: "Tatsunami",
      rank: "Yokozuna",
      rankOrder: 2,
      wins: 1,
      score: 1,
    },
  ],
};

const user = {
  id: "player-1",
  email: "player@example.com",
  displayName: "Player One",
};

describe("MyStablePanel", () => {
  it("keeps private team data behind sign-in", () => {
    render(
      <MyStablePanel
        basho={upcomingBasho}
        myTeam={null}
        onEdit={() => undefined}
        user={null}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Sign in to see your team" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Codex Stable")).not.toBeInTheDocument();
  });

  it("offers a clear create action while picks are open", () => {
    const onEdit = vi.fn();
    render(
      <MyStablePanel
        basho={upcomingBasho}
        myTeam={null}
        onEdit={onEdit}
        user={user}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create your stable" }));

    expect(onEdit).toHaveBeenCalledOnce();
    expect(
      screen.getByText(
        "Picks are open. Create your stable before the basho begins.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the owner's score, rikishi details, and locked state", () => {
    const activeMyTeam = {
      ...myTeam,
      basho: { ...upcomingBasho, status: "active" as const, currentDay: 5 },
    };

    render(
      <MyStablePanel
        basho={activeMyTeam.basho}
        myTeam={activeMyTeam}
        onEdit={() => undefined}
        user={user}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Codex Stable" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("4 total points")).toBeInTheDocument();
    expect(
      screen.getByText("Demo May Basho · Scoring in progress · Day 5"),
    ).toBeInTheDocument();
    expect(screen.getByText("Onosato")).toBeInTheDocument();
    expect(screen.getByText("Nishonoseki")).toBeInTheDocument();
    expect(screen.getByText("3 wins")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This basho has started, so picks are locked. Your line-up is read-only.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit picks" }),
    ).not.toBeInTheDocument();
  });

  it("keeps lifecycle and scores on the same private-team snapshot", () => {
    render(
      <MyStablePanel
        basho={{ ...upcomingBasho, status: "active", currentDay: 6 }}
        myTeam={myTeam}
        onEdit={() => undefined}
        user={user}
      />,
    );

    expect(screen.getByText("Demo May Basho · Picks open")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit picks" })).toBeEnabled();
    expect(screen.queryByText(/Day 6/)).not.toBeInTheDocument();
  });

  it("links an editable stable back to its pick editor", () => {
    const onEdit = vi.fn();
    render(
      <MyStablePanel
        basho={upcomingBasho}
        myTeam={myTeam}
        onEdit={onEdit}
        user={user}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit picks" }));

    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("keeps an individually locked team read-only during an upcoming basho", () => {
    render(
      <MyStablePanel
        basho={upcomingBasho}
        myTeam={{
          ...myTeam,
          team: {
            ...myTeam.team,
            lockedAt: "2026-05-08T02:00:00.000Z",
          },
        }}
        onEdit={() => undefined}
        user={user}
      />,
    );

    expect(
      screen.getByText(
        "Picks are locked for this basho. Your line-up is read-only.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit picks" }),
    ).not.toBeInTheDocument();
  });
});
