import { style, globalStyle } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";
export const toggle = style({
  display: "none",
  minWidth: 44,
  minHeight: 44,
  borderRadius: 4,
  border: `1px solid ${vars.clayLight}`,
  background: "transparent",
  color: vars.heading,
  fontSize: "1.4rem",
  selectors: {
    "&:focus-visible": { outline: `3px solid ${vars.focus}`, outlineOffset: 3 },
  },
  "@media": {
    "(max-width: 640px)": { display: "block", gridColumn: 2, gridRow: 1 },
  },
});
export const settings = style({
  display: "flex",
  gap: 10,
  alignItems: "center",
  "@media": {
    "(max-width: 640px)": {
      display: "none",
      alignItems: "stretch",
      flexDirection: "column",
      selectors: { '&[data-open="true"]': { display: "flex" } },
    },
  },
});
globalStyle(`${settings} details > div`, {
  "@media": {
    "(max-width: 640px)": {
      position: "static",
      width: "100%",
      marginTop: 8,
    },
  },
});
