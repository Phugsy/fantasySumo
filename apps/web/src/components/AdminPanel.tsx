import { useEffect, useRef, useState } from "react";
import {
  ApiRequestError,
  fetchAdminBasho,
  fetchAdminGameConfig,
  getErrorMessage,
  runAdminBanzukeImport,
  runAdminDemoAction,
  runAdminLifecycleAction,
  runAdminResultsImport,
  runAdminScheduleImport,
  updateAdminGameConfig,
} from "../api";
import type {
  AdminActionResponse,
  AdminDemoAction,
  AdminGameConfigResponse,
  AdminImportResponse,
  AdminLifecycleAction,
  Basho,
  ImportEntitySummary,
} from "../types";
import "./AdminPanel.css";

interface AdminPanelProps {
  onPlayerDataRefresh: () => Promise<void>;
}

type AdminMode = "live" | "demo";
type AdminImportAction = "banzuke" | "results" | "schedule";

export function AdminPanel({ onPlayerDataRefresh }: AdminPanelProps) {
  const isMountedRef = useRef(false);
  const [mode, setMode] = useState<AdminMode>(
    import.meta.env.VITE_BASHO_MODE === "demo" ? "demo" : "live",
  );
  const [basho, setBasho] = useState<Omit<Basho, "teamSize"> | null>(null);
  const [gameConfig, setGameConfig] = useState<AdminGameConfigResponse | null>(
    null,
  );
  const [teamSizeDraft, setTeamSizeDraft] = useState("2");
  const [importDay, setImportDay] = useState("1");
  const [dryRun, setDryRun] = useState(true);
  const [importReport, setImportReport] = useState<AdminImportResponse | null>(
    null,
  );
  const [validatedBanzukeTarget, setValidatedBanzukeTarget] = useState<
    string | null
  >(null);
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
      .then(async (response) => ({
        response,
        config: await fetchAdminGameConfig(response.basho.id),
      }))
      .then(({ response, config }) => {
        if (!isCurrent) return;
        setBasho(response.basho);
        setGameConfig(config);
        setTeamSizeDraft(String(config.gameConfig.teamSize));
        setLoadState("ready");
      })
      .catch((error) => {
        if (!isCurrent) return;
        setBasho(null);
        setGameConfig(null);
        if (
          mode === "live" &&
          error instanceof ApiRequestError &&
          error.status === 404 &&
          error.code === "not-found"
        ) {
          setErrorMessage(null);
          setLoadState("ready");
          return;
        }
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
    setImportReport(null);
    setValidatedBanzukeTarget(null);
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
      const config = await fetchAdminGameConfig(response.basho.id);

      if (!isMountedRef.current) {
        return;
      }

      setGameConfig(config);
      setTeamSizeDraft(String(config.gameConfig.teamSize));
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      setErrorMessage(
        `The action succeeded, but game configuration could not be refreshed: ${getErrorMessage(error)}`,
      );
    }

    try {
      await onPlayerDataRefresh();
    } catch (error) {
      setErrorMessage(
        `The action succeeded, but player data could not be refreshed: ${getErrorMessage(error)}`,
      );
    }

    setPendingAction(null);
  }

  async function saveGameConfig() {
    if (basho === null || gameConfig === null) return;

    const teamSize = Number(teamSizeDraft);

    if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 42) {
      setErrorMessage("Team size must be a whole number from 1 to 42.");
      return;
    }

    setPendingAction("save-game-config");
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await updateAdminGameConfig(basho.id, teamSize);

      if (!isMountedRef.current) return;

      setGameConfig(response);
      setTeamSizeDraft(String(response.gameConfig.teamSize));
      setMessage(
        response.changed
          ? `Team size saved as ${response.gameConfig.teamSize}.`
          : `Team size is already ${response.gameConfig.teamSize}.`,
      );

      try {
        await onPlayerDataRefresh();
      } catch (error) {
        if (isMountedRef.current) {
          setErrorMessage(
            `Team size was saved, but player data could not be refreshed: ${getErrorMessage(error)}`,
          );
        }
      }
    } catch (error) {
      if (!isMountedRef.current) return;

      setErrorMessage(getErrorMessage(error));

      try {
        const currentConfig = await fetchAdminGameConfig(basho.id);

        if (isMountedRef.current) {
          setGameConfig(currentConfig);
          setTeamSizeDraft(String(currentConfig.gameConfig.teamSize));
        }
      } catch {
        // Preserve the original update error when the refresh also fails.
      }
    } finally {
      if (isMountedRef.current) {
        setPendingAction(null);
      }
    }
  }

  async function runImport(action: AdminImportAction) {
    if (mode !== "live" || (basho === null && action !== "banzuke")) return;

    const day = Number(importDay);

    if (
      action !== "banzuke" &&
      (!Number.isInteger(day) || day < 1 || day > 15)
    ) {
      setErrorMessage("Import day must be a whole number from 1 to 15.");
      return;
    }

    if (!dryRun) {
      if (action === "banzuke" && validatedBanzukeTarget === null) {
        setErrorMessage(
          "Validate the current banzuke before importing it into live data.",
        );
        return;
      }

      const confirmation =
        action === "banzuke" && validatedBanzukeTarget !== basho?.id
          ? basho === null
            ? `Import the validated ${validatedBanzukeTarget} banzuke and create it as the live basho?`
            : `The validated source banzuke is for ${validatedBanzukeTarget}, not the selected ${basho.id} basho. Import ${validatedBanzukeTarget} as the new live basho?`
          : `Apply the ${formatAction(action)} import to live basho data?`;

      if (!window.confirm(confirmation)) return;
    }

    setPendingAction(`import-${action}`);
    setMessage(null);
    setErrorMessage(null);
    setImportReport(null);

    try {
      const response =
        action === "banzuke"
          ? await runAdminBanzukeImport(
              {
                confirmedSourceBashoId: dryRun
                  ? undefined
                  : (validatedBanzukeTarget ?? undefined),
                expectedBashoId: basho?.id,
              },
              dryRun,
            )
          : action === "results"
            ? await runAdminResultsImport(basho!.id, day, dryRun)
            : await runAdminScheduleImport(basho!.id, day, dryRun);

      if (!isMountedRef.current) return;

      setImportReport(response);
      if (action === "banzuke" && dryRun) {
        setValidatedBanzukeTarget(response.targetBashoId ?? null);
      }
      setMessage(
        `${dryRun ? "Validation" : "Import"} completed for ${formatAction(action)} data.`,
      );

      if (!dryRun) {
        try {
          const refreshedBasho = await fetchAdminBasho("live");
          const refreshedConfig = await fetchAdminGameConfig(
            refreshedBasho.basho.id,
          );

          if (!isMountedRef.current) return;

          setBasho(refreshedBasho.basho);
          setGameConfig(refreshedConfig);
          setTeamSizeDraft(String(refreshedConfig.gameConfig.teamSize));
          await onPlayerDataRefresh();
        } catch (error) {
          if (isMountedRef.current) {
            setErrorMessage(
              `The import completed, but app data could not be refreshed: ${getErrorMessage(error)}`,
            );
          }
        }
      }
    } catch (error) {
      if (isMountedRef.current) {
        setErrorMessage(getErrorMessage(error));
      }
    } finally {
      if (isMountedRef.current) {
        setPendingAction(null);
      }
    }
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

      {loadState === "ready" && mode === "live" && basho === null && (
        <>
          <div className="state-panel">
            No live basho is stored. Validate the current source banzuke, then
            explicitly confirm creating its basho.
          </div>
          <AdminImportPanel
            dryRun={dryRun}
            importDay={importDay}
            importReport={importReport}
            pending={pending}
            showDayImports={false}
            onDryRunChange={setDryRun}
            onImportDayChange={setImportDay}
            onRunImport={(action) => void runImport(action)}
          />
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

          {gameConfig !== null && (
            <section
              className="admin-config-panel"
              aria-labelledby="admin-game-config-title"
            >
              <div>
                <p className="eyebrow">Game configuration</p>
                <h2 id="admin-game-config-title">Fantasy rules</h2>
              </div>
              <div className="admin-config-grid">
                <form
                  className="admin-config-card"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveGameConfig();
                  }}
                >
                  <label htmlFor="admin-team-size">Rikishi per stable</label>
                  <div className="admin-number-control">
                    <input
                      id="admin-team-size"
                      type="number"
                      min="1"
                      max="42"
                      step="1"
                      value={teamSizeDraft}
                      disabled={pending || !gameConfig.canChangeTeamSize}
                      onChange={(event) =>
                        setTeamSizeDraft(event.currentTarget.value)
                      }
                    />
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={pending || !gameConfig.canChangeTeamSize}
                    >
                      Save team size
                    </button>
                  </div>
                  <p>
                    {gameConfig.canChangeTeamSize
                      ? "This locks after the first stable is submitted or picks close."
                      : "Team size is locked because a stable exists or picks have closed."}
                  </p>
                  <p className="admin-config-source">
                    {gameConfig.gameConfig.teamSizeSource === "basho"
                      ? "Saved for this basho"
                      : "Using the server default until saved"}
                  </p>
                </form>
                <article className="admin-config-card">
                  <h3>Scoring mode</h3>
                  <p className="admin-config-value">One point per win</p>
                  <p>
                    Kinboshi, special prizes, jokers, and substitutes are not
                    scored yet. Their rules will be selected before another mode
                    is enabled.
                  </p>
                  <span className="admin-config-source">wins-v0</span>
                </article>
              </div>
            </section>
          )}

          {mode === "live" && (
            <AdminImportPanel
              dryRun={dryRun}
              importDay={importDay}
              importReport={importReport}
              pending={pending}
              showDayImports
              onDryRunChange={setDryRun}
              onImportDayChange={setImportDay}
              onRunImport={(action) => void runImport(action)}
            />
          )}

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
        </>
      )}

      {loadState === "ready" && pendingAction !== null && (
        <p className="form-message" role="status">
          Applying {formatAction(pendingAction)}...
        </p>
      )}
      {loadState === "ready" && message !== null && (
        <p className="confirmation" role="status">
          {message}
        </p>
      )}
      {loadState === "ready" && errorMessage !== null && (
        <p className="form-message error-state" role="alert">
          {errorMessage}
        </p>
      )}
    </section>
  );
}

