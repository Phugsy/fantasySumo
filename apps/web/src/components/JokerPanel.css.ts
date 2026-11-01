import { style, globalStyle } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";
export const panel = style({
  marginTop: 20,
  padding: 20,
  border: `1px solid ${vars.clayLight}`,
  borderRadius: 12,
  background: vars.panel,
  color: vars.ink,
});
export const field = style({
  display: "grid",
  gap: 6,
  marginBottom: 12,
  fontWeight: 700,
});
export const actions = style({ display: "flex", flexWrap: "wrap", gap: 10 });
globalStyle(`${panel} select, ${panel} input`, {
  minHeight: 44,
  width: "100%",
  padding: 8,
  background: vars.paper,
  color: vars.ink,
  border: `1px solid ${vars.clay}`,
  borderRadius: 6,
  font: "inherit",
});
globalStyle(`${panel} button`, {
  minHeight: 44,
  padding: "10px 16px",
  background: vars.indigo,
  color: "white",
  borderRadius: 6,
  border: `1px solid ${vars.clay}`,
  font: "inherit",
});
globalStyle(`${panel} button:disabled`, {
  background: vars.disabledSurface,
  color: vars.disabledText,
});
globalStyle(`${panel} select:focus-visible, ${panel} button:focus-visible`, {
  outline: `3px solid ${vars.focus}`,
  outlineOffset: 2,
});
