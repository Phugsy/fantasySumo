import type {
  ScoreBreakdown as Breakdown,
  ScoringMode,
} from "@fantasy-sumo/domain";
import "./ScoreBreakdown.css";

export function ScoreBreakdown({
  breakdown,
  mode = "wins-v0",
  label = "Score categories",
}: {
  breakdown?: Breakdown;
  mode?: ScoringMode;
  label?: string;
}) {
  if (!breakdown) return null;
  const bonuses = mode === "achievements-v1";
  return (
    <div
      className="score-categories"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table>
        <caption>
          {label}
          {!bonuses && " · bonuses excluded from this total"}
        </caption>
        <thead>
          <tr>
            <th scope="col">Wins</th>
            <th scope="col">Kinboshi</th>
            <th scope="col">Eight wins</th>
            <th scope="col">Outstanding</th>
            <th scope="col">Fighting spirit</th>
            <th scope="col">Technique</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            {[
              breakdown.wins,
              breakdown.kinboshi,
              breakdown.kachiKoshi,
              breakdown.outstandingPerformance,
              breakdown.fightingSpirit,
              breakdown.technique,
            ].map((points, index) => (
              <td
                key={index}
                className={index > 0 && !bonuses ? "excluded-bonus" : undefined}
              >
                {points}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
