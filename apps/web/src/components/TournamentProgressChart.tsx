import { useMemo, useRef, useState } from "react";
import type { LeaderboardEntry } from "../types";
import { DailyScoreBadge } from "./DailyScoreBadge";
import "./TournamentProgressChart.css";

interface TournamentProgressChartProps {
  currentTeamId?: string;
  leaderboard: LeaderboardEntry[];
}

type SelectedPoint = {
  day: number;
  teamId: string;
};

const chartWidth = 800;
const chartHeight = 340;
const chartPadding = { top: 32, right: 28, bottom: 48, left: 52 };
const seriesColors = [
  "#a84032",
  "#183247",
  "#2f6f5e",
  "#8b5b16",
  "#654c8a",
  "#26758a",
] as const;

export function TournamentProgressChart({
  currentTeamId,
  leaderboard,
}: TournamentProgressChartProps) {
  const [hiddenTeamIds, setHiddenTeamIds] = useState<Set<string>>(new Set());
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(
    null,
  );
  const pointRefs = useRef<Map<string, SVGGElement>>(new Map());
  const scoredEntries = useMemo(
    () => leaderboard.filter((entry) => entry.scoreHistory.length > 0),
    [leaderboard],
  );
  const visibleEntries = scoredEntries.filter(
    (entry) => !hiddenTeamIds.has(entry.teamId),
  );
  const visiblePoints = visibleEntries.flatMap((entry) =>
    entry.scoreHistory.map((history) => ({
      day: history.day,
      teamId: entry.teamId,
    })),
  );
  const scoredDays = useMemo(
    () =>
      Array.from(
        new Set(
          scoredEntries.flatMap((entry) =>
            entry.scoreHistory.map((history) => history.day),
          ),
        ),
      ).sort((left, right) => left - right),
    [scoredEntries],
  );

  if (scoredEntries.length === 0) {
    return (
      <section
        className="progress-chart progress-chart-empty"
        aria-labelledby="progress-title"
      >
        <div>
          <p className="eyebrow">Tournament story</p>
          <h3 id="progress-title">Score progress</h3>
        </div>
        <p>No scored days yet. Progress will appear after the first results.</p>
      </section>
    );
  }

  const latestDay = scoredDays.at(-1) ?? 1;
  const maximumScore = Math.max(
    1,
    ...scoredEntries.flatMap((entry) =>
      entry.scoreHistory.map((history) => history.cumulativeScore),
    ),
  );
  const yTicks = createScoreTicks(maximumScore);
  const activePoint =
    resolveSelectedPoint(selectedPoint, visibleEntries) ??
    getDefaultPoint(visibleEntries, latestDay);
  const activeEntry = visibleEntries.find(
    (entry) => entry.teamId === activePoint?.teamId,
  );
  const activeHistory = activeEntry?.scoreHistory.find(
    (history) => history.day === activePoint?.day,
  );

  function toggleTeam(teamId: string) {
    setHiddenTeamIds((current) => {
      const next = new Set(current);

      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }

      return next;
    });
  }

  function movePointSelection(
    currentPoint: SelectedPoint,
    key: "ArrowDown" | "ArrowLeft" | "ArrowRight" | "ArrowUp" | "End" | "Home",
  ) {
    const currentIndex = visiblePoints.findIndex(
      (point) =>
        point.teamId === currentPoint.teamId && point.day === currentPoint.day,
    );
    if (currentIndex === -1 || visiblePoints.length === 0) {
      return;
    }

    const nextIndex =
      key === "Home"
        ? 0
        : key === "End"
          ? visiblePoints.length - 1
          : key === "ArrowLeft" || key === "ArrowUp"
            ? (currentIndex - 1 + visiblePoints.length) % visiblePoints.length
            : (currentIndex + 1) % visiblePoints.length;
    const nextPoint = visiblePoints[nextIndex]!;
    setSelectedPoint(nextPoint);
    pointRefs.current.get(getPointKey(nextPoint))?.focus();
  }

  return (
    <section className="progress-chart" aria-labelledby="progress-title">
      <div className="progress-chart-heading">
        <div>
          <p className="eyebrow">Tournament story</p>
          <h3 id="progress-title">Score progress</h3>
        </div>
        <span className="latest-day-badge">Latest: Day {latestDay}</span>
      </div>
      <p className="progress-chart-intro">
        Cumulative points by scored day. Select teams to separate overlapping
        lines.
      </p>

      <div className="progress-chart-filters" aria-label="Teams shown on chart">
        {scoredEntries.map((entry, index) => {
          const isVisible = !hiddenTeamIds.has(entry.teamId);
          const style = getSeriesStyle(index);
          const teamLabel = formatTeamLabel(entry);

          return (
            <button
              type="button"
              aria-pressed={isVisible}
              aria-label={
                entry.teamId === currentTeamId
                  ? `${teamLabel}, your team`
                  : teamLabel
              }
              className={
                entry.teamId === currentTeamId ? "current-team" : undefined
              }
              key={entry.teamId}
              onClick={() => toggleTeam(entry.teamId)}
            >
              <svg
                className="series-swatch"
                viewBox="0 0 28 6"
                aria-hidden="true"
              >
                <line
                  x1="1"
                  x2="27"
                  y1="3"
                  y2="3"
                  stroke={style.color}
                  strokeDasharray={style.dash}
                  strokeOpacity={isVisible ? 1 : 0.3}
                  strokeWidth="3"
                />
              </svg>
              {teamLabel}
              {entry.teamId === currentTeamId && <small>Your team</small>}
            </button>
          );
        })}
        {hiddenTeamIds.size > 0 && (
          <button
            type="button"
            className="show-all-teams"
            onClick={() => setHiddenTeamIds(new Set())}
          >
            Show all
          </button>
        )}
      </div>

      {visibleEntries.length === 0 ? (
        <p className="progress-chart-no-selection" role="status">
          Choose at least one team above to show its progress.
        </p>
      ) : (
        <>
          <div
            className="progress-chart-scroll"
            tabIndex={0}
            aria-label="Scrollable score progress chart"
          >
            <svg
              className="progress-chart-plot"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              role="group"
              aria-labelledby="progress-svg-title progress-svg-description"
            >
              <title id="progress-svg-title">
                Cumulative fantasy score progress
              </title>
              <desc id="progress-svg-description">
                {visibleEntries.length} team
                {visibleEntries.length === 1 ? "" : "s"} shown through day{" "}
                {latestDay}. Tab into the selected point, then use the arrow
                keys for exact daily and cumulative scores.
              </desc>

              {yTicks.map((tick) => {
                const y = scoreToY(tick, maximumScore);
                return (
                  <g key={tick} aria-hidden="true">
                    <line
                      className="chart-grid-line"
                      x1={chartPadding.left}
                      x2={chartWidth - chartPadding.right}
                      y1={y}
                      y2={y}
                    />
                    <text
                      className="chart-axis-label"
                      x={chartPadding.left - 12}
                      y={y + 4}
                      textAnchor="end"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {scoredDays.map((day) => {
                const x = dayToX(day, latestDay);
                return (
                  <g key={day} aria-hidden="true">
                    <line
                      className={
                        day === latestDay
                          ? "chart-latest-line"
                          : "chart-day-tick"
                      }
                      x1={x}
                      x2={x}
                      y1={chartPadding.top}
                      y2={chartHeight - chartPadding.bottom}
                    />
                    <text
                      className="chart-axis-label"
                      x={x}
                      y={chartHeight - 20}
                      textAnchor="middle"
                    >
                      D{day}
                    </text>
                  </g>
                );
              })}

              <text
                className="chart-axis-title"
                x={18}
                y={chartHeight / 2}
                textAnchor="middle"
                transform={`rotate(-90 18 ${chartHeight / 2})`}
              >
                Cumulative points
              </text>
              <text
                className="chart-axis-title"
                x={chartWidth / 2}
                y={chartHeight - 2}
                textAnchor="middle"
              >
                Basho day
              </text>

              {visibleEntries.map((entry) => {
                const originalIndex = scoredEntries.findIndex(
                  (candidate) => candidate.teamId === entry.teamId,
                );
                const style = getSeriesStyle(originalIndex);
                const isCurrentTeam = entry.teamId === currentTeamId;
                const points = entry.scoreHistory
                  .map(
                    (history) =>
                      `${dayToX(history.day, latestDay)},${scoreToY(history.cumulativeScore, maximumScore)}`,
                  )
                  .join(" ");

                return (
                  <g key={entry.teamId}>
                    {entry.scoreHistory.length > 1 && (
                      <polyline
                        className={
                          isCurrentTeam
                            ? "chart-series current-team"
                            : "chart-series"
                        }
                        fill="none"
                        points={points}
                        stroke={style.color}
                        strokeDasharray={style.dash}
                      />
                    )}
                    {entry.scoreHistory.map((history) => {
                      const isActive =
                        activePoint?.teamId === entry.teamId &&
                        activePoint.day === history.day;
                      const point = {
                        teamId: entry.teamId,
                        day: history.day,
                      };
                      const label = `${formatTeamLabel(entry)}, day ${history.day}: ${formatSignedScore(history.dailyScore)} that day, ${history.cumulativeScore} cumulative points`;

                      return (
                        <g
                          className="chart-point-target"
                          key={history.day}
                          role="button"
                          tabIndex={isActive ? 0 : -1}
                          aria-label={label}
                          ref={(element) => {
                            const key = getPointKey(point);
                            if (element === null) {
                              pointRefs.current.delete(key);
                            } else {
                              pointRefs.current.set(key, element);
                            }
                          }}
                          onClick={() =>
                            setSelectedPoint({
                              teamId: entry.teamId,
                              day: history.day,
                            })
                          }
                          onFocus={() =>
                            setSelectedPoint({
                              teamId: entry.teamId,
                              day: history.day,
                            })
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedPoint(point);
                            } else if (
                              event.key === "ArrowDown" ||
                              event.key === "ArrowLeft" ||
                              event.key === "ArrowRight" ||
                              event.key === "ArrowUp" ||
                              event.key === "End" ||
                              event.key === "Home"
                            ) {
                              event.preventDefault();
                              movePointSelection(point, event.key);
                            }
                          }}
                          onMouseEnter={() =>
                            setSelectedPoint({
                              teamId: entry.teamId,
                              day: history.day,
                            })
                          }
                        >
                          <circle
                            className="chart-point-hit"
                            cx={dayToX(history.day, latestDay)}
                            cy={scoreToY(history.cumulativeScore, maximumScore)}
                            r={16}
                          />
                          <circle
                            className="chart-point-focus-ring"
                            cx={dayToX(history.day, latestDay)}
                            cy={scoreToY(history.cumulativeScore, maximumScore)}
                            r={isCurrentTeam ? 12 : 11}
                          />
                          <circle
                            className={
                              isActive ? "chart-point active" : "chart-point"
                            }
                            cx={dayToX(history.day, latestDay)}
                            cy={scoreToY(history.cumulativeScore, maximumScore)}
                            fill={style.color}
                            r={isCurrentTeam ? 7 : 6}
                          />
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          </div>

          {activeEntry !== undefined && activeHistory !== undefined && (
            <p className="progress-chart-detail" aria-live="polite">
              <strong>{formatTeamLabel(activeEntry)}</strong>
              {activeEntry.teamId === currentTeamId && <span>Your team</span>}
              <span className="progress-chart-day">
                Day {activeHistory.day}
              </span>
              <span className="progress-chart-daily-score">
                <DailyScoreBadge score={activeHistory.dailyScore} /> that day
              </span>
              <span>{activeHistory.cumulativeScore} cumulative pts</span>
            </p>
          )}

          {latestDay === 1 && (
            <p className="progress-chart-note">
              One day scored so far. Lines will form as more results arrive.
            </p>
          )}
        </>
      )}

      <ScoreHistoryTable entries={scoredEntries} scoredDays={scoredDays} />
    </section>
  );
}

function ScoreHistoryTable({
  entries,
  scoredDays,
}: {
  entries: LeaderboardEntry[];
  scoredDays: number[];
}) {
  return (
    <details className="score-history-table">
      <summary>View score history table</summary>
      <div>
        <table>
          <caption>Daily and cumulative fantasy points</caption>
          <thead>
            <tr>
              <th scope="col">Team</th>
              {scoredDays.map((day) => (
                <th scope="col" key={day}>
                  Day {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.teamId}>
                <th scope="row">{formatTeamLabel(entry)}</th>
                {scoredDays.map((day) => {
                  const history = entry.scoreHistory.find(
                    (candidate) => candidate.day === day,
                  );
                  return (
                    <td key={day}>
                      {history === undefined
                        ? "—"
                        : `${formatSignedScore(history.dailyScore)} / ${history.cumulativeScore}`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function formatTeamLabel(entry: LeaderboardEntry): string {
  return `#${entry.rank} ${entry.displayName}`;
}

function getSeriesStyle(index: number): {
  color: (typeof seriesColors)[number];
  dash: string | undefined;
} {
  return {
    color: seriesColors[index % seriesColors.length]!,
    dash: index === 0 ? undefined : `${2 + (index % 5)} ${3 + index}`,
  };
}

function getPointKey(point: SelectedPoint): string {
  return `${point.teamId}:${point.day}`;
}

function resolveSelectedPoint(
  selectedPoint: SelectedPoint | null,
  visibleEntries: LeaderboardEntry[],
): SelectedPoint | null {
  if (selectedPoint === null) {
    return null;
  }

  const entry = visibleEntries.find(
    (candidate) => candidate.teamId === selectedPoint.teamId,
  );
  return entry?.scoreHistory.some(
    (history) => history.day === selectedPoint.day,
  )
    ? selectedPoint
    : null;
}

function getDefaultPoint(
  visibleEntries: LeaderboardEntry[],
  latestDay: number,
): SelectedPoint | null {
  const entry =
    visibleEntries.find((candidate) =>
      candidate.scoreHistory.some((history) => history.day === latestDay),
    ) ?? visibleEntries[0];
  const history = entry?.scoreHistory.at(-1);
  return entry === undefined || history === undefined
    ? null
    : { teamId: entry.teamId, day: history.day };
}

function createScoreTicks(maximumScore: number): number[] {
  const step = Math.max(1, Math.ceil(maximumScore / 5));
  const ticks: number[] = [];

  for (let score = 0; score <= maximumScore; score += step) {
    ticks.push(score);
  }

  if (ticks.at(-1) !== maximumScore) {
    ticks.push(maximumScore);
  }

  return ticks;
}

function dayToX(day: number, latestDay: number): number {
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  return latestDay === 1
    ? chartPadding.left + plotWidth / 2
    : chartPadding.left + ((day - 1) / (latestDay - 1)) * plotWidth;
}

function scoreToY(score: number, maximumScore: number): number {
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  return chartPadding.top + plotHeight - (score / maximumScore) * plotHeight;
}

function formatSignedScore(score: number): string {
  return score > 0 ? `+${score}` : `${score}`;
}
