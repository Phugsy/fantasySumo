import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

// Keep the component layout and state selectors scoped to its own root.
export const root = style({
  display: "inline-flex",
  gap: 4,
  padding: 0,
  border: 0,
  borderRadius: 0,
  background: "transparent",
});

globalStyle(`${root} a, ${root} .session-check`, {
  display: "inline-grid",
  placeItems: "center",
  minHeight: 44,
  padding: "8px 12px",
  border: 0,
  borderRadius: 0,
  background: "transparent",
  color: vars.muted,
  fontSize: "0.9rem",
  fontWeight: 650,
  textDecoration: "none",
  borderBottom: "2px solid transparent",
});

globalStyle(`${root} a:hover`, {
  background: vars.hover,
  color: vars.heading,
});

globalStyle(`${root} a.active`, {
  background: "transparent",
  color: vars.heading,
  boxShadow: "none",
  borderBottomColor: vars.accentText,
});

globalStyle(`${root} .session-check`, {
  opacity: 0.58,
});

globalStyle(`${root} a:focus-visible`, {
  outline: `3px solid ${vars.focus}`,
  outlineOffset: "3px",
});

globalStyle(`${root}`, {
  "@media": {
    "(max-width: 640px)": {
      width: "100%",
      padding: 0,
      border: 0,
      boxShadow: "none",
    },
  },
});

globalStyle(`${root} a, ${root} .session-check`, {
  "@media": {
    "(max-width: 640px)": {
      minWidth: 0,
      minHeight: "44px",
      flex: "1 1 auto",
      paddingRight: "8px",
      paddingLeft: "8px",
      fontSize: "0.78rem",
      whiteSpace: "nowrap",
    },
  },
});

globalStyle(`${root}`, {
  "@media": {
    "(max-width: 460px)": {
      gap: "2px",
    },
  },
});

globalStyle(`${root} a, ${root} .session-check`, {
  "@media": {
    "(max-width: 460px)": {
      paddingRight: "5px",
      paddingLeft: "5px",
      fontSize: "0.75rem",
    },
  },
});
