import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { getErrorMessage, getJson, postJson } from "./api";
import { BashoPanel } from "./components/BashoPanel";
import { LeaderboardPanel } from "./components/LeaderboardPanel";
import { PageHeader } from "./components/PageHeader";
import { TeamSelection } from "./components/TeamSelection";
import { ViewSwitch } from "./components/ViewSwitch";
import type {
  ActiveView,
  Basho,
  BashoRikishiResponse,
  CreatedTeamResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  LoadState,
  RankedRikishi,
} from "./types";

export function App() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [basho, setBasho] = useState<Basho | null>(null);
  const [rikishi, setRikishi] = useState<RankedRikishi[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("selection");
  const [displayName, setDisplayName] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "submitting">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [leaderboardErrorMessage, setLeaderboardErrorMessage] = useState<
    string | null
  >(null);
  const [createdTeam, setCreatedTeam] = useState<CreatedTeamResponse | null>(
    null,
  );

  useEffect(() => {
    let isCurrent = true;

    async function loadBasho() {
      try {
        const currentBasho = await getJson<Basho>("/api/basho/current");
        const bashoRikishi = await getJson<BashoRikishiResponse>(
          `/api/basho/${currentBasho.id}/rikishi`,
        );

        if (!isCurrent) {
          return;
        }

        setBasho({
          ...bashoRikishi.basho,
          teamSize: currentBasho.teamSize,
        });
        setRikishi(bashoRikishi.rikishi);
        setLoadState(bashoRikishi.rikishi.length === 0 ? "empty" : "ready");

        try {
          const leaderboardResponse = await getJson<LeaderboardResponse>(
            `/api/basho/${currentBasho.id}/leaderboard`,
          );

          if (!isCurrent) {
            return;
          }

          setLeaderboard(leaderboardResponse.leaderboard);
          setExpandedTeamId(leaderboardResponse.leaderboard[0]?.teamId ?? null);
          setLeaderboardErrorMessage(null);
        } catch (error) {
          if (!isCurrent) {
            return;
          }

          setLeaderboard([]);
          setExpandedTeamId(null);
          setLeaderboardErrorMessage(getErrorMessage(error));
        }
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        setErrorMessage(getErrorMessage(error));
        setLoadState("error");
      }
    }

    void loadBasho();

    return () => {
      isCurrent = false;
    };
  }, []);

  const selectedRikishi = useMemo(
    () =>
      selectedIds
        .map((id) => rikishi.find((entry) => entry.id === id))
        .filter((entry): entry is RankedRikishi => entry !== undefined),
    [rikishi, selectedIds],
  );
  const teamSize = basho?.teamSize ?? 0;
  const canSubmit =
    loadState === "ready" &&
    submitState === "idle" &&
    displayName.trim().length > 0 &&
    selectedIds.length === teamSize;

  function toggleRikishi(rikishiId: string) {
    setErrorMessage(null);
    setCreatedTeam(null);
    setSelectedIds((current) => {
      if (current.includes(rikishiId)) {
        return current.filter((id) => id !== rikishiId);
      }

      if (current.length >= teamSize) {
        return current;
      }

      return [...current, rikishiId];
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (basho === null || !canSubmit) {
      return;
    }

    setSubmitState("submitting");
    setErrorMessage(null);
    setLeaderboardErrorMessage(null);
    setCreatedTeam(null);

    try {
      const response = await postJson<CreatedTeamResponse>(
        `/api/basho/${basho.id}/teams`,
        {
          displayName: displayName.trim(),
          rikishiIds: selectedIds,
        },
      );

      setCreatedTeam(response);

      try {
        const leaderboardResponse = await getJson<LeaderboardResponse>(
          `/api/basho/${basho.id}/leaderboard`,
        );

        setLeaderboard(leaderboardResponse.leaderboard);
        setExpandedTeamId(getExpandedTeamId(leaderboardResponse, response));
        setActiveView("leaderboard");
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitState("idle");
    }
  }

  return (
    <main className="app-shell">
      <PageHeader />

      {loadState === "loading" && (
        <section className="state-panel" aria-live="polite">
          Loading the current basho...
        </section>
      )}

      {loadState === "error" && (
        <section className="state-panel error-state" role="alert">
          {errorMessage ?? "Unable to load basho data."}
        </section>
      )}

      {loadState === "empty" && (
        <section className="state-panel">
          No rikishi are available for the current basho yet.
        </section>
      )}

      {loadState === "ready" && basho !== null && (
        <>
          <BashoPanel basho={basho} selectedCount={selectedIds.length} />
          <ViewSwitch activeView={activeView} onChange={setActiveView} />

          {activeView === "selection" && (
            <TeamSelection
              canSubmit={canSubmit}
              createdTeam={createdTeam}
              displayName={displayName}
              errorMessage={errorMessage}
              onDisplayNameChange={(nextDisplayName) => {
                setDisplayName(nextDisplayName);
                setCreatedTeam(null);
              }}
              onSubmit={handleSubmit}
              onToggleRikishi={toggleRikishi}
              rikishi={rikishi}
              selectedIds={selectedIds}
              selectedRikishi={selectedRikishi}
              submitState={submitState}
              teamSize={teamSize}
            />
          )}

          {activeView === "leaderboard" && (
            <LeaderboardPanel
              createdTeam={createdTeam}
              errorMessage={leaderboardErrorMessage}
              expandedTeamId={expandedTeamId}
              leaderboard={leaderboard}
              onToggleTeam={(teamId) =>
                setExpandedTeamId(expandedTeamId === teamId ? null : teamId)
              }
              rikishi={rikishi}
            />
          )}
        </>
      )}
    </main>
  );
}

function getExpandedTeamId(
  leaderboardResponse: LeaderboardResponse,
  createdTeam: CreatedTeamResponse,
): string | null {
  const createdTeamIsRanked = leaderboardResponse.leaderboard.some(
    (entry) => entry.teamId === createdTeam.team.id,
  );

  if (createdTeamIsRanked) {
    return createdTeam.team.id;
  }

  return leaderboardResponse.leaderboard[0]?.teamId ?? null;
}
