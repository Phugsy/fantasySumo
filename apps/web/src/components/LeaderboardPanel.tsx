import { useMemo } from "react";
import type {
  Basho,
  CreatedTeamResponse,
  LeaderboardEntry,
  LeaderboardLoadState,
  RankedRikishi,
} from "../types";
import { getBashoLifecycleLabel } from "../lifecycle";

interface LeaderboardPanelProps {
  basho: Basho;
  createdTeam: CreatedTeamResponse | null;
  errorMessage: string | null;
  expandedTeamId: string | null;
  leaderboard: LeaderboardEntry[];
  loadState: LeaderboardLoadState;
  onToggleTeam: (teamId: string) => void;
  rikishi: RankedRikishi[];
  totalDays?: number;
}

export function LeaderboardPanel({
  basho,
  createdTeam,
  errorMessage,
  expandedTeamId,
  leaderboard,
  loadState,
  onToggleTeam,
  rikishi,
  totalDays,
}: LeaderboardPanelProps) {
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

  return (
    <section className="leaderboard-section" aria-labelledby="standings-title">
      <div className="section-heading">
        <p className="eyebrow">Standings</p>
        <h2 id="standings-title">Leaderboard</h2>
      </div>
      <div className="leaderboard-context" aria-label="Basho status">
        <strong>{formatBashoHeadline(basho, totalDays)}</strong>
        <span>{getLeaderboardStatusCopy(basho)}</span>
      </div>

      {errorMessage !== null && (
        <p className="form-message error-state" role="alert">
          {errorMessage}
        </p>
      )}

      {createdTeam !== null && (
        <div className="confirmation" role="status">
          <strong>{createdTeam.team.displayName} submitted.</strong>
          <span>
            {createdTeam.picks.length} rikishi selected for this basho.
          </span>
        </div>
      )}

      {loadState === "loading" ? (
        <div className="state-panel leaderboard-empty" aria-live="polite">
          Loading leaderboard...
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="state-panel leaderboard-empty">
          {getEmptyLeaderboardMessage(basho)}
        </div>
      ) : isPreScoringLeaderboard(basho, leaderboard) ? (
        <>
          <div className="state-panel leaderboard-empty">
            {getEmptyScoringMessage(basho)}
          </div>
          {renderLeaderboardList({
            expandedTeamId,
            leaderboard,
            onToggleTeam,
            rikishiById,
            tiedScoreCounts,
          })}
        </>
      ) : (
        renderLeaderboardList({
          expandedTeamId,
          leaderboard,
          onToggleTeam,
          rikishiById,
          tiedScoreCounts,
        })
      )}
    </section>
  );
}

function renderLeaderboardList({
  expandedTeamId,
  leaderboard,
  onToggleTeam,
  rikishiById,
  tiedScoreCounts,
}: {
  expandedTeamId: string | null;
  leaderboard: LeaderboardEntry[];
  onToggleTeam: (teamId: string) => void;
  rikishiById: Map<string, RankedRikishi>;
  tiedScoreCounts: Map<number, number>;
}) {
  return (
    <ol className="leaderboard-list">
      {leaderboard.map((entry) => {
        const isTied = (tiedScoreCounts.get(entry.score) ?? 0) > 1;
        const isExpanded = expandedTeamId === entry.teamId;

        return (
          <li className="leaderboard-entry" key={entry.teamId}>
            <button
              type="button"
              className="leaderboard-summary"
              onClick={() => onToggleTeam(entry.teamId)}
              aria-expanded={isExpanded}
            >
              <span className="leaderboard-rank">#{entry.rank}</span>
              <span className="leaderboard-team">
                <strong>{entry.displayName}</strong>
                {isTied && <small>Tied on score</small>}
              </span>
              <span className="leaderboard-score">{entry.score} pts</span>
            </button>

            {isExpanded && (
              <div className="score-breakdown">
                {entry.rikishiScores.length === 0 ? (
                  <p>No picks recorded for this team.</p>
                ) : (
                  <ul>
                    {entry.rikishiScores.map((score) => {
                      const pickedRikishi = rikishiById.get(score.rikishiId);

                      return (
                        <li key={score.rikishiId}>
                          <span>
                            <strong>
                              {pickedRikishi?.shikona ?? score.rikishiId}
                            </strong>
                            <small>
                              {pickedRikishi?.rank ?? "Unranked pick"}
                            </small>
                          </span>
                          <span>
                            {score.wins} win{score.wins === 1 ? "" : "s"}
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
  );
}

function formatBashoHeadline(basho: Basho, totalDays?: number): string {
  const dayCopy = formatDayCopy(basho.currentDay, totalDays);

  if (basho.status === "locked") {
    return `${basho.name} - Picks locked, starts soon`;
  }

  if (basho.status === "complete") {
    return `${basho.name} - Complete, final leaderboard`;
  }

  return dayCopy === undefined ? basho.name : `${basho.name} - ${dayCopy}`;
}

function formatDayCopy(
  currentDay?: number,
  totalDays?: number,
): string | undefined {
  if (currentDay === undefined || currentDay <= 0) {
    return undefined;
  }

  if (totalDays === undefined) {
    return `Day ${currentDay}`;
  }

  return `Day ${currentDay} of ${totalDays}`;
}

function getLeaderboardStatusCopy(basho: Basho): string {
  return `Status: ${getBashoLifecycleLabel(basho.status)}`;
}

function getEmptyLeaderboardMessage(basho: Basho): string {
  if (basho.status === "upcoming") {
    return "No teams have joined this basho yet. Picks are still open.";
  }

  if (basho.status === "locked") {
    return "No teams joined before picks locked.";
  }

  return "No teams are available for this leaderboard.";
}

function getEmptyScoringMessage(basho: Basho): string {
  if (basho.status === "locked") {
    return "Picks are locked. Day 1 results have not been scored yet.";
  }

  if (basho.status === "active") {
    return "This basho is active, but no results have been scored yet.";
  }

  return "Scores will appear once results are imported.";
}

function isPreScoringLeaderboard(
  basho: Basho,
  leaderboard: LeaderboardEntry[],
): boolean {
  return (
    leaderboard.length > 0 &&
    (basho.currentDay ?? 0) === 0 &&
    leaderboard.every((entry) => entry.score === 0) &&
    (basho.status === "locked" || basho.status === "active")
  );
}
