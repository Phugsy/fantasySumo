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
    })),
    ...availableNotes.achievements.map((achievement) => ({
      key: `achievement-${achievement.type}-${achievement.day}`,
      type: achievement.type,
      label: formatAchievementLabel(achievement.type),
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
        >
          <strong>{badge.label}</strong>
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
