import type { ActiveView } from "../types";
import "./ViewSwitch.css";

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
        className={
          activeView === "stable" || activeView === "selection" ? "active" : ""
        }
        disabled={disabled}
        onClick={() => onChange("stable")}
        aria-current={
          activeView === "stable" || activeView === "selection"
            ? "page"
            : undefined
        }
      >
        My stable
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
