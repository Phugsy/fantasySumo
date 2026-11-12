import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

export const panel = style({
  border: `1px solid ${vars.clayLight}`,
  borderRadius: vars.radius,
  background: vars.paperWarm,
  padding: "10px 14px",
  margin: "12px 0",
});

export const summary = style({
  cursor: "pointer",
  color: vars.heading,
  fontWeight: 700,
});

export const columns = style({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
  gap: 14,
  marginTop: 12,
});

export const heading = style({ margin: 0, fontSize: "1rem" });

export const note = style({
  color: vars.secondaryText,
  fontSize: "0.875rem",
  margin: "4px 0",
});

export const awards = style({ listStyle: "none", padding: 0, margin: "8px 0" });
globalStyle(`${awards} li`, { marginBottom: 8 });
globalStyle(`${awards} span`, { display: "block", color: vars.secondaryText });

export const prizes = style({ display: "grid", gap: 8, margin: "8px 0" });
globalStyle(`${prizes} dt`, { fontWeight: 700 });
globalStyle(`${prizes} dd`, { margin: 0 });
