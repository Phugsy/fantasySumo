import type { ActiveView } from "../types";

interface ViewSwitchProps {
  activeView: ActiveView;
  onChange: (view: ActiveView) => void;
}

export function ViewSwitch({ activeView, onChange }: ViewSwitchProps) {
  return (
    <div className="view-switch" aria-label="View switcher">
      <button
        type="button"
        className={activeView === "selection" ? "active" : ""}
        onClick={() => onChange("selection")}
      >
        Team selection
      </button>
      <button
        type="button"
        className={activeView === "leaderboard" ? "active" : ""}
        onClick={() => onChange("leaderboard")}
      >
        Leaderboard
      </button>
    </div>
  );
}
