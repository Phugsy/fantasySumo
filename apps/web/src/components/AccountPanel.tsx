import type { FormEvent } from "react";
import type { SessionResponse, SessionUser } from "../types";

interface AccountPanelProps {
  email: string;
  errorMessage: string | null;
  mode: SessionResponse["mode"] | null;
  onDisplayNameChange: (displayName: string) => void;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onSignIn: (event: FormEvent<HTMLFormElement>) => void;
  onSignOut: () => void;
  onSignUp: () => void;
  password: string;
  sessionState: "loading" | "ready" | "submitting";
  user: SessionUser | null;
  userDisplayName: string;
}

export function AccountPanel({
  email,
  errorMessage,
  mode,
  onDisplayNameChange,
  onEmailChange,
  onPasswordChange,
  onSignIn,
  onSignOut,
  onSignUp,
  password,
  sessionState,
  user,
  userDisplayName,
}: AccountPanelProps) {
  const isNeonMode = mode === "neon";
  const canSignIn =
    sessionState !== "submitting" &&
    email.trim().length > 0 &&
    (isNeonMode ? password.length > 0 : userDisplayName.trim().length > 0);
  const canSignUp =
    isNeonMode &&
    sessionState !== "submitting" &&
    email.trim().length > 0 &&
    userDisplayName.trim().length > 0 &&
    password.length > 0;

  return (
    <section className="account-panel" aria-labelledby="account-title">
      <div>
        <p className="eyebrow">Account</p>
        <h2 id="account-title">Player session</h2>
      </div>

      {sessionState === "loading" ? (
        <p className="form-message" aria-live="polite">
          Checking your session...
        </p>
      ) : user === null ? (
        <form className="account-form" onSubmit={onSignIn}>
          <label className="field-label" htmlFor="account-email">
            Email
          </label>
          <input
            id="account-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="you@example.com"
          />

          <label className="field-label" htmlFor="account-display-name">
            Display name
          </label>
          <input
            id="account-display-name"
            name="displayName"
            value={userDisplayName}
            onChange={(event) => onDisplayNameChange(event.target.value)}
            placeholder="East Stand"
          />

          {isNeonMode && (
            <>
              <label className="field-label" htmlFor="account-password">
                Password
              </label>
              <input
                aria-describedby="account-password-hint"
                id="account-password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="Password"
              />
              <p className="field-hint" id="account-password-hint">
                Use at least 8 characters and avoid common passwords.
              </p>
            </>
          )}

          <button className="submit-button" disabled={!canSignIn} type="submit">
            {sessionState === "submitting" ? "Signing in..." : "Sign in"}
          </button>
          {isNeonMode && (
            <button
              className="secondary-button"
              disabled={!canSignUp}
              type="button"
              onClick={onSignUp}
            >
              Create account
            </button>
          )}
        </form>
      ) : (
        <div className="account-summary">
          <div>
            <strong>{user.displayName ?? user.email ?? "Signed in"}</strong>
            {user.email !== undefined && <span>{user.email}</span>}
          </div>
          <button type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      )}

      {errorMessage !== null && (
        <p className="form-message error-state" role="alert">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
