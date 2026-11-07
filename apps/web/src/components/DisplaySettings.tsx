import { selectControl } from "../styles/select.css";
import { useId } from "react";
import { useDisplayPreferences } from "../DisplayPreferences";
import type {
  ColourTheme,
  PortraitStyle,
  RikishiOrder,
} from "../display-preferences";
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
            className={`${styles.select} ${selectControl}`}
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
            className={`${styles.select} ${selectControl}`}
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
        <label className={styles.field} htmlFor={`${id}-portraits`}>
          Portrait style
          <select
            className={`${styles.select} ${selectControl}`}
            id={`${id}-portraits`}
            value={preferences.photos ? preferences.portraitStyle : "hidden"}
            onChange={(event) =>
              update(
                event.target.value === "hidden"
                  ? { photos: false }
                  : {
                      photos: true,
                      portraitStyle: event.target.value as PortraitStyle,
                    },
              )
            }
          >
            <option value="hidden">Hidden</option>
            <option value="photos">Photos</option>
            <option value="illustrations">Ink illustrations</option>
          </select>
        </label>
      </div>
    </details>
  );
}
