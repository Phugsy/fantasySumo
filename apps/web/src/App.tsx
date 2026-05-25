import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

interface Basho {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "upcoming" | "active" | "complete";
  teamSize: number;
}

interface RankedRikishi {
  id: string;
  shikona: string;
  heya?: string;
  rank: string;
  rankOrder: number;
}

interface BashoRikishiResponse {
  basho: Omit<Basho, "teamSize">;
  rikishi: RankedRikishi[];
}

interface CreatedTeamResponse {
  team: {
    id: string;
    displayName: string;
  };
  picks: Array<{
    rikishiId: string;
  }>;
}

interface LeaderboardResponse {
  bashoId: string;
  leaderboard: LeaderboardEntry[];
}

interface LeaderboardEntry {
  rank: number;
  teamId: string;
  displayName: string;
  score: number;
  rikishiScores: RikishiScore[];
}

interface RikishiScore {
  rikishiId: string;
  wins: number;
  score: number;
}

interface ApiErrorBody {
  message?: string;
  details?: Array<{
    message?: string;
  }>;
}

type LoadState = "loading" | "ready" | "empty" | "error";
type ActiveView = "selection" | "leaderboard";

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
        const leaderboardResponse = await getJson<LeaderboardResponse>(
          `/api/basho/${currentBasho.id}/leaderboard`,
        );

        if (!isCurrent) {
          return;
        }

        setBasho({
          ...bashoRikishi.basho,
          teamSize: currentBasho.teamSize,
        });
        setRikishi(bashoRikishi.rikishi);
        setLeaderboard(leaderboardResponse.leaderboard);
        setExpandedTeamId(leaderboardResponse.leaderboard[0]?.teamId ?? null);
        setLoadState(bashoRikishi.rikishi.length === 0 ? "empty" : "ready");
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
  const rikishiById = useMemo(
    () => new Map(rikishi.map((entry) => [entry.id, entry])),
    [rikishi],
  );
  const tiedScoreCounts = useMemo(() => {
    const scoreCounts = new Map<number, number>();

    for (const entry of leaderboard) {
      scoreCounts.set(entry.score, (scoreCounts.get(entry.score) ?? 0) + 1);
    }

    return scoreCounts;
  }, [leaderboard]);
  const teamSize = basho?.teamSize ?? 0;
  const picksRemaining = Math.max(teamSize - selectedIds.length, 0);
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
      setActiveView("leaderboard");
      const leaderboardResponse = await getJson<LeaderboardResponse>(
        `/api/basho/${basho.id}/leaderboard`,
      );
      setLeaderboard(leaderboardResponse.leaderboard);
      setExpandedTeamId(
        leaderboardResponse.leaderboard.some(
          (entry) => entry.teamId === response.team.id,
        )
          ? response.team.id
          : (leaderboardResponse.leaderboard[0]?.teamId ?? null),
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitState("idle");
    }
  }

  return (
    <main className="app-shell">
      <section className="page-header" aria-labelledby="page-title">
        <p className="eyebrow">Fantasy Sumo</p>
        <div>
          <h1 id="page-title">Build your basho team</h1>
          <p className="lede">
            Pick rikishi from the current banzuke and enter a team name to join
            the local leaderboard.
          </p>
        </div>
      </section>

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
          <section className="basho-panel" aria-labelledby="basho-title">
            <div className="section-heading">
              <p className="eyebrow">Current basho</p>
              <h2 id="basho-title">{basho.name}</h2>
            </div>
            <p className="basho-dates">
              {formatDate(basho.startDate)} to {formatDate(basho.endDate)}
            </p>
            <div className="progress-wrap" aria-label="Pick progress">
              <span>
                {selectedIds.length} of {teamSize} selected
              </span>
              <strong>
                {picksRemaining === 0
                  ? "Team full"
                  : `${picksRemaining} pick${picksRemaining === 1 ? "" : "s"} left`}
              </strong>
            </div>
          </section>

          <div className="view-switch" aria-label="View switcher">
            <button
              type="button"
              className={activeView === "selection" ? "active" : ""}
              onClick={() => setActiveView("selection")}
            >
              Team selection
            </button>
            <button
              type="button"
              className={activeView === "leaderboard" ? "active" : ""}
              onClick={() => setActiveView("leaderboard")}
            >
              Leaderboard
            </button>
          </div>

          {activeView === "selection" && (
            <form className="selection-layout" onSubmit={handleSubmit}>
              <section
                className="rikishi-section"
                aria-labelledby="rikishi-title"
              >
                <div className="section-heading">
                  <p className="eyebrow">Banzuke</p>
                  <h2 id="rikishi-title">Choose rikishi</h2>
                </div>
                <div className="rikishi-list">
                  {rikishi.map((entry) => {
                    const isSelected = selectedIds.includes(entry.id);
                    const isDisabled =
                      !isSelected && selectedIds.length >= teamSize;

                    return (
                      <button
                        className="rikishi-row"
                        disabled={isDisabled}
                        key={entry.id}
                        onClick={() => toggleRikishi(entry.id)}
                        type="button"
                        aria-pressed={isSelected}
                      >
                        <span className="rank-pill">{entry.rank}</span>
                        <span>
                          <strong>{entry.shikona}</strong>
                          {entry.heya !== undefined && (
                            <small>{entry.heya}</small>
                          )}
                        </span>
                        <span
                          className={
                            isSelected ? "pick-mark selected" : "pick-mark"
                          }
                        >
                          {isSelected ? "Selected" : "Pick"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <aside className="summary-panel" aria-labelledby="summary-title">
                <div className="section-heading">
                  <p className="eyebrow">Your team</p>
                  <h2 id="summary-title">Selection</h2>
                </div>

                <label className="field-label" htmlFor="displayName">
                  Team name
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  value={displayName}
                  onChange={(event) => {
                    setDisplayName(event.target.value);
                    setCreatedTeam(null);
                  }}
                  placeholder="East Stand Heroes"
                />

                <ol className="selected-list" aria-label="Selected rikishi">
                  {selectedRikishi.map((entry) => (
                    <li key={entry.id}>
                      <span>{entry.shikona}</span>
                      <button
                        type="button"
                        onClick={() => toggleRikishi(entry.id)}
                        aria-label={`Remove ${entry.shikona}`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                  {Array.from({ length: picksRemaining }).map((_, index) => (
                    <li className="empty-pick" key={`empty-${index}`}>
                      Pick slot
                    </li>
                  ))}
                </ol>

                <button
                  className="submit-button"
                  disabled={!canSubmit}
                  type="submit"
                >
                  {submitState === "submitting"
                    ? "Submitting..."
                    : "Submit team"}
                </button>

                {errorMessage !== null && (
                  <p className="form-message error-state" role="alert">
                    {errorMessage}
                  </p>
                )}
              </aside>
            </form>
          )}

          {activeView === "leaderboard" && (
            <section
              className="leaderboard-section"
              aria-labelledby="standings-title"
            >
              <div className="section-heading">
                <p className="eyebrow">Standings</p>
                <h2 id="standings-title">Leaderboard</h2>
              </div>

              {createdTeam !== null && (
                <div className="confirmation" role="status">
                  <strong>{createdTeam.team.displayName} submitted.</strong>
                  <span>
                    {createdTeam.picks.length} rikishi selected for this basho.
                  </span>
                </div>
              )}

              {leaderboard.length === 0 ? (
                <div className="state-panel leaderboard-empty">
                  No teams have joined this basho yet.
                </div>
              ) : (
                <ol className="leaderboard-list">
                  {leaderboard.map((entry) => {
                    const isTied = (tiedScoreCounts.get(entry.score) ?? 0) > 1;
                    const isExpanded = expandedTeamId === entry.teamId;

                    return (
                      <li className="leaderboard-entry" key={entry.teamId}>
                        <button
                          type="button"
                          className="leaderboard-summary"
                          onClick={() =>
                            setExpandedTeamId(isExpanded ? null : entry.teamId)
                          }
                          aria-expanded={isExpanded}
                        >
                          <span className="leaderboard-rank">
                            #{entry.rank}
                          </span>
                          <span className="leaderboard-team">
                            <strong>{entry.displayName}</strong>
                            {isTied && <small>Tied on score</small>}
                          </span>
                          <span className="leaderboard-score">
                            {entry.score} pts
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="score-breakdown">
                            {entry.rikishiScores.length === 0 ? (
                              <p>No picks recorded for this team.</p>
                            ) : (
                              <ul>
                                {entry.rikishiScores.map((score) => {
                                  const pickedRikishi = rikishiById.get(
                                    score.rikishiId,
                                  );

                                  return (
                                    <li key={score.rikishiId}>
                                      <span>
                                        <strong>
                                          {pickedRikishi?.shikona ??
                                            score.rikishiId}
                                        </strong>
                                        <small>
                                          {pickedRikishi?.rank ??
                                            "Unranked pick"}
                                        </small>
                                      </span>
                                      <span>
                                        {score.wins} win
                                        {score.wins === 1 ? "" : "s"}
                                      </span>
                                      <span>{score.score} pts</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.json() as Promise<T>;
}

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    const details = body.details
      ?.map((detail) => detail.message)
      .filter((message): message is string => message !== undefined);

    if (details !== undefined && details.length > 0) {
      return `${body.message ?? "Request failed"} ${details.join(" ")}`;
    }

    return body.message ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (match === null) {
    return value;
  }

  const [, year, month, day] = match;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(Number(year), Number(month) - 1, Number(day)));
}
