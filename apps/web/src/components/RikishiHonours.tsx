import {
  scoringPreset,
  type BashoRikishiHonours,
  type ScoringMode,
  type SpecialPrizeType,
} from "@fantasy-sumo/domain";
import * as styles from "./RikishiHonours.css";

const prizeNames = {
  "outstanding-performance": "Outstanding Performance",
  "fighting-spirit": "Fighting Spirit",
  technique: "Technique",
} satisfies Record<SpecialPrizeType, string>;

export function RikishiHonours({
  honours,
  mode,
}: {
  honours: BashoRikishiHonours;
  mode: ScoringMode;
}) {
  const { verifiedThroughDay, goldStars, specialPrizes } = honours;
  const preset = scoringPreset(mode);

  return (
    <details className={styles.panel}>
      <summary className={styles.summary}>Rikishi honours</summary>
      <div className={styles.columns}>
        <section>
          <h3 className={styles.heading}>Gold stars</h3>
          {verifiedThroughDay === 0 ? (
            <p className={styles.note}>
              Waiting for the first verified result day.
            </p>
          ) : (
            <>
              <p className={styles.note}>
                Through verified Day {verifiedThroughDay}
              </p>
              {goldStars.length === 0 ? (
                <p className={styles.note}>No gold stars recorded.</p>
              ) : (
                <ul className={styles.awards}>
                  {goldStars.map(({ recipient, day, defeatedYokozuna }) => (
                    <li key={`${recipient.rikishiId}:${day}`}>
                      <strong>{recipient.shikona}</strong>
                      <span>
                        Day {day} · defeated {defeatedYokozuna}
                      </span>
                      {!recipient.picked && (
                        <span>Unpicked by fantasy teams</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
        <section>
          <h3 className={styles.heading}>Special prizes</h3>
          {specialPrizes === null ? (
            <p className={styles.note}>Waiting for verified final prizes.</p>
          ) : (
            <dl className={styles.prizes}>
              {(Object.keys(prizeNames) as SpecialPrizeType[]).map((type) => {
                const recipients = specialPrizes.filter(
                  (award) => award.type === type,
                );
                return (
                  <div key={type}>
                    <dt>{prizeNames[type]}</dt>
                    {recipients.length === 0 ? (
                      <dd className={styles.note}>No award</dd>
                    ) : (
                      recipients.map(({ recipient }) => (
                        <dd key={recipient.rikishiId}>
                          {recipient.shikona}
                          {!recipient.picked && " · unpicked by fantasy teams"}
                        </dd>
                      ))
                    )}
                  </div>
                );
              })}
            </dl>
          )}
        </section>
      </div>
      <p className={styles.note}>
        {preset.achievements
          ? `For a picked rikishi, the selected scoring rules give a base bonus of +${preset.kinboshi} per gold star and +${preset.specialPrize} per special prize.`
          : "The selected wins-only rules award 0 bonus points for these honours."}
      </p>
    </details>
  );
}
