import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

export const root = style({ position: "relative", color: vars.ink });
export const summary = style({
  minHeight: 42,
  padding: "10px 12px",
  border: "1px solid rgb(255 255 255 / 28%)",
  borderRadius: 8,
  color: "#fff",
  cursor: "pointer",
  fontSize: ".82rem",
  fontWeight: 800,
  selectors: {
    "&:focus-visible": { outline: `3px solid ${vars.focus}`, outlineOffset: 3 },
  },
});
export const panel = style({
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  zIndex: 30,
  display: "grid",
  gap: 12,
  width: "min(290px, calc(100vw - 32px))",
  padding: 16,
  border: `1px solid ${vars.clay}`,
  borderRadius: 10,
  background: vars.paper,
  boxShadow: vars.shadow,
});
export const field = style({
  display: "grid",
  gap: 5,
  fontSize: ".85rem",
  fontWeight: 750,
});
export const select = style({
  width: "100%",
  minHeight: 44,
  padding: 8,
  font: "inherit",
  color: vars.ink,
  background: vars.paper,
  border: `1px solid ${vars.clay}`,
  borderRadius: 6,
  selectors: {
    "&:focus-visible": { outline: `3px solid ${vars.focus}`, outlineOffset: 2 },
  },
});
export const checkbox = style({
  display: "flex",
  gap: 8,
  alignItems: "center",
  fontSize: ".85rem",
});
export const input = style({ width: 22, height: 22, minHeight: 22, margin: 0 });
