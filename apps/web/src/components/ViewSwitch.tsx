import { NavLink } from "react-router";
import { appPaths } from "../routing";
import type { SessionUser } from "../types";
import "./ViewSwitch.css";

interface ViewSwitchProps {
  sessionState: "loading" | "ready" | "submitting";
  showAdmin?: boolean;
  showTeam?: boolean;
  user: SessionUser | null;
}

export function ViewSwitch({
  sessionState,
  showAdmin = false,
  showTeam = false,
  user,
}: ViewSwitchProps) {
  return (
    <nav className="view-switch" aria-label="Primary navigation">
      <NavLink to={appPaths.home} end>
        Leaderboard
      </NavLink>
      {sessionState === "loading" ? (
        <span className="session-check">Checking session...</span>
      ) : user === null ? (
        <NavLink to={appPaths.login}>Log in / Join</NavLink>
      ) : (
        <>
          <NavLink to={appPaths.stable}>My stable</NavLink>
          {showTeam && <NavLink to={appPaths.team}>Team picks</NavLink>}
          {showAdmin && <NavLink to={appPaths.admin}>Admin</NavLink>}
        </>
      )}
    </nav>
  );
}
