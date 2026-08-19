import { Link } from "react-router";
import { appPaths } from "../routing";
import type { SessionUser } from "../types";
import { ViewSwitch } from "./ViewSwitch";
import "./AppHeader.css";

interface AppHeaderProps {
  onSignOut: () => void;
  sessionState: "loading" | "ready" | "submitting";
  signOutDisabled?: boolean;
  showAdmin?: boolean;
  showTeam?: boolean;
  user: SessionUser | null;
}

export function AppHeader({
  onSignOut,
  sessionState,
  signOutDisabled = false,
  showAdmin = false,
  showTeam = false,
  user,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link className="wordmark" to={appPaths.home} aria-label="Fantasy Sumo">
          <span className="wordmark-mark" aria-hidden="true">
            相撲
          </span>
          <span className="wordmark-copy">
            <strong>Fantasy Sumo</strong>
            <small>Basho fantasy league</small>
          </span>
        </Link>
        <div className="app-header-actions">
          <ViewSwitch
            sessionState={sessionState}
            showAdmin={showAdmin}
            showTeam={showTeam}
            user={user}
          />
          {user !== null && (
            <div className="session-actions">
              <span>{user.displayName ?? user.email ?? "Signed in"}</span>
              <button
                disabled={sessionState === "submitting" || signOutDisabled}
                type="button"
                onClick={onSignOut}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
