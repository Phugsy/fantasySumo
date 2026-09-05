import { fireEvent, render, screen, within } from "@testing-library/react";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { TeamSelection } from "./TeamSelection";
import type { CreatedTeamResponse, RankedRikishi } from "../types";

const rikishi: RankedRikishi[] = [
  {
    id: "onosato",
    shikona: "Onosato",
    heya: "Nishonoseki",
    rank: "Ozeki",
    rankOrder: 1,
    previousBashoRecord: {
      status: "available",
      bashoId: "2026-03",
      bashoName: "March 2026 Basho",
      startDate: "2026-03-08",
      rank: "Sekiwake",
      wins: 10,
      losses: 5,
      absences: 0,
    },
    tournamentNotes: { statuses: [], achievements: [] },
  },
  {
    id: "kotozakura",
    shikona: "Kotozakura",
    heya: "Sadogatake",
    rank: "Ozeki",
    rankOrder: 2,
    previousBashoRecord: {
      status: "available",
      bashoId: "2026-03",
      bashoName: "March 2026 Basho",
      startDate: "2026-03-08",
      rank: "Ozeki",
      wins: 5,
      losses: 4,
      absences: 6,
    },
    tournamentNotes: { statuses: [], achievements: [] },
  },
  {
    id: "hoshoryu",
    shikona: "Hoshoryu",
    heya: "Tatsunami",
    rank: "Sekiwake",
    rankOrder: 3,
    previousBashoRecord: {
      status: "did-not-compete",
      bashoId: "2026-03",
      bashoName: "March 2026 Basho",
      startDate: "2026-03-08",
    },
    tournamentNotes: { statuses: [], achievements: [] },
  },
  {
    id: "tobizaru",
    shikona: "Tobizaru",
    heya: "Oitekaze",
    rank: "Maegashira #1",
    rankOrder: 4,
    tournamentNotes: { statuses: [], achievements: [] },
  },
];

const onosato = rikishi[0] as RankedRikishi;
const kotozakura = rikishi[1] as RankedRikishi;

const createdTeam: CreatedTeamResponse = {
  team: {
    id: "team-east",
    displayName: "East Stand Heroes",
  },
  picks: [{ rikishiId: "onosato" }, { rikishiId: "kotozakura" }],
};

describe("TeamSelection", () => {
  it("shows selection state and disables extra picks when the team is full", () => {
    renderTeamSelection({
      selectedIds: ["onosato", "kotozakura"],
      selectedRikishi: [onosato, kotozakura],
    });

    const banzuke = screen.getByRole("region", { name: "Choose rikishi" });

    expect(
      within(banzuke).getByRole("button", { name: /Onosato/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(banzuke).getByRole("button", { name: /Kotozakura/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(banzuke).getByRole("button", { name: /Hoshoryu/ }),
    ).toBeDisabled();
  });

  it("shows accessible previous-basho records and distinct missing-history states", () => {
    renderTeamSelection();

    expect(
      screen.getByText("Previous basho: March 2026 Basho · 10–5 · Sekiwake"),
    ).toBeInTheDocument();
    const banzuke = screen.getByRole("region", { name: "Choose rikishi" });

    expect(
      within(banzuke).getByRole("button", { name: /Kotozakura/ }),
    ).toHaveAccessibleName(
      /Previous basho March 2026 Basho: 5 wins, 4 losses, 6 absences, ranked Ozeki/,
    );
    expect(
      screen.getByText("Previous basho: March 2026 Basho · Did not compete"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Previous basho: Record unavailable"),
    ).toBeInTheDocument();
  });

  it("emits input, pick, remove, and submit events", () => {
    const onDisplayNameChange = vi.fn();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });
    const onToggleRikishi = vi.fn();

    renderTeamSelection({
      displayName: "",
      onDisplayNameChange,
      onSubmit,
      onToggleRikishi,
    });

    fireEvent.change(screen.getByLabelText("Team name"), {
      target: { value: "East Stand Heroes" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Onosato/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Kotozakura" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit team" }));

    expect(onDisplayNameChange).toHaveBeenCalledWith("East Stand Heroes");
    expect(onToggleRikishi).toHaveBeenCalledWith("onosato");
    expect(onToggleRikishi).toHaveBeenCalledWith("kotozakura");
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("shows form errors and submission confirmation", () => {
    renderTeamSelection({
      createdTeam,
      errorMessage: "Unable to refresh leaderboard.",
    });

    expect(
      screen.getByText("Unable to refresh leaderboard."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("East Stand Heroes submitted."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("2 rikishi selected for this basho."),
    ).toBeInTheDocument();
  });

  it("disables team editing when picks are locked", () => {
    const onToggleRikishi = vi.fn();

    renderTeamSelection({
      isLocked: true,
      lockMessage: "This basho has started, so picks are locked.",
      onToggleRikishi,
    });

    expect(
      screen.getByText("This basho has started, so picks are locked."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Team name")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Onosato/ })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Remove Kotozakura" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit team" })).toBeDisabled();
  });

  it("labels edit saves clearly and lets the user cancel", () => {
    const onCancel = vi.fn();

    renderTeamSelection({ createdTeam, mode: "edit", onCancel });

    expect(
      screen.getByRole("heading", { name: "Edit stable" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    expect(
      screen.getByText("Changes saved for East Stand Heroes."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});

function renderTeamSelection(
  props: Partial<Parameters<typeof TeamSelection>[0]> = {},
) {
  const selectedIds = props.selectedIds ?? ["kotozakura"];
  const selectedRikishi = props.selectedRikishi ?? [kotozakura];

  return render(
    <TeamSelection
      canSubmit={props.canSubmit ?? true}
      createdTeam={props.createdTeam ?? null}
      displayName={props.displayName ?? "East Stand Heroes"}
      errorMessage={props.errorMessage ?? null}
      isLocked={props.isLocked ?? false}
      lockMessage={props.lockMessage}
      mode={props.mode ?? "create"}
      onCancel={props.onCancel ?? vi.fn()}
      onDisplayNameChange={props.onDisplayNameChange ?? vi.fn()}
      onSubmit={props.onSubmit ?? vi.fn()}
      onToggleRikishi={props.onToggleRikishi ?? vi.fn()}
      rikishi={props.rikishi ?? rikishi}
      selectedIds={selectedIds}
      selectedRikishi={selectedRikishi}
      submitState={props.submitState ?? "idle"}
      teamSize={props.teamSize ?? 2}
    />,
  );
}
