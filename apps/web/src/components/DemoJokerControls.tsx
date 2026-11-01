import { useEffect, useState } from "react";
import {
  configureDemoJokerTrial,
  fetchDemoJokerTrial,
  getErrorMessage,
} from "../api";
import * as styles from "./JokerPanel.css";
export function DemoJokerControls({
  onRefresh,
}: {
  onRefresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [clock, setClock] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let current = true;
    void fetchDemoJokerTrial()
      .then((r) => {
        if (current) {
          setClock(r.trial?.clock ?? null);
          setInput(r.trial?.clock ?? "");
        }
      })
      .catch((e) => {
        if (current) setError(getErrorMessage(e));
      });
    return () => {
      current = false;
    };
  }, [open]);
  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const r = await configureDemoJokerTrial(clock ? input : undefined);
      setClock(r.trial.clock);
      setInput(r.trial.clock);
      await onRefresh();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      className={styles.panel}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>Joker trial controls</summary>
      <h3>Joker trial</h3>
      <p>
        Enable before starting the demo. This opt-in uses three jokers and a
        forward-only demo clock. Reset removes trial data. Live bashos cannot
        enable this trial.
      </p>
      {clock && (
        <label className={styles.field}>
          Demo server time (UTC ISO)
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
          />
        </label>
      )}
      <button type="button" disabled={busy} onClick={() => void apply()}>
        {clock ? "Advance joker clock" : "Enable demo jokers"}
      </button>
      {clock && <p>Demo server time: {clock}</p>}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
