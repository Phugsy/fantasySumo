import { useId, useMemo, useState } from "react";
import type {
  Basho,
  CreatedTeamResponse,
  LeaderboardEntry,
  LeaderboardLoadState,
  RankedRikishi,
} from "../types";
import { getBashoLifecycleLabel } from "../lifecycle";
import { TournamentProgressChart } from "./TournamentProgressChart";
import "./LeaderboardPanel.css";

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
          <TournamentProgressChart
            currentTeamId={createdTeam?.team.id}
            leaderboard={leaderboard}
          />
        </>
      ) : (
        <>
          {renderLeaderboardList({
            expandedTeamId,
            leaderboard,
            onToggleTeam,
            rikishiById,
            tiedScoreCounts,
          })}
          <TournamentProgressChart
            currentTeamId={createdTeam?.team.id}
            leaderboard={leaderboard}
          />
        </>
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
                <RecentForm scoreHistory={entry.scoreHistory} />
              </span>
              <span className="leaderboard-score">
                {entry.latestDayScore !== undefined && (
                  <small>
                    Day {entry.latestDayScore.day}{" "}
                    {formatSignedScore(entry.latestDayScore.score)}
                  </small>
                )}
                <strong>{entry.score} pts</strong>
              </span>
            </button>

            {isExpanded && (
              <div className="score-breakdown">
                <h3>Tournament totals</h3>
                {entry.rikishiScores.length === 0 ? (
                  <p>No picks recorded for this team.</p>
                ) : (
                  <ul className="score-totals-list">
                    {entry.rikishiScores.map((score) => (
                      <RikishiScoreRow
                        key={score.rikishiId}
                        pickedRikishi={rikishiById.get(score.rikishiId)}
                        results={getRikishiResults(
                          entry.scoreHistory,
                          score.rikishiId,
                        )}
                        score={score}
                      />
                    ))}
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

type RikishiResult = {
  day: number;
  outcome: LeaderboardEntry["scoreHistory"][number]["rikishiScores"][number]["outcome"];
  score: number;
};

function RikishiScoreRow({
  pickedRikishi,
  results,
  score,
}: {
  pickedRikishi?: RankedRikishi;
  results: RikishiResult[];
  score: LeaderboardEntry["rikishiScores"][number];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const historyId = useId();
  const shikona = pickedRikishi?.shikona ?? score.rikishiId;

  return (
    <li className="rikishi-score">
      <button
        type="button"
        className="rikishi-score-summary"
        onClick={() => setIsExpanded((current) => !current)}
        aria-controls={historyId}
        aria-expanded={isExpanded}
      >
        <span className="rikishi-identity">
          <strong>{shikona}</strong>
          <small>{pickedRikishi?.rank ?? "Unranked pick"}</small>
        </span>
        <RecentRikishiResults results={results} shikona={shikona} />
        <span className="rikishi-wins">
          {score.wins} win{score.wins === 1 ? "" : "s"}
        </span>
        <span className="rikishi-points">{score.score} pts</span>
      </button>
      {isExpanded && (
        <section
          className="rikishi-result-history"
          id={historyId}
          aria-label={`${shikona} result history`}
        >
          <h4>{shikona} results</h4>
          {results.length === 0 ? (
            <p>No results recorded yet.</p>
          ) : (
            <ol>
              {results.map((result) => (
                <li
                  key={result.day}
                  aria-label={`Day ${result.day}: ${formatOutcome(result.outcome)}, ${formatPoints(result.score)}`}
                >
                  <small>Day {result.day}</small>
                  <ResultTile outcome={result.outcome} />
                  <strong>{formatSignedScore(result.score)}</strong>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </li>
  );
}

function RecentRikishiResults({
  results,
  shikona,
}: {
  results: RikishiResult[];
  shikona: string;
}) {
  const recentResults = results.slice(-5);

  if (recentResults.length === 0) {
    return <span className="recent-rikishi-results" />;
  }

  return (
    <span
      className="recent-rikishi-results"
      aria-label={`Recent results for ${shikona}: ${recentResults
        .map((result) => `day ${result.day} ${formatOutcome(result.outcome)}`)
        .join(", ")}`}
    >
      {recentResults.map((result) => (
        <ResultTile key={result.day} outcome={result.outcome} />
      ))}
    </span>
  );
}

function ResultTile({ outcome }: { outcome: RikishiResult["outcome"] }) {
  return (
    <span
      className={`result-tile result-${outcome}`}
      aria-hidden="true"
      title={formatOutcome(outcome)}
    >
      {formatOutcomeInitial(outcome)}
    </span>
  );
}

function getRikishiResults(
  scoreHistory: LeaderboardEntry["scoreHistory"],
  rikishiId: string,
): RikishiResult[] {
  return scoreHistory.flatMap((day) => {
    const result = day.rikishiScores.find(
      (candidate) => candidate.rikishiId === rikishiId,
    );

    return result === undefined
      ? []
      : [{ day: day.day, outcome: result.outcome, score: result.score }];
  });
}

function RecentForm({
  scoreHistory,
}: {
  scoreHistory: LeaderboardEntry["scoreHistory"];
}) {
  const recentDays = scoreHistory.slice(-5);

  if (recentDays.length === 0) {
    return null;
  }

  return (
    <span
      className="recent-form"
      aria-label={`Recent form: ${recentDays
        .map(
          (entry) => `day ${entry.day} ${formatSignedScore(entry.dailyScore)}`,
        )
        .join(", ")}`}
    >
      {recentDays.map((entry) => (
        <span className="form-day" key={entry.day} aria-hidden="true">
          <small>D{entry.day}</small>
          <strong>{formatSignedScore(entry.dailyScore)}</strong>
        </span>
      ))}
    </span>
  );
}

function formatSignedScore(score: number): string {
  return score > 0 ? `+${score}` : `${score}`;
}

function formatPoints(score: number): string {
  return `${formatSignedScore(score)} point${Math.abs(score) === 1 ? "" : "s"}`;
}

function formatOutcome(
  outcome: LeaderboardEntry["scoreHistory"][number]["rikishiScores"][number]["outcome"],
): string {
  switch (outcome) {
    case "win":
      return "Win";
    case "loss":
      return "Loss";
    case "absent":
      return "Absent";
    case "no-result":
      return "No result";
  }
}

function formatOutcomeInitial(outcome: RikishiResult["outcome"]): string {
  switch (outcome) {
    case "win":
      return "W";
    case "loss":
      return "L";
    case "absent":
      return "A";
    case "no-result":
      return "–";
  }
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
