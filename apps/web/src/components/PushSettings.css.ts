import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";
export const root = style({
  background: vars.panel,
  color: vars.ink,
  border: `1px solid ${vars.clayLight}`,
  borderRadius: vars.radius,
  padding: "1.25rem",
  display: "grid",
  gap: "0.75rem",
});
export const heading = style({
  fontSize: "1.1rem",
  margin: 0,
  color: vars.heading,
});
export const text = style({
  margin: 0,
  lineHeight: 1.6,
  color: vars.secondaryText,
});
export const controls = style({
  display: "flex",
  flexWrap: "wrap",
  gap: "0.75rem",
});
export const button = style({
  padding: "0.6rem 0.85rem",
  border: `1px solid ${vars.indigo}`,
  borderRadius: "0.4rem",
  background: vars.surface,
  color: vars.indigo,
  cursor: "pointer",
  font: "inherit",
  selectors: {
    "&:disabled": {
      background: vars.disabledSurface,
      color: vars.disabledText,
      cursor: "default",
    },
    "&:focus-visible": { outline: `3px solid ${vars.focus}`, outlineOffset: 3 },
  },
});
