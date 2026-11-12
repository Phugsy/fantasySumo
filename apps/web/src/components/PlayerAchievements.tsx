import {
  evaluatePlayerTitleAchievements,
  type PlayerAchievement,
} from "@fantasy-sumo/domain";
import type { AllTimeLeaderboardResponse, MyHistoryResponse } from "../types";
import { link } from "./BashoFinish.css";
import * as styles from "./PlayerAchievements.css";

const artwork = {
  cup: "🏆",
  rice: "🍚",
  fish: "🐟",
  medal: "🥈",
} satisfies Record<PlayerAchievement["definition"]["artwork"], string>;

export function PlayerAchievements({
  finishes,
  history,
}: {
  finishes: AllTimeLeaderboardResponse["finishes"];
  history: MyHistoryResponse["history"];
}) {
  const ownedTeamIds = new Map(
    history
      .filter(({ basho }) => !basho.isDemo)
      .map(({ basho, team }) => [basho.id, team.id]),
  );
  const achievements = evaluatePlayerTitleAchievements(
    finishes ?? [],
    ownedTeamIds,
  );

  return (
    <section
      className="history-panel personal-history"
      aria-labelledby="player-achievements-title"
    >
      <div className="section-heading">
        <h2 id="player-achievements-title">My achievements</h2>
      </div>
      {finishes === undefined ? (
        <p>Verified fantasy finishes are currently unavailable.</p>
      ) : (
        <ul className={styles.collection}>
          {achievements.map(({ definition, progress, earnedAt }) => (
            <li className={styles.card} key={definition.id}>
              <span
                className={earnedAt ? styles.earnedSeal : styles.seal}
                aria-hidden="true"
              >
                {artwork[definition.artwork]}
              </span>
              <div>
                <h3 className={styles.name}>{definition.name}</h3>
                <p className={styles.description}>{definition.description}</p>
                {earnedAt ? (
                  <p className={styles.status}>
                    Earned at{" "}
                    <a
                      className={link}
                      href={`/history?basho=${encodeURIComponent(earnedAt.bashoId)}`}
                    >
                      {earnedAt.bashoName}
                    </a>
                  </p>
                ) : (
                  <p className={styles.status}>
                    {progress} / {definition.threshold}{" "}
                    {definition.title === "yusho"
                      ? definition.threshold === 1
                        ? "win"
                        : "wins"
                      : "runner-up finish"}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
