import type { FormEvent } from "react";
import type { CreatedTeamResponse, RankedRikishi } from "../types";

interface TeamSelectionProps {
  canSubmit: boolean;
  createdTeam: CreatedTeamResponse | null;
  displayName: string;
  errorMessage: string | null;
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
        <div className="rikishi-list">
          {rikishi.map((entry) => {
            const isSelected = selectedIds.includes(entry.id);
            const isDisabled = !isSelected && selectedIds.length >= teamSize;

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
          <h2 id="summary-title">Selection</h2>
        </div>

        <label className="field-label" htmlFor="displayName">
          Team name
        </label>
        <input
          id="displayName"
          name="displayName"
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

        <button className="submit-button" disabled={!canSubmit} type="submit">
          {submitState === "submitting" ? "Submitting..." : "Submit team"}
        </button>

        {errorMessage !== null && (
          <p className="form-message error-state" role="alert">
            {errorMessage}
          </p>
        )}

        {createdTeam !== null && (
          <div className="confirmation" role="status">
            <strong>{createdTeam.team.displayName} submitted.</strong>
            <span>
              {createdTeam.picks.length} rikishi selected for this basho.
            </span>
          </div>
        )}
      </aside>
    </form>
  );
}
