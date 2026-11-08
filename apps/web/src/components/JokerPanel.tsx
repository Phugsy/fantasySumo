import { selectControl } from "../styles/select.css";
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
  const [selection, setSelection] = useState<{
    day: number;
    target: string;
  } | null>(null);
  const [selectedDay, setSelectedDay] = useState<{
    japanDate: string;
    day: number;
  } | null>(null);
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
        setSelection(null);
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
  const clock = data
    ? new Date(data.now).getTime() +
      (elapsed.anchor === data.now ? elapsed.ms : 0)
    : 0;
  // Offer today and tomorrow using the server clock, independently of results.
  const japanDate = new Date(clock + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const tomorrowDate = new Date(clock + 33 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const windows =
    data?.windows.filter((w) =>
      [japanDate, tomorrowDate].includes(w.deadline.slice(0, 10)),
    ) ?? [];
  const today = windows.find((w) => w.deadline.slice(0, 10) === japanDate);
  const tomorrow = windows.find(
    (w) => w.deadline.slice(0, 10) === tomorrowDate,
  );
  const defaultWindow =
    today && clock < Date.parse(today.deadline) ? today : (tomorrow ?? today);
  const pickWindow =
    (selectedDay?.japanDate === japanDate
      ? windows.find((w) => w.day === selectedDay.day)
      : undefined) ?? defaultWindow;
  const day = pickWindow?.day;
  const current = data?.allocations.find((a) => a.day === day);
  const target =
    selection && selection.day === day
      ? selection.target
      : current && current.state !== "removed"
        ? JSON.stringify([current.boutId, current.rikishiId])
        : "";
  const open =
    pickWindow?.status === "open" &&
    clock < new Date(pickWindow.deadline).getTime();
  const canReserve =
    !!current && current.state !== "removed" && current.state !== "refunded";
  async function save(remove = false) {
    if (!data || !pickWindow || day === undefined || busy) return;
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
      setSelection(null);
    } catch (e) {
      if (!mounted.current) return;
      setError(getErrorMessage(e));
      try {
        const latest = await fetchMyJokers(bashoId);
        if (mounted.current) {
          setData(latest.snapshot);
          setSelection(null);
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
        setSelection(null);
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
      <p className="eyebrow">Trial · three jokers</p>
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
      {pickWindow && (
        <>
          <p>Current basho day: {today?.day ?? "Not started"} (Japan time).</p>
          <label className={styles.field}>
            Basho day
            <select
              aria-label="Basho day"
              value={day}
              disabled={busy}
              onChange={(event) => {
                setSelectedDay({ japanDate, day: Number(event.target.value) });
                setSelection(null);
              }}
            >
              {windows.map((w) => (
                <option key={w.day} value={w.day}>
                  Day {w.day} ·{" "}
                  {w.deadline.slice(0, 10) === japanDate ? "Today" : "Tomorrow"}
                </option>
              ))}
            </select>
          </label>
          <p>
            Choosing joker for Day {day}. Tomorrow’s card is available as soon
            as it is published.
          </p>
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
          {pickWindow.status === "unavailable" && (
            <p>
              The published schedule is not available for this day. An
              administrator can import it manually; the morning schedule job
              also retries.
            </p>
          )}
          {pickWindow.status !== "unavailable" &&
            pickWindow.targets.length === 0 && (
              <p>
                Your stable has no eligible published bout for this Japan day.
              </p>
            )}
          <label className={styles.field}>
            Joker rikishi
            <select
              className={selectControl}
              value={target}
              disabled={!open || busy}
              onChange={(e) =>
                setSelection({ day: pickWindow.day, target: e.target.value })
              }
            >
              <option value="">Choose from your stable</option>
              {pickWindow.targets.map((t) => (
                <option
                  value={JSON.stringify([t.boutId, t.rikishiId])}
                  key={JSON.stringify([t.boutId, t.rikishiId])}
                >
                  {names[t.rikishiId] ?? t.rikishiId} (fights{" "}
                  {names[t.opponentId] ?? t.opponentId})
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
      {!pickWindow && (
        <>
          <p>
            No Pick Window today or tomorrow. Jokers follow the basho dates in
            Japan.
          </p>
          <button type="button" disabled={busy} onClick={() => void refresh()}>
            Refresh joker window
          </button>
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
