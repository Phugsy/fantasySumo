import { useEffect, useRef, useState } from "react";
import {
  fetchLiveJokerTrial,
  enableLiveJokerTrial,
  getErrorMessage,
} from "../api";
import * as styles from "./JokerPanel.css";

export function LiveJokerControls({
  onRefresh,
}: {
  onRefresh: () => Promise<void>;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    let current = true;
    void fetchLiveJokerTrial("2026-11")
      .then((r) => {
        if (current) setEnabled(r.trial !== null);
      })
      .catch((e) => {
        if (current) setError(getErrorMessage(e));
      });
    return () => {
      current = false;
      mounted.current = false;
    };
  }, []);
  async function enable() {
    if (!confirmed || busy || enabled !== false) return;
    setBusy(true);
    setError(null);
    try {
      await enableLiveJokerTrial("2026-11");
      if (!mounted.current) return;
      setEnabled(true);
      await onRefresh();
    } catch (e) {
      if (mounted.current) setError(getErrorMessage(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className={styles.panel} aria-labelledby="live-joker-title">
      <h3 id="live-joker-title">November joker trial</h3>
      <p>
        Three jokers for every stable, at most one per day. Each doubles the
        selected bout’s win and eligible gold-star points. Other bonuses stay
        unchanged.
      </p>
      {enabled ? (
        <p role="status">
          Jokers are enabled for November. Base scoring and original stable
          picks are preserved.
        </p>
      ) : (
        <>
          <p>
            Enable only before the Day 1 deadline (8 November, 03:00 UTC / 12:00
            JST), with no results imported. This freezes the saved base scoring
            and cannot be undone during the tournament. It does not reopen or
            lock stable picks.
          </p>
          <label className={styles.confirmation}>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy || enabled === null}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I confirm the November 2026 trial applies to all stables.
          </label>
          <button
            type="button"
            disabled={busy || enabled !== false || !confirmed}
            onClick={() => void enable()}
          >
            {busy ? "Enabling…" : "Enable November jokers"}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
