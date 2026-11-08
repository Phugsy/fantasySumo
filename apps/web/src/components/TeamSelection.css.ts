import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

// Keep the component layout and state selectors scoped to its own root.
export const root = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 340px",
  gap: "24px",
  alignItems: "start",
  marginTop: "24px",
});

globalStyle(`${root} .rikishi-section, ${root} .summary-panel`, {
  padding: "22px",
});

globalStyle(`${root} .summary-panel`, {
  position: "sticky",
  top: "99px",
});

globalStyle(`${root} .rikishi-list`, {
  display: "grid",
  gap: 0,
  borderTop: `1px solid ${vars.clayLight}`,
});

globalStyle(`${root} .rikishi-row`, {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 82px",
  gap: "14px",
  alignItems: "center",
  width: "100%",
  minWidth: 0,
  minHeight: "72px",
  padding: "16px 12px",
  border: "0",
  borderRadius: 0,
  background: "transparent",
  color: vars.ink,
  textAlign: "left",
  transition:
    "border-color 120ms ease, box-shadow 120ms ease, background 120ms ease",
  borderBottom: `1px solid ${vars.clayLight}`,
});

globalStyle(`${root} .rikishi-row:hover:not(:disabled)`, {
  borderColor: vars.clayLight,
  background: vars.hover,
});

globalStyle(`${root} .rikishi-row[aria-pressed="true"]`, {
  borderColor: vars.clayLight,
  background: vars.selected,
  boxShadow: `inset 4px 0 0 ${vars.vermilion}`,
});

globalStyle(`${root} .rikishi-row:disabled`, {
  opacity: 0.52,
});

globalStyle(`${root} .rikishi-row > .rikishi-identity`, {
  minWidth: 0,
});

globalStyle(`${root} .rikishi-row strong, ${root} .rikishi-row small`, {
  display: "block",
  overflowWrap: "anywhere",
});

globalStyle(`${root} .rikishi-row strong`, {
  color: vars.indigoDeep,
});

globalStyle(`${root} .rikishi-row small`, {
  marginTop: "2px",
  color: vars.muted,
});

globalStyle(`${root} .rikishi-row .previous-basho-record`, {
  marginTop: "6px",
  color: vars.secondaryText,
  fontSize: "0.76rem",
  fontWeight: 700,
  lineHeight: 1.35,
});

globalStyle(`${root} .rikishi-row .previous-basho-record.unavailable`, {
  color: vars.muted,
  fontWeight: 650,
});

globalStyle(`${root} .pick-mark`, {
  display: "inline-grid",
  placeItems: "center",
  justifySelf: "end",
  minWidth: "74px",
  minHeight: "38px",
  padding: "7px 8px",
  border: `1px solid ${vars.positiveBorder}`,
  borderRadius: 4,
  background: vars.mossLight,
  color: vars.positiveText,
  fontSize: "0.8rem",
  fontWeight: 700,
  textAlign: "center",
});

globalStyle(`${root} .pick-mark.selected`, {
  borderColor: vars.vermilion,
  background: vars.vermilion,
  color: "#ffffff",
});

globalStyle(
  `${root} .rikishi-row:focus-visible, ${root} .selected-list button:focus-visible`,
  {
    outline: `3px solid ${vars.focus}`,
    outlineOffset: "3px",
  },
);

globalStyle(`${root} .selected-list`, {
  display: "grid",
  gap: "8px",
  minHeight: "116px",
  margin: "18px 0",
  padding: 0,
  listStyle: "none",
});

globalStyle(`${root} .selected-list li`, {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  minHeight: "50px",
  padding: "10px 12px",
  border: `1px solid ${vars.positiveBorder}`,
  borderRadius: 4,
  background: vars.mossLight,
  color: vars.ink,
  fontWeight: 800,
});

globalStyle(`${root} .selected-list button`, {
  minWidth: "78px",
  minHeight: "38px",
  border: `1px solid ${vars.negativeBorder}`,
  borderRadius: 4,
  background: vars.surface,
  color: vars.accentText,
  fontSize: "0.8rem",
  fontWeight: 850,
});

globalStyle(`${root} .selected-list .empty-pick`, {
  border: `1px dashed ${vars.clay}`,
  background: "transparent",
  color: vars.muted,
  fontWeight: 700,
});

globalStyle(`${root} .selection-actions`, {
  display: "flex",
  gap: "10px",
});

globalStyle(`${root} .selection-actions .submit-button`, {
  flex: 1,
  width: "auto",
});

globalStyle(`${root}`, {
  "@media": {
    "(max-width: 920px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

globalStyle(`${root} .summary-panel`, {
  "@media": {
    "(max-width: 920px)": {
      position: "static",
      order: -1,
    },
  },
});

globalStyle(`${root} .rikishi-section, ${root} .summary-panel`, {
  "@media": {
    "(max-width: 640px)": {
      padding: "18px",
    },
  },
});

globalStyle(`${root} .rikishi-row`, {
  "@media": {
    "(max-width: 640px)": {
      gridTemplateAreas: '"identity action"',
      gridTemplateColumns: "minmax(0, 1fr) auto",
      gap: "5px 10px",
      minHeight: "80px",
    },
  },
});

globalStyle(`${root} .rikishi-row > .rikishi-identity`, {
  "@media": {
    "(max-width: 640px)": {
      gridArea: "identity",
    },
  },
});

globalStyle(`${root} .pick-mark`, {
  "@media": {
    "(max-width: 640px)": {
      gridArea: "action",
      minHeight: "44px",
    },
  },
});

globalStyle(`${root}`, {
  "@media": {
    "(max-width: 460px)": {
      gap: "16px",
      marginTop: "16px",
    },
  },
});

globalStyle(`${root} .rikishi-section, ${root} .summary-panel`, {
  "@media": {
    "(max-width: 460px)": {
      padding: "14px",
    },
  },
});

globalStyle(`${root} .rikishi-row`, {
  "@media": {
    "(max-width: 460px)": {
      padding: "11px",
    },
  },
});

globalStyle(`${root} .rikishi-row strong`, {
  fontFamily: vars.displayFont,
  fontSize: "1.3rem",
  fontWeight: 500,
  lineHeight: 1.2,
});
