import { useEffect, useRef, useState } from "react";
import {
  ApiRequestError,
  fetchAdminBasho,
  getErrorMessage,
  runAdminDemoAction,
  runAdminLifecycleAction,
} from "../api";
import type {
  AdminActionResponse,
  AdminDemoAction,
  AdminLifecycleAction,
  Basho,
} from "../types";
import "./AdminPanel.css";

interface AdminPanelProps {
  onPlayerDataRefresh: () => Promise<void>;
}

type AdminMode = "live" | "demo";

export function AdminPanel({ onPlayerDataRefresh }: AdminPanelProps) {
  const isMountedRef = useRef(false);
  const [mode, setMode] = useState<AdminMode>(
    import.meta.env.VITE_BASHO_MODE === "demo" ? "demo" : "live",
  );
  const [basho, setBasho] = useState<Omit<Basho, "teamSize"> | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;

    void fetchAdminBasho(mode)
      .then((response) => {
        if (!isCurrent) return;
        setBasho(response.basho);
        setLoadState("ready");
      })
      .catch((error) => {
        if (!isCurrent) return;
        setBasho(null);
        setErrorMessage(getErrorMessage(error));
        setLoadState("error");
      });

    return () => {
      isCurrent = false;
    };
  }, [mode]);

  function selectMode(nextMode: AdminMode) {
    if (nextMode === mode) return;

    setLoadState("loading");
    setMessage(null);
    setErrorMessage(null);
    setMode(nextMode);
  }

  async function runAction(
    action: AdminLifecycleAction | AdminDemoAction,
    options: { confirmation?: string; success: string },
  ) {
    if (basho === null && !(mode === "demo" && action === "reset")) return;
    if (
      options.confirmation !== undefined &&
      !window.confirm(options.confirmation)
    ) {
      return;
    }

    setPendingAction(action);
    setMessage(null);
    setErrorMessage(null);

    let response: AdminActionResponse;

    try {
      response =
        mode === "demo"
          ? await runAdminDemoAction(action as AdminDemoAction)
          : await runAdminLifecycleAction(
              basho!.id,
              action as AdminLifecycleAction,
            );
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      if (
        error instanceof ApiRequestError &&
        error.status === 409 &&
        error.basho !== undefined
      ) {
        setBasho(error.basho);
        setLoadState("ready");
      }
      setErrorMessage(getErrorMessage(error));
      setPendingAction(null);
      return;
    }

    if (!isMountedRef.current) {
      return;
    }

    setBasho(response.basho);
    setLoadState("ready");
    setMessage(options.success);

    try {
      await onPlayerDataRefresh();
    } catch (error) {
      setErrorMessage(
        `The action succeeded, but player data could not be refreshed: ${getErrorMessage(error)}`,
      );
    }

    setPendingAction(null);
  }

  const pending = pendingAction !== null;

  return (
    <section className="admin-panel" aria-labelledby="admin-basho-title">
      <div className="admin-mode-switch" role="group" aria-label="Basho data">
        <button
          type="button"
          className={mode === "live" ? "active" : ""}
          disabled={pending}
          onClick={() => selectMode("live")}
        >
          Live basho
        </button>
        <button
          type="button"
          className={mode === "demo" ? "active" : ""}
          disabled={pending}
          onClick={() => selectMode("demo")}
        >
          Demo fixture
        </button>
      </div>

      {loadState === "loading" && (
        <div className="state-panel" aria-live="polite">
          Loading admin basho state...
        </div>
      )}

      {loadState === "error" && (
        <>
          <div className="state-panel error-state" role="alert">
            {errorMessage}
          </div>
          {mode === "demo" && (
            <div className="admin-action-grid">
              <AdminAction
                description="Create or replace only the fixed deterministic demo fixture at day 0."
                disabled={pending}
                label="Create demo fixture"
                onClick={() =>
                  runAction("reset", {
                    confirmation:
                      "Create the deterministic demo fixture? A live record using the fixed demo ID will make this fail closed.",
                    success: "Demo fixture created. Picks are open at day 0.",
                  })
                }
              />
            </div>
          )}
        </>
      )}

      {loadState === "ready" && basho !== null && (
        <>
          <div className="admin-basho-summary">
            <div>
              <p className="eyebrow">
                {basho.isDemo ? "Demo data" : "Live data"}
              </p>
              <h2 id="admin-basho-title">{basho.name}</h2>
              <p className="admin-basho-id">{basho.id}</p>
            </div>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>{formatStatus(basho.status)}</dd>
              </div>
              <div>
                <dt>Current day</dt>
                <dd>{basho.currentDay ?? 0}</dd>
              </div>
              <div>
                <dt>Data mode</dt>
                <dd>{basho.isDemo ? "Deterministic demo" : "Live basho"}</dd>
              </div>
            </dl>
          </div>

          {basho.isDemo ? (
            <div className="admin-action-grid">
              <AdminAction
                description="Replace only the known demo fixture and reopen picks at day 0."
                disabled={pending}
                label="Reset and open picks"
                onClick={() =>
                  runAction("reset", {
                    confirmation:
                      "Reset the deterministic demo fixture? This replaces its demo teams, picks, and results, but never live data.",
                    success: "Demo fixture reset. Picks are open at day 0.",
                  })
                }
              />
              <AdminAction
                description="Lock demo picks and enter active scoring at day 0."
                disabled={pending || basho.status === "complete"}
                label="Start the demo"
                onClick={() =>
                  runAction("start", {
                    success: "Demo started. Picks are locked.",
                  })
                }
              />
              <AdminAction
                description="Apply the next deterministic result day and refresh scoring."
                disabled={pending || basho.status === "complete"}
                label="Advance one day"
                onClick={() =>
                  runAction("advance-day", {
                    success: "Demo advanced by one result day.",
                  })
                }
              />
              <AdminAction
                danger
                description="Apply every remaining demo result and mark the fixture complete."
                disabled={pending || basho.status === "complete"}
                label="Finish the demo"
                onClick={() =>
                  runAction("complete", {
                    confirmation:
                      "Finish the deterministic demo and apply all remaining results?",
                    success: "Demo completed through day 15.",
                  })
                }
              />
            </div>
          ) : (
            <div className="admin-action-grid">
              <AdminAction
                description="Reopen a locked basho only before it has progress or results."
                disabled={
                  pending ||
                  (basho.status !== "locked" && basho.status !== "upcoming")
                }
                label="Open picks"
                onClick={() =>
                  runAction("open-picks", {
                    success: "Picks are open for the live basho.",
                  })
                }
              />
              <AdminAction
                description="Atomically close picks and move the basho into active scoring."
                disabled={
                  pending ||
                  (basho.status !== "upcoming" && basho.status !== "locked")
                }
                label="Start the basho"
                onClick={() =>
                  runAction("start", {
                    success: "Basho started. Picks are locked.",
                  })
                }
              />
              <AdminAction
                danger
                description="Mark the active basho complete. This does not import missing results."
                disabled={pending || basho.status !== "active"}
                label="Close the basho"
                onClick={() =>
                  runAction("close", {
                    confirmation:
                      "Close this live basho? Confirm that the intended results have already been imported.",
                    success: "Basho marked complete.",
                  })
                }
              />
            </div>
          )}

          {pendingAction !== null && (
            <p className="form-message" role="status">
              Applying {formatAction(pendingAction)}...
            </p>
          )}
          {message !== null && (
            <p className="confirmation" role="status">
              {message}
            </p>
          )}
          {errorMessage !== null && (
            <p className="form-message error-state" role="alert">
              {errorMessage}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function AdminAction({
  danger = false,
  description,
  disabled,
  label,
  onClick,
}: {
  danger?: boolean;
  description: string;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <article className="admin-action-card">
      <h3>{label}</h3>
      <p>{description}</p>
      <button
        type="button"
        className={danger ? "danger-button" : "primary-button"}
        disabled={disabled}
        onClick={onClick}
      >
        {label}
      </button>
    </article>
  );
}

function formatStatus(status: Basho["status"]): string {
  return status
    .replace("-", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatAction(action: string): string {
  return action.replaceAll("-", " ");
}
