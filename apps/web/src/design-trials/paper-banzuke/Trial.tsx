import { useEffect, useState } from "react";
import { rikishi, stable } from "./fixtures";
import * as styles from "./trial.css";

type View = "stable" | "picks";
type Portrait = "ink" | "photo" | "hidden";

export default function Trial() {
  const [view, setView] = useState<View>("stable");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [portrait, setPortrait] = useState<Portrait>("ink");
  const [selected, setSelected] = useState(["onosato", "aonishiki", "ura"]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const previous = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = theme;
    return () => {
      if (previous) document.documentElement.dataset.theme = previous;
      else delete document.documentElement.dataset.theme;
    };
  }, [theme]);

  function toggle(id: string) {
    if (selected.includes(id)) {
      setSelected(selected.filter((pick) => pick !== id));
      setMessage("Removed from the sample selection in both previews.");
    } else if (selected.length < 5) {
      setSelected([...selected, id]);
      setMessage("Added to the sample selection in both previews.");
    } else {
      setMessage("Five sample picks selected. Remove one to choose another.");
    }
  }

  return (
    <main
      className={`${styles.root} ${theme === "dark" ? styles.dark : styles.light}`}
    >
      <header className={styles.intro}>
        <div>
          <p className={styles.kicker}>Fantasy Sumo · design trial 01</p>
          <h1>Paper, ink & the next basho.</h1>
          <p className={styles.lede}>
            A comparison for Picks and My Stable. Sample data only; nothing here
            changes your team or the live site.
          </p>
        </div>
        <span className={styles.trialMark}>For discussion</span>
      </header>

      <div className={styles.controls} aria-label="Design comparison controls">
        <fieldset className={styles.controlGroup}>
          <legend>Screen</legend>
          {(
            [
              ["stable", "My Stable"],
              ["picks", "Picks"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => {
                setView(value);
                setMessage("");
              }}
            >
              {label}
            </button>
          ))}
        </fieldset>
        <fieldset className={styles.controlGroup}>
          <legend>Theme</legend>
          {(["light", "dark"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
            >
              {value === "light" ? "Light" : "Dark"}
            </button>
          ))}
        </fieldset>
        <fieldset className={styles.controlGroup}>
          <legend>Portraits</legend>
          {(
            [
              ["hidden", "Hidden"],
              ["photo", "Photos"],
              ["ink", "Ink illustrations"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={portrait === value}
              onClick={() => setPortrait(value)}
            >
              {label}
            </button>
          ))}
        </fieldset>
      </div>

      <div className={styles.comparison}>
        {(["reference", "paper"] as const).map((variant) => {
          const paper = variant === "paper";
          const rows = view === "stable" ? stable : rikishi;
          return (
            <section
              key={variant}
              className={styles.column}
              aria-labelledby={`${variant}-label`}
            >
              <header className={styles.variantLabel}>
                <h2 id={`${variant}-label`}>
                  {paper ? "B · Paper & ink" : "A · Current treatment"}
                </h2>
                <p>
                  {paper
                    ? "Serif headings, ruled rows, a pale portrait mount."
                    : "Existing palette, rounded panels and indigo rank pills."}
                </p>
              </header>
              <div
                className={`${styles.preview} ${paper ? styles.paper : styles.reference}`}
              >
                <div className={styles.masthead}>
                  <span className={styles.wordmark}>
                    Fantasy Sumo<span aria-hidden="true">.</span>
                  </span>
                  <span className={styles.edition}>
                    November 2026
                    <br />
                    Fukuoka · sample
                  </span>
                </div>
                <div className={styles.pageHeading}>
                  <div>
                    <p className={styles.kicker}>
                      {view === "stable"
                        ? "Your basho, your stable"
                        : "Choose your five"}
                    </p>
                    <h3>
                      {view === "stable" ? "My Stable" : "Build your stable"}
                    </h3>
                  </div>
                  <span className={styles.stamp} aria-hidden="true">
                    相撲
                  </span>
                </div>

                <div className={styles.panel}>
                  <div className={styles.panelHeading}>
                    <div>
                      <h4>
                        {view === "stable"
                          ? "The Five Rings"
                          : "Your selection"}
                      </h4>
                      <p>
                        {view === "stable"
                          ? "Alex · after day 7 · sample"
                          : "Sample picks are editable in this comparison."}
                      </p>
                    </div>
                    <div className={styles.total}>
                      <strong>
                        {view === "stable"
                          ? stable.reduce((sum, row) => sum + row.points, 0)
                          : selected.length}
                      </strong>
                      <span>
                        {view === "stable" ? "points" : "of 5 picked"}
                      </span>
                    </div>
                  </div>

                  {view === "stable" && (
                    <div className={styles.jokerNotice}>
                      <span className={styles.jokerSymbol} aria-hidden="true">
                        J
                      </span>
                      <div>
                        <strong>2 of 3 jokers remaining</strong>
                        <span>Pick Window closed · next card pending</span>
                      </div>
                    </div>
                  )}

                  <ul className={styles.list}>
                    {rows.map((entry) => {
                      const picked = selected.includes(entry.id);
                      const content = (
                        <>
                          {portrait !== "hidden" && (
                            <span className={styles.portraitMount}>
                              <span className={styles.portraitFrame}>
                                <img
                                  className={
                                    portrait === "ink"
                                      ? styles.inkImage
                                      : styles.photoImage
                                  }
                                  src={entry[portrait]}
                                  alt=""
                                  width="72"
                                  height="88"
                                />
                              </span>
                            </span>
                          )}
                          <span className={styles.identity}>
                            <span className={styles.rank}>{entry.rank}</span>
                            <strong>{entry.name}</strong>
                            <span className={styles.secondary}>
                              {entry.heya} ·{" "}
                              <span className={styles.record}>
                                {entry.record}
                              </span>
                            </span>
                            {view === "stable" && (
                              <span className={styles.opponent}>
                                Next: fights {entry.opponent}
                              </span>
                            )}
                          </span>
                          {view === "stable" ? (
                            <span className={styles.rowPoints}>
                              <strong>{entry.points}</strong>
                              <span>pts</span>
                            </span>
                          ) : (
                            <span
                              className={`${styles.pickMark} ${picked ? styles.picked : ""}`}
                              aria-hidden="true"
                            >
                              <span>{picked ? "✓" : "+"}</span>
                              <span className={styles.pickText}>
                                {picked ? "Picked" : "Pick"}
                              </span>
                            </span>
                          )}
                        </>
                      );
                      return (
                        <li key={entry.id}>
                          {view === "picks" ? (
                            <button
                              className={styles.row}
                              type="button"
                              aria-label={`${picked ? "Remove" : "Pick"} ${entry.name} in ${paper ? "paper" : "current"} preview`}
                              aria-pressed={picked}
                              onClick={() => toggle(entry.id)}
                            >
                              {content}
                            </button>
                          ) : (
                            <div className={styles.row}>{content}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <p className={styles.footnote}>
                    {view === "stable"
                      ? "Original picks locked · wins-only sample scoring"
                      : "Local sample selection only. No team is saved."}
                  </p>
                </div>
                <footer className={styles.previewFooter}>
                  <span>Fifteen days. Five rikishi. Your stable.</span>
                  <span>2026.11</span>
                </footer>
              </div>
            </section>
          );
        })}
      </div>
      <p className={styles.status} role="status">
        {message ||
          "Both previews use the same sample data and portrait choice."}
      </p>
      <section className={styles.reviewNotes} aria-labelledby="review-heading">
        <h2 id="review-heading">What to compare</h2>
        <p>
          Headings and row structure; rank and score readability; portrait
          separation in dark mode; and whether paper should stay an accent or
          shape the wider site. Portrait artwork is unchanged in this trial.
        </p>
        <details>
          <summary>Portrait sources & credits</summary>
          <p>
            Ink illustrations reuse the app’s existing artwork. Photos are
            served from the existing local catalog, with no crop or image
            alteration; all are{" "}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/">
              CC BY-SA 4.0
            </a>
            .
          </p>
          <ul>
            {rikishi.map((entry) => (
              <li key={entry.id}>
                <a href={entry.source}>{entry.name}</a> — {entry.author},
                Wikimedia Commons.
              </li>
            ))}
          </ul>
        </details>
      </section>
    </main>
  );
}
