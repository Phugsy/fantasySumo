import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

export const summary = style({
  border: `1px solid ${vars.clayLight}`,
  borderTop: `2px solid ${vars.vermilion}`,
  borderRadius: vars.radius,
  background: vars.panel,
  color: vars.ink,
  padding: 20,
  margin: "18px 0",
});
export const kicker = style({
  color: vars.accentText,
  fontWeight: 750,
  fontSize: ".8rem",
  letterSpacing: ".07em",
  textTransform: "uppercase",
  marginBottom: 8,
});
export const recipients = style({
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: 20,
  margin: "18px 0",
  "@media": {
    "(max-width: 540px)": { gridTemplateColumns: "minmax(0,1fr)", gap: 14 },
  },
});
export const group = style({ minWidth: 0 });
globalStyle(`${group} h3`, {
  fontSize: "1rem",
  color: vars.heading,
  margin: "0 0 8px",
});
globalStyle(`${group} ul`, { listStyle: "none", margin: 0, padding: 0 });
globalStyle(`${group} li`, { marginBottom: 10, overflowWrap: "anywhere" });
globalStyle(`${group} strong, ${group} small`, { display: "block" });
globalStyle(`${group} small`, { color: vars.secondaryText, marginTop: 3 });
export const note = style({
  color: vars.secondaryText,
  fontSize: ".88rem",
  margin: "10px 0",
});
export const link = style({
  color: vars.heading,
  textDecoration: "underline",
  textUnderlineOffset: 3,
  fontWeight: 700,
});
export const counts = style({
  display: "flex",
  flexWrap: "wrap",
  gap: "4px 14px",
  fontSize: ".85rem",
  color: vars.secondaryText,
  paddingTop: 5,
});
export const dialog = style({
  width: "min(580px,calc(100% - 32px))",
  maxHeight: "85vh",
  overflowY: "auto",
  padding: 24,
  borderRadius: 6,
  border: `1px solid ${vars.clay}`,
  background: vars.paper,
  color: vars.ink,
  boxShadow: vars.shadow,
  selectors: { "&::backdrop": { background: "rgb(0 0 0 / 55%)" } },
  "@media": { "(max-width: 540px)": { padding: 18 } },
});
globalStyle(`${dialog} h2`, {
  color: vars.heading,
  fontSize: "1.5rem",
  lineHeight: 1.2,
  margin: "0 0 12px",
});
export const actions = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 16,
  marginTop: 20,
});
export const close = style({
  minHeight: 44,
  padding: "10px 18px",
  border: 0,
  borderRadius: 6,
  background: vars.vermilion,
  color: "#fff",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
});
globalStyle(
  `${dialog} button:focus-visible, ${dialog} a:focus-visible, ${link}:focus-visible`,
  { outline: `3px solid ${vars.focus}`, outlineOffset: 4 },
);
export const table = style({
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 16,
});
globalStyle(`${table} th, ${table} td`, {
  padding: "10px 8px",
  borderBottom: `1px solid ${vars.clayLight}`,
  textAlign: "left",
  overflowWrap: "anywhere",
});
