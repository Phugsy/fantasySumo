import type {
  Basho,
  MyTeamResponse,
  ScheduleLoadState,
  ScheduleResponse,
  SessionUser,
} from "../types";
import {
  canEditFantasyPicks,
  getBashoLifecycleLabel,
  getPickLockMessage,
} from "../lifecycle";
import "./MyStablePanel.css";

interface MyStablePanelProps {
  basho: Basho;
  myTeam: MyTeamResponse | null;
  onEdit: () => void;
  schedule: ScheduleResponse | null;
  scheduleLoadState: ScheduleLoadState;
  user: SessionUser | null;
}

export function MyStablePanel({
  basho,
  myTeam,
  onEdit,
  schedule,
  scheduleLoadState,
  user,
}: MyStablePanelProps) {
  const stableBasho = myTeam === null ? basho : { ...basho, ...myTeam.basho };
  const teamIsLocked = myTeam?.team.lockedAt !== undefined;
  const canEdit = canEditFantasyPicks(stableBasho) && !teamIsLocked;

  if (user === null) {
    return (
      <section
        className="stable-panel stable-empty"
        aria-labelledby="stable-title"
      >
        <div className="section-heading">
          <p className="eyebrow">Your stable</p>
          <h2 id="stable-title">Sign in to see your team</h2>
        </div>
        <p>
          Your picks and scoring progress are private to your player session.
          Sign in above to view or create your stable.
        </p>
      </section>
    );
  }

  if (myTeam === null) {
    return (
      <section
        className="stable-panel stable-empty"
        aria-labelledby="stable-title"
      >
        <div className="section-heading">
          <p className="eyebrow">Your stable</p>
          <h2 id="stable-title">No team for this basho yet</h2>
        </div>
        <p>{getNoTeamMessage(stableBasho)}</p>
        {canEdit && (
          <button className="stable-action" type="button" onClick={onEdit}>
            Create your stable
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="stable-panel" aria-labelledby="stable-title">
      <div className="stable-heading">
        <div>
          <p className="eyebrow">Your stable</p>
          <h2 id="stable-title">{myTeam.team.displayName}</h2>
          <p className="stable-status">{formatBashoStatus(stableBasho)}</p>
        </div>
        <div
          className="stable-total"
          aria-label={`${myTeam.totalScore} total points`}
        >
          <span>Total score</span>
          <strong>{myTeam.totalScore}</strong>
          <small>pts</small>
        </div>
      </div>

      <div
        className={canEdit ? "stable-notice editable" : "stable-notice locked"}
      >
        <p>{getTeamStateMessage(stableBasho, teamIsLocked)}</p>
        {canEdit && (
          <button className="stable-action" type="button" onClick={onEdit}>
            Edit picks
          </button>
        )}
      </div>

      <div className="section-heading stable-lineup-heading">
        <p className="eyebrow">Line-up</p>
        <h3>Selected rikishi</h3>
      </div>
      <ul className="stable-picks" aria-label="Your selected rikishi">
        {myTeam.picks.map((pick) => (
          <li key={pick.rikishiId}>
            <div className="stable-rikishi">
              <span className="rank-pill">{pick.rank ?? "Unranked"}</span>
              <span>
                <strong>{pick.shikona}</strong>
                {pick.heya !== undefined && <small>{pick.heya}</small>}
              </span>
            </div>
            <div className="stable-rikishi-score">
              <span>
                {pick.wins} win{pick.wins === 1 ? "" : "s"}
              </span>
              <strong>{pick.score} pts</strong>
            </div>
            <MatchupPreview
              basho={stableBasho}
              rikishiId={pick.rikishiId}
              schedule={schedule}
              scheduleLoadState={scheduleLoadState}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MatchupPreview({
  basho,
  rikishiId,
  schedule,
  scheduleLoadState,
}: {
  basho: Basho;
  rikishiId: string;
  schedule: ScheduleResponse | null;
  scheduleLoadState: ScheduleLoadState;
}) {
  if (scheduleLoadState === "loading") {
    return <p className="stable-matchup muted">Loading next matchup…</p>;
  }

  if (scheduleLoadState === "error" || schedule === null) {
    return (
      <p className="stable-matchup unavailable">
        Matchup schedule unavailable right now.
      </p>
    );
  }

  const matchup = schedule.bouts
    .filter((bout) => bout.east.id === rikishiId || bout.west.id === rikishiId)
    .sort((left, right) => left.day - right.day)[0];

  if (matchup === undefined) {
    const nextPublishedDay = schedule.publishedDays[0];

    return (
      <p className="stable-matchup muted">
        {nextPublishedDay === undefined
          ? basho.status === "complete"
            ? "No future matchup is published for this basho."
            : "Next matchup not published yet."
          : `Day ${nextPublishedDay} · No matchup listed in the published schedule.`}
      </p>
    );
  }

  const opponent = matchup.east.id === rikishiId ? matchup.west : matchup.east;
  const withdrawal =
    matchup.withdrawnRikishiId === rikishiId
      ? "Withdrawal reported for your rikishi."
      : matchup.withdrawnRikishiId === opponent.id
        ? `Withdrawal reported for ${opponent.shikona}.`
        : undefined;
  const status =
    withdrawal ??
    (matchup.status === "cancelled"
      ? "Bout marked cancelled."
      : "Published matchup");

  return (
    <p className={`stable-matchup ${matchup.status}`}>
      <strong>
        Day {matchup.day} · vs {opponent.shikona}
      </strong>
      <span>
        {opponent.rank === undefined ? status : `${opponent.rank} · ${status}`}
      </span>
    </p>
  );
}

function formatBashoStatus(basho: Basho): string {
  const day =
    basho.currentDay === undefined || basho.currentDay <= 0
      ? ""
      : ` · Day ${basho.currentDay}`;

  return `${basho.name} · ${getBashoLifecycleLabel(basho.status)}${day}`;
}

function getNoTeamMessage(basho: Basho): string {
  switch (basho.status) {
    case "upcoming":
      return "Picks are open. Create your stable before the basho begins.";
    case "locked":
      return "Picks are locked, and you did not enter a stable before the deadline.";
    case "active":
      return "This basho has started, so new stables can no longer enter.";
    case "complete":
      return "This basho is complete. You can create a stable when picks open for the next basho.";
  }
}

function getTeamStateMessage(basho: Basho, teamIsLocked: boolean): string {
  if (!canEditFantasyPicks(basho)) {
    return `${getPickLockMessage(basho) ?? "Picks are locked for this basho."} Your line-up is read-only.`;
  }

  if (teamIsLocked) {
    return "Picks are locked for this basho. Your line-up is read-only.";
  }

  return "Picks are open. You can still change your team before the basho locks.";
}
