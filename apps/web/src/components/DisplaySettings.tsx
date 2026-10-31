import { useId } from "react";
import { useDisplayPreferences } from "../DisplayPreferences";
import type { ColourTheme, RikishiOrder } from "../display-preferences";
import * as styles from "./DisplaySettings.css";

export function DisplaySettings() {
  const { preferences, update } = useDisplayPreferences();
  const id = useId();
  return (
    <details className={styles.root}>
      <summary className={styles.summary}>Display</summary>
      <div className={styles.panel}>
        <label className={styles.field} htmlFor={`${id}-theme`}>
          Colour theme
          <select
            className={styles.select}
            id={`${id}-theme`}
            value={preferences.theme}
            onChange={(event) =>
              update({ theme: event.target.value as ColourTheme })
            }
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className={styles.field} htmlFor={`${id}-order`}>
          Rikishi order
          <select
            className={styles.select}
            id={`${id}-order`}
            value={preferences.order}
            onChange={(event) =>
              update({ order: event.target.value as RikishiOrder })
            }
          >
            <option value="rank">Rank</option>
            <option value="score">Current score</option>
            <option value="name">Name</option>
          </select>
        </label>
        <label className={styles.checkbox}>
          <input
            className={styles.input}
            type="checkbox"
            checked={preferences.photos}
            onChange={(event) => update({ photos: event.target.checked })}
          />
          Show rikishi photos
        </label>
      </div>
    </details>
  );
}
