import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";
export const badge = style({});
export const inlineBadge = style({});
export const overlayBadge = style({});
export const full = style({});
export const compact = style({ display: "none" });
export const rankedPortrait = style({});
export const portrait = style({
  position: "relative",
  display: "inline-flex",
  flexShrink: 0,
});
const mobile = "(max-width: 640px)";
export const overlay = style({
  display: "none",
  "@media": {
    [mobile]: {
      display: "block",
      position: "absolute",
      top: 0,
      left: 0,
      zIndex: 1,
    },
  },
});
globalStyle(`${rankedPortrait} ${inlineBadge}`, {
  "@media": { [mobile]: { display: "none" } },
});
globalStyle(`button${rankedPortrait}${rankedPortrait}`, {
  "@media": {
    [mobile]: {
      gridTemplateColumns: "minmax(0, 1fr) auto",
      gridTemplateAreas: '"identity action"',
    },
  },
});
globalStyle(`${overlay} > ${badge}`, {
  "@media": {
    [mobile]: {
      gridArea: "auto",
      background: vars.indigo,
      color: "#fff",
      minWidth: 0,
      padding: "2px 5px",
      fontSize: ".65rem",
      borderRadius: 4,
    },
  },
});
globalStyle(`${rankedPortrait} ${full}`, {
  "@media": { [mobile]: { display: "none" } },
});
globalStyle(`${rankedPortrait} ${compact}`, {
  "@media": { [mobile]: { display: "inline" } },
});
