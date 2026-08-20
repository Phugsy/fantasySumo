import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import {
  INVALID_PASSWORD_RESET_LINK_MESSAGE,
  PASSWORD_RESET_CONFIRMATION_MESSAGE,
} from "../authClient";
import { getLoginPath, type ProtectedAppPath } from "../routing";
import type { SessionResponse } from "../types";
import "./ResetPasswordPanel.css";

interface ResetPasswordPanelProps {
  initialEmail?: string;
  invalidLink: boolean;
  mode: SessionResponse["mode"] | null;
  onRequestReset: (email: string) => Promise<void>;
  onResetPassword: (newPassword: string, token: string) => Promise<void>;
  returnTo: ProtectedAppPath;
  token: string | null;
}

type ResetView = "request" | "request-sent" | "reset" | "reset-complete";

export function ResetPasswordPanel({
  initialEmail = "",
  invalidLink,
  mode,
  onRequestReset,
  onResetPassword,
  returnTo,
  token,
}: ResetPasswordPanelProps) {
  const [view, setView] = useState<ResetView>(
    token === null ? "request" : "reset",
  );
  const [email, setEmail] = useState(initialEmail);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    invalidLink ? INVALID_PASSWORD_RESET_LINK_MESSAGE : null,
  );

  async function handleRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting || email.trim().length === 0) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await onRequestReset(email.trim());
      setView("request-sent");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting || token === null || newPassword.length === 0) {
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("The passwords do not match.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await onResetPassword(newPassword, token);
      setNewPassword("");
      setConfirmPassword("");
      setView("reset-complete");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function showRequestForm() {
    setView("request");
    setErrorMessage(null);
  }

  if (mode === null) {
    return (
      <section className="reset-password-panel" aria-live="polite">
        Checking password reset availability...
      </section>
    );
  }

  if (mode === "local") {
    return (
      <section
        className="reset-password-panel reset-password-message"
        aria-labelledby="reset-password-panel-title"
      >
        <div>
          <p className="eyebrow">Local development</p>
          <h2 id="reset-password-panel-title">Password reset is unavailable</h2>
          <p>
            Local sign-in does not use passwords. Return to the login page and
            enter any development identity.
          </p>
        </div>
        <Link className="submit-button" to={getLoginPath(returnTo)}>
          Back to login
        </Link>
      </section>
    );
  }

  if (view === "request-sent") {
    return (
      <section
        className="reset-password-panel reset-password-message"
        aria-labelledby="reset-password-panel-title"
      >
        <div>
          <p className="eyebrow">Check your email</p>
          <h2 id="reset-password-panel-title">Reset link requested</h2>
          <p className="confirmation" role="status">
            {PASSWORD_RESET_CONFIRMATION_MESSAGE}
          </p>
          <p>
            The link may take a few minutes to arrive. Check your spam folder,
            or request another link if needed.
          </p>
        </div>
        <div className="reset-password-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={showRequestForm}
          >
            Request another link
          </button>
          <Link to={getLoginPath(returnTo)}>Back to login</Link>
        </div>
      </section>
    );
  }

  if (view === "reset-complete") {
    return (
      <section
        className="reset-password-panel reset-password-message"
        aria-labelledby="reset-password-panel-title"
      >
        <div>
          <p className="eyebrow">Password updated</p>
          <h2 id="reset-password-panel-title">Your new password is ready</h2>
          <p className="confirmation" role="status">
            Your password has been reset. Sign in with the new password to
            continue.
          </p>
        </div>
        <Link className="submit-button" to={getLoginPath(returnTo)}>
          Continue to sign in
        </Link>
      </section>
    );
  }

  if (view === "request") {
    return (
      <section
        className="reset-password-panel"
        aria-labelledby="reset-password-panel-title"
      >
        <div>
          <p className="eyebrow">Account recovery</p>
          <h2 id="reset-password-panel-title">Request a reset link</h2>
          <p>
            Enter your account email. For privacy, the confirmation is the same
            whether or not an account exists.
          </p>
        </div>
        <form
          aria-describedby={
            errorMessage === null ? undefined : "reset-password-error"
          }
          className="account-form"
          onSubmit={handleRequestSubmit}
        >
          <label className="field-label" htmlFor="reset-password-email">
            Email
          </label>
          <input
            autoComplete="email"
            disabled={submitting}
            id="reset-password-email"
            name="email"
            placeholder="you@example.com"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button
            className="submit-button"
            disabled={submitting || email.trim().length === 0}
            type="submit"
          >
            {submitting ? "Requesting reset link..." : "Send reset link"}
          </button>
          <Link
            className="reset-password-back-link"
            to={getLoginPath(returnTo)}
          >
            Back to login
          </Link>
        </form>
        {errorMessage !== null && (
          <p
            className="form-message error-state"
            id="reset-password-error"
            role="alert"
          >
            {errorMessage}
          </p>
        )}
      </section>
    );
  }

  return (
    <section
      className="reset-password-panel"
      aria-labelledby="reset-password-panel-title"
    >
      <div>
        <p className="eyebrow">Choose a new password</p>
        <h2 id="reset-password-panel-title">Complete password reset</h2>
        <p>Use at least 8 characters and avoid common passwords.</p>
      </div>
      <form
        aria-describedby={
          errorMessage === null ? undefined : "reset-password-error"
        }
        className="account-form"
        onSubmit={handleResetSubmit}
      >
        <label className="field-label" htmlFor="reset-password-new">
          New password
        </label>
        <input
          autoComplete="new-password"
          disabled={submitting}
          id="reset-password-new"
          minLength={8}
          name="newPassword"
          required
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <label className="field-label" htmlFor="reset-password-confirm">
          Confirm new password
        </label>
        <input
          autoComplete="new-password"
          disabled={submitting}
          id="reset-password-confirm"
          minLength={8}
          name="confirmPassword"
          required
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        <button
          className="submit-button"
          disabled={
            submitting || newPassword.length < 8 || confirmPassword.length < 8
          }
          type="submit"
        >
          {submitting ? "Resetting password..." : "Reset password"}
        </button>
      </form>
      {errorMessage !== null && (
        <div className="reset-password-recovery">
          <p
            className="form-message error-state"
            id="reset-password-error"
            role="alert"
          >
            {errorMessage}
          </p>
          {errorMessage === INVALID_PASSWORD_RESET_LINK_MESSAGE && (
            <button
              className="secondary-button"
              type="button"
              onClick={showRequestForm}
            >
              Request a new link
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Try again.";
}
