import { useEffect, useRef, useState } from "react";
import type { BashoFantasyFinish } from "@fantasy-sumo/domain";
import {
  fetchAllTimeLeaderboard,
  fetchLeaderboard,
  fetchMyHistory,
  getErrorMessage,
} from "../api";
import type { LeaderboardResponse } from "../types";
import * as styles from "./BashoFinish.css";
import { RikishiHonours } from "./RikishiHonours";

const finishPath = (id: string) => `/history?basho=${encodeURIComponent(id)}`;

function Recipients({ finish }: { finish: BashoFantasyFinish }) {
  if (finish.outcome.status !== "confirmed") return null;
  const outcome = finish.outcome;
  return (
    <>
      <div className={styles.recipients}>
        {(
          [
            ["Yusho", outcome.yusho],
            ["Jun-yusho", outcome.junYusho],
          ] as const
        ).map(([title, recipients]) => (
          <section className={styles.group} key={title}>
            <h3>
              {recipients.length > 1 ? `Shared ${title.toLowerCase()}` : title}
            </h3>
            {recipients.length === 0 ? (
              <p className={styles.note}>
                No runner-up: first place was shared.
              </p>
            ) : (
              <ul>
                {recipients.map((row) => (
                  <li key={row.teamId}>
                    <strong>{row.displayName}</strong>
                    <small>
                      {row.ownerName ?? "Owner unavailable"} · {row.score} pts
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <p className={styles.note}>
        Fantasy competition titles · official final points. Equal scores share a
        title; shared first has no runner-up.
      </p>
    </>
  );
}

export function BashoFinishSummary({
  finish,
}: {
  finish?: BashoFantasyFinish | null;
}) {
  if (!finish || finish.outcome.status !== "confirmed") return null;
  return (
    <section
      className={styles.summary}
      aria-label={`${finish.bashoName} fantasy honours`}
    >
      <p className={styles.kicker}>Verified fantasy finish</p>
      <h2>{finish.bashoName}</h2>
      <Recipients finish={finish} />
      <a className={styles.link} href={finishPath(finish.bashoId)}>
        View final standings
      </a>
    </section>
  );
}

export function FinishAnnouncement({
  userId,
  refreshKey,
}: {
  userId: string;
  refreshKey: string;
}) {
  const [finish, setFinish] = useState<BashoFantasyFinish | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const storageKey = finish
    ? `fantasy-sumo:finish:${encodeURIComponent(userId)}:${encodeURIComponent(finish.bashoId)}`
    : null;

  useEffect(() => {
    let current = true;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const [standings, personal] = await Promise.all([
          fetchAllTimeLeaderboard(),
          fetchMyHistory(),
        ]);
        const owned = new Set(
          (personal.history ?? []).map((entry) => entry.basho.id),
        );
        const latest =
          (
            standings.finishes ??
            (standings.latestFinish ? [standings.latestFinish] : [])
          ).find(
            (entry) =>
              entry.outcome.status === "confirmed" && owned.has(entry.bashoId),
          ) ?? null;
        if (current) {
          let alreadyDismissed = false;
          if (latest)
            try {
              alreadyDismissed =
                window.localStorage.getItem(
                  `fantasy-sumo:finish:${encodeURIComponent(userId)}:${encodeURIComponent(latest.bashoId)}`,
                ) === "dismissed";
            } catch {
              /* In-memory dismissal still works without browser storage. */
            }
          setFinish(alreadyDismissed ? null : latest);
        }
      } catch {
        /* A celebration must never prevent the game from loading. */
      } finally {
        inFlight = false;
      }
    };
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 120_000);
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      current = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [userId, refreshKey]);

  const visible =
    finish?.outcome.status === "confirmed" && finish.bashoId !== dismissed;
  useEffect(() => {
    const element = dialog.current;
    if (!visible || !element) return;
    const previous = document.activeElement;
    if (!element.open) element.showModal();
    close.current?.focus();
    return () => {
      if (element.open) element.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, [visible]);

  function dismiss() {
    if (!finish) return;
    if (storageKey)
      try {
        window.localStorage.setItem(storageKey, "dismissed");
      } catch {
        /* Retain dismissal for this mounted session. */
      }
    setDismissed(finish.bashoId);
  }
  if (!visible || !finish) return null;
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="finish-announcement-title"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
    >
      <p className={styles.kicker}>The basho is decided</p>
      <h2 id="finish-announcement-title">
        {finish.bashoName}: final fantasy honours
      </h2>
      <Recipients finish={finish} />
      <div className={styles.actions}>
        <a
          className={styles.link}
          href={finishPath(finish.bashoId)}
          onClick={dismiss}
        >
          View final standings
        </a>
        <button
          ref={close}
          type="button"
          className={styles.close}
          onClick={dismiss}
        >
          Dismiss result
        </button>
      </div>
    </dialog>
  );
}

export function CompletedBashoStandings({ bashoId }: { bashoId: string }) {
  return <CompletedBashoStandingsData key={bashoId} bashoId={bashoId} />;
}

function CompletedBashoStandingsData({ bashoId }: { bashoId: string }) {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    void fetchLeaderboard(bashoId)
      .then((value) => {
        if (current) setData(value);
      })
      .catch((reason: unknown) => {
        if (current) setError(getErrorMessage(reason));
      });
    return () => {
      current = false;
    };
  }, [bashoId]);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Loading tournament standings…</p>;
  const confirmed = data.finish?.outcome.status === "confirmed";
  return (
    <section
      className={styles.summary}
      aria-label="Archived tournament standings"
    >
      <h2>
        {data.basho.name}: {confirmed ? "final standings" : "standings"}
      </h2>
      {confirmed ? (
        <Recipients finish={data.finish!} />
      ) : (
        <p className={styles.note}>
          Fantasy honours are unavailable until final results and scoring inputs
          are verified, with at least two entrants.
        </p>
      )}
      {data.rikishiHonours && (
        <RikishiHonours
          honours={data.rikishiHonours}
          mode={data.scoringMode ?? "wins-v0"}
        />
      )}
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Stable / player</th>
            <th scope="col">Official points</th>
          </tr>
        </thead>
        <tbody>
          {data.leaderboard.map((entry) => (
            <tr key={entry.teamId}>
              <td>
                <strong>{entry.displayName}</strong>
                <br />
                {entry.ownerName ?? "Owner unavailable"}
              </td>
              <td>{entry.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
