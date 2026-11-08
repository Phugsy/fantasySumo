import { mobileInputHeader } from "./AppHeader.mobile.css";
import { useId, useRef, useState } from "react";
import * as styles from "./AppHeaderSettings.css";
import { Link } from "react-router";
import { appPaths } from "../routing";
import type { SessionUser } from "../types";
import { ViewSwitch } from "./ViewSwitch";
import { DisplaySettings } from "./DisplaySettings";
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  return (
    <header className={`app-header ${mobileInputHeader}`}>
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
        <button
          className={styles.toggle}
          ref={toggleRef}
          type="button"
          aria-label="Site settings"
          aria-expanded={settingsOpen}
          aria-controls={settingsId}
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          <span aria-hidden="true">{settingsOpen ? "✕" : "☰"}</span>
        </button>
        <div className="app-header-actions">
          <ViewSwitch
            sessionState={sessionState}
            showAdmin={showAdmin}
            showTeam={showTeam}
            user={user}
          />
          <div
            id={settingsId}
            className={styles.settings}
            data-open={settingsOpen}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setSettingsOpen(false);
                toggleRef.current?.focus();
              }
            }}
          >
            <DisplaySettings />
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
      </div>
    </header>
  );
}
