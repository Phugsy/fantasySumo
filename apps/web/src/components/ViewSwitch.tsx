import type { ActiveView } from "../types";

interface ViewSwitchProps {
  activeView: ActiveView;
  disabled?: boolean;
  onChange: (view: ActiveView) => void;
}

export function ViewSwitch({
  activeView,
  disabled = false,
  onChange,
}: ViewSwitchProps) {
  return (
    <nav className="view-switch" aria-label="Primary navigation">
      <button
        type="button"
        className={activeView === "selection" ? "active" : ""}
        disabled={disabled}
        onClick={() => onChange("selection")}
        aria-current={activeView === "selection" ? "page" : undefined}
      >
        Current basho
      </button>
      <button
        type="button"
        className={activeView === "leaderboard" ? "active" : ""}
        disabled={disabled}
        onClick={() => onChange("leaderboard")}
        aria-current={activeView === "leaderboard" ? "page" : undefined}
      >
        Leaderboard
      </button>
    </nav>
  );
}
