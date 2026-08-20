import type { RikishiTournamentNotes } from "../types";
import "./RikishiTournamentBadges.css";

interface RikishiTournamentBadgesProps {
  notes?: RikishiTournamentNotes;
  shikona: string;
}

export function RikishiTournamentBadges({
  notes,
  shikona,
}: RikishiTournamentBadgesProps) {
  const availableNotes = notes ?? { statuses: [], achievements: [] };
  const badges = [
    ...availableNotes.statuses.map((status) => ({
      key: `status-${status.type}`,
      type: status.type,
      label: formatStatusLabel(status.type),
      day: status.effectiveDay,
      explanation: formatStatusExplanation(
        shikona,
        status.type,
        status.effectiveDay,
        status.provenance,
      ),
      provenance: status.provenance,
    })),
    ...availableNotes.achievements.map((achievement) => ({
      key: `achievement-${achievement.type}-${achievement.day}`,
      type: achievement.type,
      label: formatAchievementLabel(achievement.type),
      day: achievement.day,
      explanation: formatAchievementExplanation(
        shikona,
        achievement.type,
        achievement.day,
      ),
      provenance: achievement.provenance,
    })),
  ];

  if (badges.length === 0) {
    return null;
  }

  return (
    <span
      className="rikishi-tournament-notes"
      role="group"
      aria-label={`${shikona} tournament status and achievements`}
    >
      {badges.map((badge) => (
        <span
          className={`rikishi-note-badge note-${badge.type}`}
          key={badge.key}
          aria-label={badge.explanation}
          title={badge.explanation}
        >
          <strong>{badge.label}</strong>
          <small>
            Day {badge.day} · {formatProvenance(badge.provenance)}
          </small>
        </span>
      ))}
    </span>
  );
}

function formatStatusLabel(
  type: RikishiTournamentNotes["statuses"][number]["type"],
): string {
  switch (type) {
    case "withdrawn":
      return "Withdrawn";
    case "returned":
      return "Returned";
  }
}

function formatAchievementLabel(
  type: RikishiTournamentNotes["achievements"][number]["type"],
): string {
  switch (type) {
    case "kachi-koshi":
      return "Kachi-koshi";
    case "make-koshi":
      return "Make-koshi";
    case "gold-star":
      return "Gold star";
  }
}

function formatStatusExplanation(
  shikona: string,
  type: RikishiTournamentNotes["statuses"][number]["type"],
  day: number,
  provenance: RikishiTournamentNotes["statuses"][number]["provenance"],
): string {
  const source =
    provenance === "source"
      ? "reported by the published tournament data"
      : "derived from later recorded results";

  return type === "withdrawn"
    ? `${shikona} is withdrawn from day ${day}; ${source}.`
    : `${shikona} returned on day ${day}; ${source}.`;
}

function formatAchievementExplanation(
  shikona: string,
  type: RikishiTournamentNotes["achievements"][number]["type"],
  day: number,
): string {
  switch (type) {
    case "kachi-koshi":
      return `${shikona} secured a winning record on day ${day}, derived from recorded results.`;
    case "make-koshi":
      return `${shikona} secured a losing record on day ${day}, derived from recorded results.`;
    case "gold-star":
      return `${shikona} recorded a gold-star win over a yokozuna on day ${day}, derived from the banzuke and recorded result.`;
  }
}

function formatProvenance(
  provenance: RikishiTournamentNotes["statuses"][number]["provenance"],
): string {
  return provenance === "source" ? "source report" : "derived";
}
