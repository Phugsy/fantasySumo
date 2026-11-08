import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

// Keep the component layout and state selectors scoped to its own root.
export const root = style({
  padding: "26px",
  border: `1px solid ${vars.clayLight}`,
  borderRadius: vars.radius,
  background: vars.panel,
  boxShadow: "none",
});

globalStyle(`${root} .stable-heading`, {
  display: "flex",
  gap: "24px",
  alignItems: "flex-start",
  justifyContent: "space-between",
});

globalStyle(`${root} .stable-heading h2`, {
  fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
});

globalStyle(`${root} .stable-status`, {
  margin: "8px 0 0",
  color: vars.muted,
});

globalStyle(`${root} .stable-total`, {
  display: "grid",
  gridTemplateColumns: "auto auto",
  minWidth: 100,
  padding: "4px 0 4px 18px",
  border: 0,
  borderRadius: 0,
  background: "transparent",
  color: vars.heading,
  textAlign: "right",
  borderLeft: `1px solid ${vars.clayLight}`,
});

globalStyle(`${root} .stable-total span`, {
  gridColumn: "1 / -1",
  fontSize: "0.78rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
});

globalStyle(`${root} .stable-total strong`, {
  fontSize: "2.6rem",
  lineHeight: 1,
  fontFamily: vars.displayFont,
  fontWeight: 400,
});

globalStyle(`${root} .stable-total small`, {
  alignSelf: "end",
  padding: "0 0 3px 4px",
  fontWeight: 800,
});

globalStyle(`${root} .stable-notice`, {
  display: "flex",
  gap: "18px",
  alignItems: "center",
  justifyContent: "space-between",
  margin: "24px 0 28px",
  padding: "14px 16px",
  borderRadius: 4,
});

globalStyle(`${root} .stable-notice p, ${root}.stable-empty > p`, {
  margin: 0,
});

globalStyle(`${root} .stable-notice.editable`, {
  border: `1px solid ${vars.positiveBorder}`,
  background: vars.mossLight,
  color: vars.positiveText,
});

globalStyle(`${root} .stable-notice.locked`, {
  border: `1px solid ${vars.clayLight}`,
  background: vars.paperWarm,
  color: vars.secondaryText,
});

globalStyle(`${root} .stable-action`, {
  minHeight: 44,
  flex: "0 0 auto",
  padding: "9px 15px",
  border: 0,
  borderRadius: 4,
  background: vars.vermilion,
  color: "#ffffff",
  fontWeight: 700,
});

globalStyle(`${root} .stable-action:hover`, {
  background: vars.vermilionDark,
});

globalStyle(`${root} .stable-action:focus-visible`, {
  outline: `3px solid ${vars.focus}`,
  outlineOffset: "3px",
});

globalStyle(`${root} .stable-lineup-heading`, {
  marginBottom: "12px",
});

globalStyle(`${root} .stable-lineup-heading h3`, {
  margin: 0,
  color: vars.heading,
  fontSize: "1.08rem",
});

globalStyle(`${root} .stable-picks`, {
  display: "grid",
  gap: 0,
  margin: 0,
  padding: 0,
  listStyle: "none",
  borderTop: `1px solid ${vars.clayLight}`,
});

globalStyle(`${root} .stable-picks li`, {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "18px",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "18px 0",
  border: 0,
  borderRadius: 0,
  background: "transparent",
  borderBottom: `1px solid ${vars.clayLight}`,
});

globalStyle(`${root} .stable-matchup`, {
  gridColumn: "1 / -1",
  margin: 0,
  paddingTop: "10px",
  borderTop: `1px solid ${vars.clayLight}`,
  color: vars.positiveText,
  fontSize: "0.88rem",
});

globalStyle(`${root} .stable-matchup strong, ${root} .stable-matchup span`, {
  display: "block",
});

globalStyle(`${root} .stable-matchup span`, {
  marginTop: "2px",
  color: vars.muted,
  fontSize: "0.8rem",
});

globalStyle(
  `${root} .stable-matchup.cancelled, ${root} .stable-matchup.unavailable`,
  {
    color: vars.muted,
  },
);

globalStyle(`${root} .stable-matchup.muted`, {
  color: vars.muted,
});

globalStyle(`${root} .stable-rikishi`, {
  display: "flex",
  gap: "12px",
  alignItems: "center",
  minWidth: 0,
});

globalStyle(
  `${root} .stable-rikishi strong, ${root} .stable-rikishi small, ${root} .stable-rikishi-score span, ${root} .stable-rikishi-score strong`,
  {
    display: "block",
  },
);

globalStyle(`${root} .stable-rikishi > span:last-child`, {
  minWidth: 0,
  overflowWrap: "anywhere",
});

globalStyle(
  `${root} .stable-rikishi small, ${root} .stable-rikishi-score span`,
  {
    color: vars.muted,
    fontSize: "0.84rem",
  },
);

globalStyle(`${root} .stable-rikishi-score`, {
  minWidth: "92px",
  textAlign: "right",
});

globalStyle(`${root} .stable-rikishi-score strong`, {
  color: vars.indigoDeep,
  fontSize: "1.5rem",
  fontFamily: vars.displayFont,
  fontWeight: 500,
});

globalStyle(`${root}.stable-empty`, {
  display: "grid",
  justifyItems: "start",
  gap: "16px",
  color: vars.muted,
});

globalStyle(`${root}.stable-empty .section-heading`, {
  margin: 0,
});

globalStyle(`${root}`, {
  "@media": {
    "(max-width: 640px)": {
      padding: "20px",
    },
  },
});

globalStyle(`${root} .stable-heading, ${root} .stable-notice`, {
  "@media": {
    "(max-width: 640px)": {
      alignItems: "stretch",
      flexDirection: "column",
    },
  },
});

globalStyle(`${root} .stable-total`, {
  "@media": {
    "(max-width: 640px)": {
      width: "132px",
      textAlign: "left",
    },
  },
});

globalStyle(`${root} .stable-action`, {
  "@media": {
    "(max-width: 640px)": {
      width: "100%",
    },
  },
});

globalStyle(`${root} .stable-picks li`, {
  "@media": {
    "(max-width: 460px)": {
      alignItems: "flex-start",
    },
  },
});

globalStyle(`${root} .stable-rikishi`, {
  "@media": {
    "(max-width: 460px)": {
      alignItems: "flex-start",
    },
  },
});

globalStyle(`${root} .stable-rikishi .rank-pill`, {
  "@media": {
    "(max-width: 460px)": {
      minWidth: 0,
    },
  },
});

globalStyle(`${root} .stable-picks li`, {
  "@media": {
    "(max-width: 360px)": {
      gridTemplateColumns: "1fr",
      gap: "10px",
    },
  },
});

globalStyle(`${root} .stable-matchup`, {
  "@media": {
    "(max-width: 360px)": {
      gridColumn: 1,
    },
  },
});

globalStyle(`${root} .stable-rikishi-score`, {
  "@media": {
    "(max-width: 360px)": {
      display: "flex",
      justifyContent: "space-between",
      width: "100%",
      minWidth: 0,
      textAlign: "left",
    },
  },
});

globalStyle(`${root} .stable-rikishi-score strong`, {
  "@media": {
    "(max-width: 360px)": {
      textAlign: "right",
    },
  },
});

globalStyle(`${root} .stable-picks .score-categories`, {
  gridColumn: "1 / -1",
  width: "100%",
});

globalStyle(`${root} .stable-rikishi strong`, {
  fontFamily: vars.displayFont,
  fontSize: "1.3rem",
  fontWeight: 500,
  lineHeight: 1.2,
});
