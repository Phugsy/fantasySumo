import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

export const identity = style({
  display: "flex",
  gap: 10,
  alignItems: "center",
  minWidth: 0,
});
export const frame = style({
  display: "inline-grid",
  placeItems: "center",
  flexShrink: 0,
  width: 48,
  height: 56,
  overflow: "hidden",
  borderRadius: 6,
  background: vars.paperWarm,
  color: vars.muted,
  border: `1px solid ${vars.clayLight}`,
  fontSize: ".7rem",
  fontWeight: 700,
});
export const image = style({
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "contain",
});
export const credits = style({
  marginTop: 12,
  fontSize: ".75rem",
  color: vars.muted,
});
globalStyle(`${credits} a`, { color: vars.focus });
