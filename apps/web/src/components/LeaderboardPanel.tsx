import { useMemo } from "react";
import type {
  CreatedTeamResponse,
  LeaderboardEntry,
  LeaderboardLoadState,
  RankedRikishi,
} from "../types";

interface LeaderboardPanelProps {
  createdTeam: CreatedTeamResponse | null;
  errorMessage: string | null;
  expandedTeamId: string | null;
  leaderboard: LeaderboardEntry[];
  loadState: LeaderboardLoadState;
  onToggleTeam: (teamId: string) => void;
  rikishi: RankedRikishi[];
}

export function LeaderboardPanel({
  createdTeam,
  errorMessage,
  expandedTeamId,
  leaderboard,
  loadState,
  onToggleTeam,
  rikishi,
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
                          const pickedRikishi = rikishiById.get(
                            score.rikishiId,
                          );

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
      )}
    </section>
  );
}
