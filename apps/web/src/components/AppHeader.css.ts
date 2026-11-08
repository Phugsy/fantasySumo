import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

// Keep the component layout and state selectors scoped to its own root.
export const root = style({
  position: "sticky",
  zIndex: 20,
  top: 0,
  borderTop: "0",
  borderBottom: `1px solid ${vars.clayLight}`,
  background: vars.paper,
  boxShadow: "none",
  color: vars.heading,
  backdropFilter: "none",
});

globalStyle(`${root} .app-header-inner`, {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  alignItems: "center",
  justifyContent: "space-between",
  width: "min(1180px, 100%)",
  minHeight: "72px",
  margin: "0 auto",
  padding: "10px 32px",
});

globalStyle(`${root} .wordmark`, {
  display: "inline-flex",
  alignItems: "center",
  gap: "12px",
  minWidth: 0,
  color: "inherit",
  textDecoration: "none",
});

globalStyle(`${root} .wordmark-mark`, {
  display: "inline-grid",
  flex: "0 0 auto",
  placeItems: "center",
  width: 38,
  height: 38,
  border: "0",
  borderRadius: 3,
  background: vars.vermilion,
  color: "#ffffff",
  fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", serif',
  fontSize: "0.86rem",
  fontWeight: 700,
  letterSpacing: "-0.12em",
  textIndent: "-0.12em",
});

globalStyle(`${root} .wordmark-copy`, {
  display: "grid",
  minWidth: 0,
});

globalStyle(`${root} .wordmark-copy strong`, {
  fontSize: "1.4rem",
  letterSpacing: "-.025em",
  fontFamily: vars.displayFont,
  fontWeight: 500,
  lineHeight: 1.15,
});

globalStyle(`${root} .wordmark-copy small`, {
  color: vars.muted,
  fontSize: "0.72rem",
  letterSpacing: "0.04em",
});

globalStyle(`${root} .app-header-actions`, {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  alignItems: "center",
  justifyContent: "flex-end",
});

globalStyle(`${root} .session-actions`, {
  display: "flex",
  gap: "8px",
  alignItems: "center",
});

globalStyle(`${root} .session-actions span`, {
  maxWidth: "130px",
  overflow: "hidden",
  color: vars.muted,
  fontSize: "0.78rem",
  fontWeight: 700,
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

globalStyle(`${root} .session-actions button`, {
  minHeight: 44,
  padding: "8px 12px",
  border: `1px solid ${vars.clayLight}`,
  borderRadius: 4,
  background: "transparent",
  color: vars.heading,
  fontSize: "0.82rem",
  fontWeight: 650,
});

globalStyle(`${root} .session-actions button:hover:not(:disabled)`, {
  background: vars.hover,
});

globalStyle(`${root} .session-actions button:disabled`, {
  opacity: 0.58,
});

globalStyle(
  `${root} .wordmark:focus-visible, ${root} .session-actions button:focus-visible`,
  {
    outline: `3px solid ${vars.focus}`,
    outlineOffset: "3px",
  },
);

globalStyle(`${root} .app-header-inner`, {
  "@media": {
    "(max-width: 920px)": {
      paddingRight: vars.gutter,
      paddingLeft: vars.gutter,
    },
  },
});

globalStyle(`${root} .app-header-inner`, {
  "@media": {
    "(max-width: 640px)": {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) auto",
      gap: "10px",
      alignItems: "stretch",
      justifyContent: "stretch",
      minHeight: 0,
      paddingTop: "12px",
      paddingRight: "16px",
      paddingBottom: "12px",
      paddingLeft: "16px",
    },
  },
});

globalStyle(`${root} .app-header-actions`, {
  "@media": {
    "(max-width: 640px)": {
      display: "grid",
      gridColumn: "1 / -1",
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: "8px",
      width: "100%",
    },
  },
});

globalStyle(`${root} .session-actions, ${root} .session-actions button`, {
  "@media": {
    "(max-width: 640px)": {
      width: "100%",
    },
  },
});

globalStyle(`${root} .session-actions button`, {
  "@media": {
    "(max-width: 640px)": {
      minHeight: "44px",
    },
  },
});

globalStyle(`${root} .wordmark-copy small`, {
  "@media": {
    "(max-width: 640px)": {
      display: "none",
    },
  },
});

globalStyle(`${root} .session-actions span`, {
  "@media": {
    "(max-width: 640px)": {
      display: "none",
    },
  },
});

globalStyle(`${root} .wordmark-mark`, {
  "@media": {
    "(max-width: 640px)": {
      width: "38px",
      height: "38px",
    },
  },
});
