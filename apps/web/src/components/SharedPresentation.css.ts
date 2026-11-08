import { globalStyle } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

// Existing shared selectors retained for their current consumers and cascade.
// New component styles belong in scoped modules; see docs/STYLING.md.
globalStyle(".eyebrow", {
  margin: "0 0 7px",
  color: vars.accentText,
  fontSize: "0.74rem",
  fontWeight: "900",
  letterSpacing: "0.09em",
  textTransform: "uppercase",
});

globalStyle(".section-heading", {
  marginBottom: "18px",
});

globalStyle(
  ".basho-panel, .rikishi-section, .summary-panel, .state-panel, .leaderboard-section",
  {
    border: `1px solid ${vars.clayLight}`,
    borderRadius: vars.radius,
    background: vars.panel,
    boxShadow: "none",
  },
);

globalStyle(".state-panel", {
  padding: "24px",
  color: vars.muted,
});

globalStyle(".form-message, .confirmation", {
  margin: "16px 0 0",
  padding: "12px 14px",
  borderRadius: vars.radius,
});

globalStyle(".public-cta", {
  display: "flex",
  gap: "20px",
  alignItems: "center",
  justifyContent: "space-between",
  margin: "18px 0",
  padding: "20px 22px",
  border: `1px solid ${vars.positiveBorder}`,
  borderRadius: vars.radius,
  background: vars.mossLight,
  color: vars.positiveText,
});

globalStyle(".public-cta p:last-child", {
  marginBottom: "0",
});

globalStyle(".public-cta a", {
  flex: "0 0 auto",
  minHeight: "44px",
  padding: "11px 16px",
  borderRadius: "8px",
  background: vars.indigo,
  color: "#ffffff",
  fontWeight: "900",
  textDecoration: "none",
});

globalStyle(".public-cta a:hover", {
  background: "#102638",
});

globalStyle(".public-cta a:focus-visible", {
  outline: `3px solid ${vars.focus}`,
  outlineOffset: "3px",
});

globalStyle(".stable-confirmation", {
  marginBottom: "16px",
});

globalStyle(".form-message", {
  border: `1px solid ${vars.clayLight}`,
  background: vars.paperWarm,
  color: vars.secondaryText,
});

globalStyle(".error-state", {
  borderColor: vars.negativeBorder,
  background: vars.negativeSurface,
  color: vars.negativeText,
});

globalStyle(".confirmation", {
  display: "grid",
  gap: "4px",
  border: `1px solid ${vars.positiveBorder}`,
  background: vars.mossLight,
  color: vars.positiveText,
});

globalStyle(".public-cta", {
  "@media": {
    "(max-width: 640px)": {
      display: "grid",
    },
  },
});

globalStyle(".public-cta a", {
  "@media": {
    "(max-width: 640px)": {
      textAlign: "center",
    },
  },
});

// Existing cross-component form, rank and screen-reader presentation.
globalStyle(".rank-pill", {
  display: "block",
  flex: "0 0 auto",
  justifyContent: "start",
  maxWidth: "100%",
  minWidth: 0,
  padding: 0,
  border: 0,
  borderRadius: 0,
  background: "transparent",
  color: vars.muted,
  fontSize: "0.76rem",
  fontWeight: 650,
  lineHeight: 1.3,
  whiteSpace: "normal",
});

globalStyle(".visually-hidden", {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
});

globalStyle(".field-label", {
  display: "block",
  marginBottom: "8px",
  color: vars.secondaryText,
  fontSize: "0.88rem",
  fontWeight: 850,
});

globalStyle("input", {
  width: "100%",
  minHeight: "46px",
  padding: "10px 12px",
  border: `1px solid ${vars.clay}`,
  borderRadius: vars.radius,
  background: vars.surface,
  color: vars.ink,
});

globalStyle("input:disabled", {
  background: vars.disabledSurface,
  color: vars.disabledText,
});

globalStyle(
  "input:focus, .cancel-button:focus-visible, .submit-button:focus-visible",
  {
    outline: `3px solid ${vars.focus}`,
    outlineOffset: "3px",
  },
);

globalStyle(".cancel-button", {
  minHeight: "48px",
  padding: "0 18px",
  border: `1px solid ${vars.clay}`,
  borderRadius: vars.radius,
  background: vars.surface,
  color: vars.indigoDeep,
  fontWeight: 850,
});

globalStyle(".cancel-button:hover:not(:disabled)", {
  background: vars.paperWarm,
});

globalStyle(".cancel-button:disabled", {
  opacity: 0.6,
});

globalStyle(".submit-button", {
  width: "100%",
  minHeight: "48px",
  border: `1px solid ${vars.vermilionDark}`,
  borderRadius: vars.radius,
  background: vars.vermilion,
  color: "#ffffff",
  fontWeight: 900,
  boxShadow: "none",
});

globalStyle(".submit-button:hover:not(:disabled)", {
  background: vars.vermilionDark,
});

globalStyle(".submit-button:disabled", {
  borderColor: vars.clay,
  background: vars.disabledSurface,
  color: vars.disabledText,
  boxShadow: "none",
});

globalStyle(".rank-pill", {
  "@media": {
    "(max-width: 640px)": {
      justifySelf: "start",
      minWidth: 0,
      padding: 0,
      fontSize: "0.72rem",
    },
  },
});
