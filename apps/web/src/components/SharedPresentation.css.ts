import { globalStyle } from "@vanilla-extract/css";

// Existing shared selectors retained for their current consumers and cascade.
// New component styles belong in scoped modules; see docs/STYLING.md.
globalStyle(".eyebrow", {
  margin: "0 0 7px",
  color: "var(--vermilion-dark)",
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
    border: "1px solid var(--clay-light)",
    borderRadius: "var(--radius)",
    background: "rgb(255 253 248 / 94%)",
    boxShadow: "var(--shadow)",
  },
);

globalStyle(".state-panel", {
  padding: "24px",
  color: "var(--muted)",
});

globalStyle(".form-message, .confirmation", {
  margin: "16px 0 0",
  padding: "12px 14px",
  borderRadius: "9px",
});

globalStyle(".public-cta", {
  display: "flex",
  gap: "20px",
  alignItems: "center",
  justifyContent: "space-between",
  margin: "18px 0",
  padding: "20px 22px",
  border: "1px solid #c8dad2",
  borderRadius: "var(--radius)",
  background: "var(--moss-light)",
  color: "#263f38",
});

globalStyle(".public-cta p:last-child", {
  marginBottom: "0",
});

globalStyle(".public-cta a", {
  flex: "0 0 auto",
  minHeight: "44px",
  padding: "11px 16px",
  borderRadius: "8px",
  background: "var(--indigo)",
  color: "#ffffff",
  fontWeight: "900",
  textDecoration: "none",
});

globalStyle(".public-cta a:hover", {
  background: "var(--indigo-deep)",
});

globalStyle(".public-cta a:focus-visible", {
  outline: "3px solid var(--focus)",
  outlineOffset: "3px",
});

globalStyle(".stable-confirmation", {
  marginBottom: "16px",
});

globalStyle(".form-message", {
  border: "1px solid var(--clay-light)",
  background: "var(--paper-warm)",
  color: "#514c46",
});

globalStyle(".error-state", {
  borderColor: "#deb8b1",
  background: "#fff3f0",
  color: "#792c24",
});

globalStyle(".confirmation", {
  display: "grid",
  gap: "4px",
  border: "1px solid #c8dad2",
  background: "var(--moss-light)",
  color: "#263f38",
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
