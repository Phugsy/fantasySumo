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
    <div className="view-switch" aria-label="View switcher">
      <button
        type="button"
        className={activeView === "selection" ? "active" : ""}
        disabled={disabled}
        onClick={() => onChange("selection")}
      >
        Team selection
      </button>
      <button
        type="button"
        className={activeView === "leaderboard" ? "active" : ""}
        disabled={disabled}
        onClick={() => onChange("leaderboard")}
      >
        Leaderboard
      </button>
    </div>
  );
}
