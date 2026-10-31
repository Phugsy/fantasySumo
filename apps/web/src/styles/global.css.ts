import { globalStyle } from "@vanilla-extract/css";
import "./theme.css";

globalStyle(":root", {
  color: "#20282d",
  background: "#f3eee4",
  fontFamily:
    'Inter,\n    ui-sans-serif,\n    system-ui,\n    -apple-system,\n    BlinkMacSystemFont,\n    "Segoe UI",\n    sans-serif',
  fontSynthesis: "none",
  lineHeight: "1.5",
  textRendering: "optimizeLegibility",
});

globalStyle("*", {
  boxSizing: "border-box",
});

globalStyle("html", {
  background: "#f3eee4",
});

globalStyle("body", {
  margin: "0",
  minWidth: "320px",
  minHeight: "100vh",
  background:
    "linear-gradient(rgb(255 253 248 / 70%), rgb(255 253 248 / 70%)),\n    repeating-linear-gradient(\n      135deg,\n      transparent 0,\n      transparent 18px,\n      rgb(24 50 71 / 2.5%) 18px,\n      rgb(24 50 71 / 2.5%) 19px\n    )",
});

globalStyle("button, input", {
  font: "inherit",
});

globalStyle("button", {
  cursor: "pointer",
});

globalStyle("button:disabled", {
  cursor: "not-allowed",
});

globalStyle("h1, h2, p", {
  marginTop: "0",
});

globalStyle("h1", {
  marginBottom: "8px",
  color: "var(--indigo-deep)",
  fontSize: "clamp(2rem, 4vw, 2.75rem)",
  letterSpacing: "-0.035em",
  lineHeight: "1.05",
});

globalStyle("h2", {
  marginBottom: "0",
  color: "var(--indigo)",
  fontSize: "1.25rem",
  letterSpacing: "-0.01em",
  lineHeight: "1.2",
});

globalStyle(".site-shell", {
  minHeight: "100vh",
});

globalStyle(".app-shell", {
  width: "min(1180px, 100%)",
  minHeight: "calc(100vh - 75px)",
  margin: "0 auto",
  padding: "34px 32px 56px",
});

globalStyle(".app-shell", {
  "@media": {
    "(max-width: 920px)": {
      paddingRight: "24px",
      paddingLeft: "24px",
    },
  },
});

globalStyle(".app-shell", {
  "@media": {
    "(max-width: 640px)": {
      paddingTop: "26px",
    },
  },
});

globalStyle(".app-shell", {
  "@media": {
    "(max-width: 460px)": {
      padding: "22px 16px 40px",
    },
  },
});

globalStyle("h1", {
  "@media": {
    "(max-width: 460px)": {
      fontSize: "2rem",
    },
  },
});

globalStyle("*, *::before, *::after", {
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      // Preserve the existing reduced-motion override; csstype narrows this enum.
      scrollBehavior: "auto !important" as "auto",
      transitionDuration: "0.01ms !important",
    },
  },
});
