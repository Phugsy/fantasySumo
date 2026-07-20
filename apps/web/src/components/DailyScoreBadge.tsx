import "./DailyScoreBadge.css";

interface DailyScoreBadgeProps {
  score: number;
}

export function DailyScoreBadge({ score }: DailyScoreBadgeProps) {
  return (
    <span className="daily-score-badge">
      {score > 0 ? `+${score}` : `${score}`}
    </span>
  );
}
