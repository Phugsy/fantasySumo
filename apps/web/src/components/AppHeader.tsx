import type { ActiveView } from "../types";
import { ViewSwitch } from "./ViewSwitch";
import "./AppHeader.css";

interface AppHeaderProps {
  activeView: ActiveView;
  disabled?: boolean;
  onChange: (view: ActiveView) => void;
}

export function AppHeader({
  activeView,
  disabled = false,
  onChange,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="wordmark" aria-label="Fantasy Sumo">
          <span className="wordmark-mark" aria-hidden="true">
            相撲
          </span>
          <span className="wordmark-copy">
            <strong>Fantasy Sumo</strong>
            <small>Basho fantasy league</small>
          </span>
        </div>
        <ViewSwitch
          activeView={activeView}
          disabled={disabled}
          onChange={onChange}
        />
      </div>
    </header>
  );
}
