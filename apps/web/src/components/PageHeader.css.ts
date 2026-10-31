import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

export const root = style({
  display: "grid",
  gridTemplateColumns: "150px minmax(0, 1fr)",
  gap: "24px",
  alignItems: "start",
  padding: "6px 0 26px",
  "@media": {
    "(max-width: 640px)": {
      gridTemplateColumns: "1fr",
      gap: "4px",
      paddingBottom: "22px",
    },
  },
});

globalStyle(`${root} > .eyebrow`, {
  paddingTop: "7px",
  "@media": { "(max-width: 640px)": { paddingTop: 0 } },
});
globalStyle(`${root} h1`, { width: "fit-content", maxWidth: "100%" });

// The stable page-title ID is also the route-focus target.
globalStyle("#page-title:focus", { outline: "none" });
globalStyle("#page-title:focus-visible", {
  outline: `3px solid ${vars.focus}`,
  outlineOffset: "4px",
});

export const lede = style({
  maxWidth: "670px",
  marginBottom: 0,
  color: vars.muted,
  fontSize: "1rem",
});
