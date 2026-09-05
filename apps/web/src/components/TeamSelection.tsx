import type { FormEvent } from "react";
import type { CreatedTeamResponse, RankedRikishi } from "../types";
import "./TeamSelection.css";

interface TeamSelectionProps {
  canSubmit: boolean;
  createdTeam: CreatedTeamResponse | null;
  displayName: string;
  errorMessage: string | null;
  isLocked: boolean;
  lockMessage?: string;
  mode: "create" | "edit";
  onCancel: () => void;
  onDisplayNameChange: (displayName: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleRikishi: (rikishiId: string) => void;
  rikishi: RankedRikishi[];
  selectedIds: string[];
  selectedRikishi: RankedRikishi[];
  submitState: "idle" | "submitting";
  teamSize: number;
}

export function TeamSelection({
  canSubmit,
  createdTeam,
  displayName,
  errorMessage,
  isLocked,
  lockMessage,
  mode,
  onCancel,
  onDisplayNameChange,
  onSubmit,
  onToggleRikishi,
  rikishi,
  selectedIds,
  selectedRikishi,
  submitState,
  teamSize,
}: TeamSelectionProps) {
  const picksRemaining = Math.max(teamSize - selectedIds.length, 0);

  return (
    <form className="selection-layout" onSubmit={onSubmit}>
      <section className="rikishi-section" aria-labelledby="rikishi-title">
        <div className="section-heading">
          <p className="eyebrow">Banzuke</p>
          <h2 id="rikishi-title">Choose rikishi</h2>
        </div>
        {isLocked && lockMessage !== undefined && (
          <p className="form-message" role="status">
            {lockMessage}
          </p>
        )}
        <div className="rikishi-list">
          {rikishi.map((entry) => {
            const isSelected = selectedIds.includes(entry.id);
            const isDisabled =
              isLocked || (!isSelected && selectedIds.length >= teamSize);

            return (
              <button
                className="rikishi-row"
                disabled={isDisabled}
                key={entry.id}
                onClick={() => onToggleRikishi(entry.id)}
                type="button"
                aria-pressed={isSelected}
              >
                <span className="rank-pill">{entry.rank}</span>
                <span>
                  <strong>{entry.shikona}</strong>
                  {entry.heya !== undefined && <small>{entry.heya}</small>}
                  <PreviousBashoRecord entry={entry} />
                </span>
                <span
                  className={isSelected ? "pick-mark selected" : "pick-mark"}
                >
                  {isSelected ? "Selected" : "Pick"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="summary-panel" aria-labelledby="summary-title">
        <div className="section-heading">
          <p className="eyebrow">Your team</p>
          <h2 id="summary-title">
            {mode === "edit" ? "Edit stable" : "Selection"}
          </h2>
        </div>

        <label className="field-label" htmlFor="displayName">
          Team name
        </label>
        <input
          id="displayName"
          name="displayName"
          disabled={isLocked}
          value={displayName}
          onChange={(event) => onDisplayNameChange(event.target.value)}
          placeholder="East Stand Heroes"
        />

        <ol className="selected-list" aria-label="Selected rikishi">
          {selectedRikishi.map((entry) => (
            <li key={entry.id}>
              <span>{entry.shikona}</span>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => onToggleRikishi(entry.id)}
                aria-label={`Remove ${entry.shikona}`}
              >
                Remove
              </button>
            </li>
          ))}
          {Array.from({ length: picksRemaining }).map((_, index) => (
            <li className="empty-pick" key={`empty-${index}`}>
              Pick slot
            </li>
          ))}
        </ol>

        <div className="selection-actions">
          {mode === "edit" && (
            <button
              className="cancel-button"
              disabled={submitState === "submitting"}
              onClick={onCancel}
              type="button"
            >
              Cancel
            </button>
          )}
          <button
            className="submit-button"
            disabled={isLocked || !canSubmit}
            type="submit"
          >
            {submitState === "submitting"
              ? mode === "edit"
                ? "Saving..."
                : "Submitting..."
              : mode === "edit"
                ? "Save changes"
                : "Submit team"}
          </button>
        </div>

        {errorMessage !== null && (
          <p className="form-message error-state" role="alert">
            {errorMessage}
          </p>
        )}

        {createdTeam !== null && (
          <div className="confirmation" role="status">
            <strong>
              {mode === "edit"
                ? `Changes saved for ${createdTeam.team.displayName}.`
                : `${createdTeam.team.displayName} submitted.`}
            </strong>
            <span>
              {createdTeam.picks.length} rikishi selected for this basho.
            </span>
          </div>
        )}
      </aside>
    </form>
  );
}

function PreviousBashoRecord({ entry }: { entry: RankedRikishi }) {
  const record = entry.previousBashoRecord;

  if (record?.status === "did-not-compete") {
    return (
      <small className="previous-basho-record unavailable">
        Previous basho: {record.bashoName} · Did not compete
      </small>
    );
  }

  if (record === undefined || record.status === "unavailable") {
    const bashoName = record?.bashoName;

    return (
      <small className="previous-basho-record unavailable">
        Previous basho: {bashoName ?? "Record unavailable"}
        {bashoName === undefined ? "" : " · Record unavailable"}
      </small>
    );
  }

  const formattedRecord = [record.wins, record.losses, record.absences]
    .slice(0, record.absences > 0 ? 3 : 2)
    .join("–");

  return (
    <small className="previous-basho-record">
      <span aria-hidden="true">
        Previous basho: {record.bashoName} · {formattedRecord} · {record.rank}
      </span>
      <span className="visually-hidden">
        Previous basho {record.bashoName}: {record.wins} wins, {record.losses}{" "}
        losses, {record.absences} absences, ranked {record.rank}
      </span>
    </small>
  );
}
