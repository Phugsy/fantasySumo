import { useEffect, useRef, useState } from "react";
import {
  fetchMyJokers,
  saveMyJoker,
  getErrorMessage,
  type JokerSnapshotResponse,
} from "../api";
import * as styles from "./JokerPanel.css";

type Snapshot = NonNullable<JokerSnapshotResponse["snapshot"]>;
export function JokerPanel({
  bashoId,
  names,
  onRefresh,
}: {
  bashoId: string;
  names: Record<string, string>;
  onRefresh?: () => Promise<void>;
}) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [day, setDay] = useState(1);
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState<{
    anchor: string | undefined;
    ms: number;
  }>({ anchor: undefined, ms: 0 });
  const currentClock = useRef<string | undefined>(undefined);
  const clockKey = data?.now;
  const loadedAt = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    loadedAt.current = Date.now();
    currentClock.current = clockKey;
  }, [clockKey]);
  useEffect(() => {
    mounted.current = true;
    let current = true;
    void fetchMyJokers(bashoId)
      .then((r) => {
        if (!current) return;
        setData(r.snapshot);

        const initial =
          r.snapshot?.windows.find((w) => w.status === "open")?.day ?? 1;
        setDay(initial);
        const allocation = r.snapshot?.allocations.find(
          (a) => a.day === initial && a.state !== "removed",
        );
        setTarget(
          allocation
            ? JSON.stringify([allocation.boutId, allocation.rikishiId])
            : "",
        );
      })
      .catch((e) => {
        if (current) setError(getErrorMessage(e));
      });
    const timer = window.setInterval(
      () =>
        setElapsed({
          anchor: currentClock.current,
          ms: Math.max(0, Date.now() - loadedAt.current),
        }),
      1000,
    );
    return () => {
      current = false;
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [bashoId]);
  const pickWindow = data?.windows.find((w) => w.day === day);
  const current = data?.allocations.find((a) => a.day === day);
  const clock = data
    ? new Date(data.now).getTime() +
      (elapsed.anchor === data.now ? elapsed.ms : 0)
    : 0;
  const open =
    pickWindow?.status === "open" &&
    clock < new Date(pickWindow.deadline).getTime();
  const canReserve =
    !!current && current.state !== "removed" && current.state !== "refunded";
  async function save(remove = false) {
    if (!data || !pickWindow || busy) return;
    const selected = pickWindow.targets.find(
      (t) => JSON.stringify([t.boutId, t.rikishiId]) === target,
    );
    if (!remove && !selected) return;
    setBusy(true);
    setError(null);
    try {
      const result = await saveMyJoker(bashoId, {
        day,
        rikishiId: remove ? null : selected!.rikishiId,
        boutId: remove ? null : selected!.boutId,
        opponentId: remove ? null : selected!.opponentId,
        expectedRevision: current?.revision ?? 0,
        requestId: crypto.randomUUID(),
      });
      if (!mounted.current) return;
      setData(result.snapshot);

      if (remove) setTarget("");
    } catch (e) {
      if (!mounted.current) return;
      setError(getErrorMessage(e));
      try {
        const latest = await fetchMyJokers(bashoId);
        if (mounted.current) {
          setData(latest.snapshot);
        }
      } catch {
        /* Preserve the authoritative action error. */
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const latest = await fetchMyJokers(bashoId);
      if (mounted.current) {
        setData(latest.snapshot);
        await onRefresh?.();
      }
    } catch (e) {
      if (mounted.current) setError(getErrorMessage(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  if (!data)
    return error ? <p role="alert">{error}</p> : <p>Loading joker window…</p>;
  return (
    <section className={styles.panel} aria-labelledby="joker-title">
      <p className="eyebrow">Demo trial · three jokers</p>
      <h2 id="joker-title">Daily joker</h2>
      <p>
        {data.remaining} of 3 jokers remaining · maximum one per day. Double win
        and eligible gold-star points; other bonuses stay unchanged.
      </p>
      {data.budgetDiscrepancy && (
        <p role="alert">
          A corrected result changed your joker budget. Your accepted selections
          are preserved; new allocations are blocked pending reconciliation.
        </p>
      )}
      <label className={styles.field}>
        Basho day
        <select
          value={day}
          disabled={busy}
          onChange={(e) => {
            const d = Number(e.target.value);
            setDay(d);
            const a = data.allocations.find(
              (a) => a.day === d && a.state !== "removed",
            );
            setTarget(a ? JSON.stringify([a.boutId, a.rikishiId]) : "");
          }}
        >
          {data.windows.map((w) => (
            <option key={w.day} value={w.day}>
              Day {w.day}
            </option>
          ))}
        </select>
      </label>
      {pickWindow && (
        <>
          <p role="status">
            Pick Window:{" "}
            {open
              ? "Open"
              : pickWindow.status === "unavailable"
                ? "Unavailable"
                : "Closed"}
          </p>
          <p>
            Deadline (your time):{" "}
            <time dateTime={pickWindow.deadline}>
              {new Date(pickWindow.deadline).toLocaleString()}
            </time>{" "}
            (12:00 JST, Japan date {pickWindow.deadline.slice(0, 10)}).
          </p>
          {open && (
            <p>
              Time remaining:{" "}
              {Math.max(
                0,
                Math.floor(
                  (new Date(pickWindow.deadline).getTime() - clock) / 60000,
                ),
              )}{" "}
              minutes.
            </p>
          )}
          <label className={styles.field}>
            Joker rikishi
            <select
              value={target}
              disabled={!open || busy}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Choose from your stable</option>
              {pickWindow.targets.map((t) => (
                <option
                  value={JSON.stringify([t.boutId, t.rikishiId])}
                  key={JSON.stringify([t.boutId, t.rikishiId])}
                >
                  {names[t.rikishiId] ?? t.rikishiId} vs{" "}
                  {names[t.opponentId] ?? t.opponentId}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.actions}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void refresh()}
            >
              Refresh joker window
            </button>
            <button
              type="button"
              disabled={
                !open ||
                busy ||
                !target ||
                data.budgetDiscrepancy ||
                (!canReserve && data.remaining === 0)
              }
              onClick={() => void save()}
            >
              Save joker
            </button>
            <button
              type="button"
              disabled={
                !open || busy || !current || current.state === "removed"
              }
              onClick={() => void save(true)}
            >
              Remove joker
            </button>
          </div>
          {current && (
            <p>
              Day {day} selection:{" "}
              {names[current.rikishiId] ?? current.rikishiId} · {current.state}
              {current.state === "refunded"
                ? " · available for a future open day"
                : ""}
              .
            </p>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <ul aria-label="Joker allocation history">
        {data.allocations.map((a) => (
          <li key={a.day}>
            Day {a.day}: {names[a.rikishiId] ?? a.rikishiId} · {a.state}
          </li>
        ))}
      </ul>
      <p>
        Original stable picks remain locked. Missing or unverified results stay
        pending; confirmed cancelled or default bouts return the joker for a
        future day.
      </p>
    </section>
  );
}
