import { useMemo } from "react";
import type {
  Basho,
  CreatedTeamResponse,
  LeaderboardEntry,
  LeaderboardLoadState,
  RankedRikishi,
} from "../types";
import { getBashoLifecycleLabel } from "../lifecycle";
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
            currentDay: basho.currentDay,
            expandedTeamId,
            leaderboard,
            onToggleTeam,
            rikishiById,
            tiedScoreCounts,
            totalDays,
          })}
        </>
      ) : (
        renderLeaderboardList({
          currentDay: basho.currentDay,
          expandedTeamId,
          leaderboard,
          onToggleTeam,
          rikishiById,
          tiedScoreCounts,
          totalDays,
        })
      )}
    </section>
  );
}

function renderLeaderboardList({
  currentDay,
  expandedTeamId,
  leaderboard,
  onToggleTeam,
  rikishiById,
  tiedScoreCounts,
  totalDays,
}: {
  currentDay?: number;
  expandedTeamId: string | null;
  leaderboard: LeaderboardEntry[];
  onToggleTeam: (teamId: string) => void;
  rikishiById: Map<string, RankedRikishi>;
  tiedScoreCounts: Map<number, number>;
  totalDays?: number;
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
                <ScoreHistory
                  currentDay={currentDay}
                  rikishiById={rikishiById}
                  scoreHistory={entry.scoreHistory}
                  totalDays={totalDays}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
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

function ScoreHistory({
  currentDay,
  rikishiById,
  scoreHistory,
  totalDays,
}: {
  currentDay?: number;
  rikishiById: Map<string, RankedRikishi>;
  scoreHistory: LeaderboardEntry["scoreHistory"];
  totalDays?: number;
}) {
  const unscoredCopy = getUnscoredDaysCopy(
    scoreHistory.map((entry) => entry.day),
    currentDay,
    totalDays,
  );

  return (
    <section className="score-history" aria-label="Day-by-day score history">
      <h3>Day-by-day score</h3>
      {scoreHistory.length === 0 ? (
        <p>No scored days yet.</p>
      ) : (
        <ol>
          {[...scoreHistory].reverse().map((day) => (
            <li className="score-day" key={day.day}>
              <div className="score-day-heading">
                <strong>Day {day.day}</strong>
                <span>
                  {formatSignedScore(day.dailyScore)} today ·{" "}
                  {day.cumulativeScore} total
                </span>
              </div>
              <ul>
                {day.rikishiScores.map((score) => (
                  <li key={score.rikishiId}>
                    <span>
                      {rikishiById.get(score.rikishiId)?.shikona ??
                        score.rikishiId}
                    </span>
                    <span>{formatOutcome(score.outcome)}</span>
                    <strong>{formatSignedScore(score.score)}</strong>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {unscoredCopy.map((copy) => (
        <p className="unscored-days" key={copy}>
          {copy}
        </p>
      ))}
    </section>
  );
}

function getUnscoredDaysCopy(
  scoredDays: number[],
  currentDay = 0,
  totalDays?: number,
): string[] {
  const scoredDaySet = new Set(scoredDays);
  const latestScoredDay = scoredDays.reduce(
    (latestDay, day) => Math.max(latestDay, day),
    0,
  );
  const progressDay = Math.max(currentDay, latestScoredDay);
  const missingCurrentDays = Array.from(
    { length: progressDay },
    (_, index) => index + 1,
  ).filter((day) => !scoredDaySet.has(day));
  const copy: string[] = [];

  if (missingCurrentDays.length > 0) {
    copy.push(
      `${formatDayRange(missingCurrentDays)} ${missingCurrentDays.length === 1 ? "is" : "are"} awaiting results.`,
    );
  }

  if (totalDays !== undefined && progressDay < totalDays) {
    const futureDays = Array.from(
      { length: totalDays - progressDay },
      (_, index) => progressDay + index + 1,
    );
    copy.push(
      `${formatDayRange(futureDays)} ${futureDays.length === 1 ? "is" : "are"} not scored yet.`,
    );
  }

  return copy;
}

function formatDayRange(days: number[]): string {
  if (days.length === 1) {
    return `Day ${days[0]}`;
  }

  const isContinuous = days.every(
    (day, index) => index === 0 || day === days[index - 1]! + 1,
  );

  if (isContinuous) {
    return `Days ${days[0]}–${days.at(-1)}`;
  }

  return `Days ${days.join(", ")}`;
}

function formatSignedScore(score: number): string {
  return score > 0 ? `+${score}` : `${score}`;
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
