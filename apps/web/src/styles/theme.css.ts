import {
  createGlobalTheme,
  createGlobalThemeContract,
} from "@vanilla-extract/css";

// Stable names let existing colocated CSS share the typed contract during
// incremental conversion, without changing the application's current theme.
export const vars = createGlobalThemeContract({
  ink: "ink",
  indigo: "indigo",
  indigoDeep: "indigo-deep",
  vermilion: "vermilion",
  vermilionDark: "vermilion-dark",
  paper: "paper",
  paperWarm: "paper-warm",
  clay: "clay",
  clayLight: "clay-light",
  muted: "muted",
  moss: "moss",
  mossLight: "moss-light",
  focus: "focus",
  radius: "radius",
  shadow: "shadow",
});

createGlobalTheme(":root", vars, {
  ink: "#20282d",
  indigo: "#183247",
  indigoDeep: "#102638",
  vermilion: "#a84032",
  vermilionDark: "#833127",
  paper: "#fffdf8",
  paperWarm: "#f7f1e7",
  clay: "#cbbca8",
  clayLight: "#e2d8c9",
  muted: "#5b686f",
  moss: "#355b50",
  mossLight: "#e7efeb",
  focus: "#2b768a",
  radius: "12px",
  shadow: "0 14px 38px rgb(24 50 71 / 8%)",
});
