import { useEffect, useState } from "react";
import {
  fetchAllTimeLeaderboard,
  fetchBashoArchive,
  fetchMyHistory,
  getErrorMessage,
} from "../api";
import type {
  AllTimeLeaderboardResponse,
  BashoArchiveResponse,
  MyHistoryResponse,
} from "../types";
import "./HistoryPanel.css";

interface HistoryPanelProps {
  signedIn: boolean;
}

export function HistoryPanel({ signedIn }: HistoryPanelProps) {
  const [archive, setArchive] = useState<BashoArchiveResponse | null>(null);
  const [allTime, setAllTime] = useState<AllTimeLeaderboardResponse | null>(
    null,
  );
  const [myHistory, setMyHistory] = useState<MyHistoryResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [personalErrorMessage, setPersonalErrorMessage] = useState<
    string | null
  >(null);

  useEffect(() => {
    let current = true;

    async function loadHistory() {
      setErrorMessage(null);
      setPersonalErrorMessage(null);
      setMyHistory(null);

      const [publicResult, personalResult] = await Promise.allSettled([
        Promise.all([fetchBashoArchive(), fetchAllTimeLeaderboard()]),
        signedIn ? fetchMyHistory() : Promise.resolve(null),
      ]);

      if (!current) return;

      if (publicResult.status === "fulfilled") {
        const [archiveResponse, allTimeResponse] = publicResult.value;
        setArchive(archiveResponse);
        setAllTime(allTimeResponse);
      } else {
        setErrorMessage(getErrorMessage(publicResult.reason));
      }

      if (personalResult.status === "fulfilled") {
        setMyHistory(personalResult.value);
      } else {
        setPersonalErrorMessage(getErrorMessage(personalResult.reason));
      }
    }

    void loadHistory();

    return () => {
      current = false;
    };
  }, [signedIn]);

  if (errorMessage !== null) {
    return (
      <section className="state-panel error-state" role="alert">
        {errorMessage}
      </section>
    );
  }

  if (archive === null || allTime === null) {
    return (
      <section className="state-panel" aria-live="polite">
        Loading tournament history...
      </section>
    );
  }

  return (
    <div className="history-layout">
      <section className="history-panel" aria-labelledby="all-time-title">
        <div className="section-heading history-heading">
          <div>
            <p className="eyebrow">Across basho</p>
            <h2 id="all-time-title">All-time standings</h2>
          </div>
          <strong>{allTime.bashoCount} scored tournaments</strong>
        </div>
        {allTime.leaderboard.length === 0 ? (
          <p className="history-empty">
            Scores will appear once a basho is complete.
          </p>
        ) : (
          <ol className="all-time-list">
            {allTime.leaderboard.map((entry) => (
              <li key={entry.rank}>
                <span className="history-rank">#{entry.rank}</span>
                <span>
                  <strong>{entry.displayName}</strong>
                  <small>{entry.tournamentsPlayed} tournaments</small>
                </span>
                <strong>{entry.score} pts</strong>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="history-panel" aria-labelledby="archive-title">
        <div className="section-heading">
          <p className="eyebrow">Recorded basho</p>
          <h2 id="archive-title">Tournament archive</h2>
        </div>
        <ul className="archive-list">
          {archive.bashos.map((basho) => (
            <li key={basho.id}>
              <div>
                <strong>{basho.name}</strong>
                <span>
                  {basho.startDate} – {basho.endDate}
                </span>
              </div>
              <span className={`history-status history-status-${basho.status}`}>
                {basho.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {signedIn ? (
        <section
          className="history-panel personal-history"
          aria-labelledby="personal-history-title"
        >
          <div className="section-heading history-heading">
            <div>
              <p className="eyebrow">Your record</p>
              <h2 id="personal-history-title">My tournament history</h2>
            </div>
            <strong>{myHistory?.score ?? 0} all-time pts</strong>
          </div>
          {personalErrorMessage !== null ? (
            <p className="history-empty" role="alert">
              {personalErrorMessage}
            </p>
          ) : myHistory === null || myHistory.history.length === 0 ? (
            <p className="history-empty">
              Your completed and current teams will appear here.
            </p>
          ) : (
            <div className="personal-history-list">
              {myHistory.history.map((entry) => (
                <details key={entry.basho.id}>
                  <summary>
                    <span>
                      <strong>{entry.basho.name}</strong>
                      <small>{entry.team.displayName}</small>
                    </span>
                    <strong>{entry.score} pts</strong>
                  </summary>
                  <ul>
                    {entry.picks.map((pick) => (
                      <li key={pick.rikishiId}>
                        <span>
                          <strong>{pick.shikona}</strong>
                          <small>
                            {[pick.rank, pick.heya].filter(Boolean).join(" · ")}
                          </small>
                        </span>
                        <span>
                          {pick.wins} wins · {pick.score} pts
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