function AdminImportPanel({
  dryRun,
  importDay,
  importReport,
  pending,
  showDayImports,
  onDryRunChange,
  onImportDayChange,
  onRunImport,
}: {
  dryRun: boolean;
  importDay: string;
  importReport: AdminImportResponse | null;
  pending: boolean;
  showDayImports: boolean;
  onDryRunChange: (dryRun: boolean) => void;
  onImportDayChange: (day: string) => void;
  onRunImport: (action: AdminImportAction) => void;
}) {
  return (
    <section
      className="admin-import-panel"
      aria-labelledby="admin-import-title"
    >
      <div>
        <p className="eyebrow">Source-backed data</p>
        <h2 id="admin-import-title">Import basho data</h2>
        <p>
          Validate source data first, then apply it deliberately to the
          confirmed live basho.
        </p>
      </div>
      <div className="admin-import-options">
        <label>
          <input
            type="checkbox"
            checked={dryRun}
            disabled={pending}
            onChange={(event) => onDryRunChange(event.currentTarget.checked)}
          />
          Dry run — validate without writing
        </label>
        {showDayImports && (
          <label htmlFor="admin-import-day">
            Basho day
            <input
              id="admin-import-day"
              type="number"
              min="1"
              max="15"
              step="1"
              value={importDay}
              disabled={pending}
              onChange={(event) => onImportDayChange(event.currentTarget.value)}
            />
          </label>
        )}
      </div>
      <div className="admin-action-grid">
        <AdminImportAction
          description="Fetch the current Makuuchi banzuke from the Japan Sumo Association."
          disabled={pending}
          label={`${dryRun ? "Validate" : "Import"} banzuke`}
          onClick={() => onRunImport("banzuke")}
        />
        {showDayImports && (
          <>
            <AdminImportAction
              description="Fetch one day of Makuuchi results and then attempt the following published schedule."
              disabled={pending}
              label={`${dryRun ? "Validate" : "Import"} results`}
              onClick={() => onRunImport("results")}
            />
            <AdminImportAction
              description="Fetch or retry one published Makuuchi schedule without changing scores."
              disabled={pending}
              label={`${dryRun ? "Validate" : "Import"} schedule`}
              onClick={() => onRunImport("schedule")}
            />
          </>
        )}
      </div>
      {importReport !== null && <ImportReport report={importReport} />}
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

function AdminImportAction({
  description,
  disabled,
  label,
  onClick,
}: {
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
        className="primary-button"
        disabled={disabled}
        onClick={onClick}
      >
        {label}
      </button>
    </article>
  );
}

function ImportReport({ report }: { report: AdminImportResponse }) {
  const rows = [
    ...toImportReportRows(report.summary, "primary"),
    ...(report.schedule?.status === "imported"
      ? toImportReportRows(
          report.schedule.import.summary,
          "following-schedule",
          "Following schedule",
        )
      : []),
  ];

  return (
    <div className="admin-import-report" role="status">
      <div>
        <strong>{report.dryRun ? "Dry-run result" : "Applied import"}</strong>
        <span>{formatSource(report.source)}</span>
      </div>
      {report.targetBashoId !== undefined && (
        <p>Target basho: {report.targetBashoId}</p>
      )}
      {rows.length === 0 ? (
        <p>No data changes were reported.</p>
      ) : (
        <table>
          <caption>Import entity counts</caption>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Created</th>
              <th scope="col">Updated</th>
              <th scope="col">Skipped</th>
              <th scope="col">Deleted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                <td>{row.summary.created}</td>
                <td>{row.summary.updated}</td>
                <td>{row.summary.skipped}</td>
                <td>{row.summary.deleted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {report.status === "partial" &&
        report.schedule !== undefined &&
        (report.schedule.status === "unavailable" ||
          report.schedule.status === "failed") && (
          <p className="admin-import-warning">
            Results were {report.dryRun ? "validated" : "saved"}, but day{" "}
            {report.schedule.day} schedule status is {report.schedule.status}
            {`: ${report.schedule.message}`}
          </p>
        )}
      {report.schedule?.status === "imported" && (
        <p>
          Following day {report.schedule.day} schedule was also{" "}
          {report.dryRun ? "validated" : "imported"}.
        </p>
      )}
    </div>
  );
}

function toImportReportRows(
  summary: Record<string, ImportEntitySummary>,
  keyPrefix: string,
  labelPrefix?: string,
) {
  return Object.entries(summary)
    .filter(([, entitySummary]) =>
      Object.values(entitySummary).some((count) => count > 0),
    )
    .map(([entity, entitySummary]) => ({
      key: `${keyPrefix}-${entity}`,
      label: [labelPrefix, formatEntity(entity)].filter(Boolean).join(": "),
      summary: entitySummary,
    }));
}

function formatStatus(status: Basho["status"]): string {
  return status
    .replace("-", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatAction(action: string): string {
  return action.replaceAll("-", " ");
}

function formatSource(source: string): string {
  return source.replaceAll("-", " ");
}

function formatEntity(entity: string): string {
  return entity
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}
