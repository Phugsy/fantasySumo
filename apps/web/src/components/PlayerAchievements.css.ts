import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

export const collection = style({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
  gap: 10,
  padding: 0,
  margin: 0,
  listStyle: "none",
});

export const card = style({
  display: "grid",
  gridTemplateColumns: "48px minmax(0, 1fr)",
  alignItems: "start",
  gap: 12,
  padding: 12,
  border: `1px solid ${vars.clayLight}`,
  borderRadius: vars.radius,
  background: vars.surface,
});

export const seal = style({
  display: "grid",
  placeItems: "center",
  width: 48,
  height: 48,
  border: `1px solid ${vars.clay}`,
  borderRadius: "50%",
  background: vars.paperWarm,
  fontSize: "1.4rem",
  filter: "grayscale(1)",
});

export const earnedSeal = style([
  seal,
  {
    borderColor: vars.warningBorder,
    background: vars.warningSurface,
    filter: "none",
  },
]);

export const name = style({
  margin: 0,
  fontFamily: vars.displayFont,
  fontSize: "1.1rem",
});

export const description = style({
  margin: "2px 0",
  color: vars.secondaryText,
});
export const status = style({ margin: 0, fontSize: "0.85rem" });
