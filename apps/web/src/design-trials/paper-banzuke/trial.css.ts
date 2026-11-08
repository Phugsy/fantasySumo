import {
  createTheme,
  createThemeContract,
  globalStyle,
  style,
} from "@vanilla-extract/css";
import { vars } from "../../styles/theme.css";

const trial = createThemeContract({
  paper: null,
  surface: null,
  ink: null,
  muted: null,
  rule: null,
  mount: null,
  accent: null,
});
export const light = createTheme(trial, {
  paper: "#f4edde",
  surface: "#fffaf0",
  ink: "#263744",
  muted: "#57636b",
  rule: "#a89a84",
  mount: "#e6ddca",
  accent: "#943c2f",
});
export const dark = createTheme(trial, {
  paper: "#161e26",
  surface: "#202b35",
  ink: "#eee9dd",
  muted: "#bfc5c6",
  rule: "#74808a",
  mount: "#d9cfba",
  accent: "#ffb19e",
});

export const root = style({
  minHeight: "100vh",
  padding: "36px clamp(16px, 4vw, 56px) 44px",
  margin: "0 auto",
  maxWidth: 1600,
  color: vars.ink,
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  lineHeight: 1.5,
});
// This file is imported only by the separate trial entry; production globals stay intact.
globalStyle("*", { boxSizing: "border-box" });
globalStyle("body", {
  margin: 0,
  minWidth: 320,
  background: vars.canvas,
  color: vars.ink,
});
globalStyle(`${root} button, ${root} input`, { font: "inherit" });
globalStyle(`${root} button`, { cursor: "pointer" });
globalStyle(
  `${root} button:focus-visible, ${root} a:focus-visible, ${root} summary:focus-visible`,
  { outline: `3px solid ${vars.focus}`, outlineOffset: 4 },
);
globalStyle(`${root} a`, { color: vars.heading });
globalStyle(`${root} h1, ${root} h2, ${root} h3, ${root} h4, ${root} p`, {
  margin: 0,
});

export const intro = style({
  display: "flex",
  alignItems: "start",
  justifyContent: "space-between",
  gap: 24,
  marginBottom: 28,
  "@media": { "(max-width: 640px)": { flexDirection: "column", gap: 12 } },
});
export const kicker = style({
  color: vars.secondaryText,
  fontSize: 11,
  fontWeight: 750,
  letterSpacing: ".13em",
  textTransform: "uppercase",
});
globalStyle(`${intro} h1`, {
  fontFamily: 'Georgia, "Times New Roman", serif',
  color: vars.heading,
  fontSize: "clamp(28px, 3.7vw, 48px)",
  lineHeight: 1.12,
  fontWeight: 500,
  letterSpacing: "-.035em",
  margin: "8px 0 12px",
});
export const lede = style({
  color: vars.secondaryText,
  maxWidth: 720,
  fontSize: 14,
});
export const trialMark = style({
  whiteSpace: "nowrap",
  border: `1px solid ${vars.clay}`,
  color: vars.secondaryText,
  padding: "6px 12px",
  fontSize: 12,
  borderRadius: 4,
});
export const controls = style({
  display: "flex",
  gap: "16px 28px",
  flexWrap: "wrap",
  padding: "18px 0 24px",
  borderTop: `1px solid ${vars.clayLight}`,
  borderBottom: `1px solid ${vars.clayLight}`,
  marginBottom: 30,
});
export const controlGroup = style({
  display: "flex",
  flexWrap: "wrap",
  gap: 5,
  border: 0,
  padding: 0,
  margin: 0,
  minWidth: 0,
});
globalStyle(`${controlGroup} legend`, {
  fontSize: 11,
  fontWeight: 750,
  textTransform: "uppercase",
  letterSpacing: ".08em",
  color: vars.secondaryText,
  padding: 0,
  marginBottom: 7,
});
globalStyle(`${controlGroup} button`, {
  border: `1px solid ${vars.clay}`,
  background: vars.surface,
  color: vars.ink,
  borderRadius: 6,
  minHeight: 44,
  padding: "8px 13px",
  fontSize: 13,
});
globalStyle(`${controlGroup} button[aria-pressed="true"]`, {
  color: vars.paper,
  background: vars.heading,
  borderColor: vars.heading,
});
// The shared dark theme heading is pale; pair its selected fill with dark paper.
export const comparison = style({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 30,
  "@media": {
    "(max-width: 860px)": { gridTemplateColumns: "minmax(0, 1fr)", gap: 36 },
  },
});
export const column = style({ minWidth: 0 });
export const variantLabel = style({
  minHeight: 80,
  display: "flex",
  flexDirection: "column",
  gap: 5,
});
globalStyle(`${variantLabel} h2`, {
  fontSize: 16,
  fontWeight: 750,
  color: vars.heading,
});
globalStyle(`${variantLabel} p`, {
  fontSize: 12,
  color: vars.secondaryText,
  maxWidth: 520,
});
export const preview = style({
  padding: "22px clamp(12px, 2vw, 26px) 18px",
  minWidth: 0,
  border: `1px solid ${vars.clayLight}`,
  overflowWrap: "anywhere",
});
export const reference = style({
  background: vars.canvas,
  color: vars.ink,
  borderRadius: 12,
});
export const paper = style({
  background: trial.paper,
  color: trial.ink,
  border: `1px solid ${trial.rule}`,
  borderRadius: 2,
  boxShadow: "0 10px 24px rgb(0 0 0 / 6%)",
  backgroundImage:
    "repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgb(110 92 61 / 2%) 3px, rgb(110 92 61 / 2%) 4px)",
});
export const masthead = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  paddingBottom: 18,
  borderBottom: `1px solid ${vars.clayLight}`,
});
export const wordmark = style({
  color: vars.heading,
  fontSize: 18,
  fontWeight: 850,
  letterSpacing: "-.04em",
});
globalStyle(`${wordmark} > span`, { color: vars.accentText });
export const edition = style({
  color: vars.secondaryText,
  fontSize: 11,
  textAlign: "right",
  lineHeight: 1.55,
  letterSpacing: ".04em",
});
export const pageHeading = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "25px 0 22px",
});
globalStyle(`${pageHeading} h3`, {
  color: vars.heading,
  fontSize: "clamp(26px, 3vw, 36px)",
  lineHeight: 1.1,
  letterSpacing: "-.04em",
  marginTop: 7,
});
export const stamp = style({
  color: vars.accentText,
  border: "2px solid currentColor",
  borderRadius: 3,
  padding: 4,
  fontSize: 15,
  writingMode: "vertical-rl",
  letterSpacing: ".08em",
  transform: "rotate(-5deg)",
  opacity: 0.85,
});
export const panel = style({
  background: vars.panel,
  border: `1px solid ${vars.clayLight}`,
  borderRadius: 12,
  padding: "18px clamp(10px, 1.6vw, 20px)",
  boxShadow: vars.shadow,
});
export const panelHeading = style({
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "center",
  paddingBottom: 18,
});
globalStyle(`${panelHeading} h4`, {
  color: vars.heading,
  fontSize: 19,
  fontWeight: 750,
  lineHeight: 1.2,
});
globalStyle(`${panelHeading} p`, {
  color: vars.secondaryText,
  fontSize: 11,
  marginTop: 5,
});
export const total = style({
  display: "flex",
  flexDirection: "column",
  textAlign: "right",
  flexShrink: 0,
  color: vars.positiveText,
  padding: "7px 10px",
  border: `1px solid ${vars.positiveBorder}`,
  background: vars.mossLight,
  borderRadius: 8,
  minWidth: 72,
});
globalStyle(`${total} strong`, {
  fontSize: 30,
  lineHeight: 1.1,
  fontVariantNumeric: "tabular-nums",
});
globalStyle(`${total} > span`, { fontSize: 11, fontWeight: 650, marginTop: 3 });
export const jokerNotice = style({
  display: "flex",
  gap: 10,
  alignItems: "center",
  marginBottom: 20,
  padding: "11px 12px",
  background: vars.paperWarm,
  border: `1px solid ${vars.clayLight}`,
  borderRadius: 8,
});
globalStyle(`${jokerNotice} strong`, {
  display: "block",
  fontSize: 12,
  color: vars.heading,
});
globalStyle(`${jokerNotice} div > span`, {
  display: "block",
  fontSize: 11,
  color: vars.secondaryText,
  marginTop: 3,
});
export const jokerSymbol = style({
  color: vars.accentText,
  fontFamily: "Georgia, serif",
  fontWeight: 700,
  fontSize: 21,
  border: "1px solid currentColor",
  borderRadius: 3,
  padding: "0 7px",
  transform: "rotate(-6deg)",
});
export const list = style({
  display: "grid",
  gap: 9,
  margin: 0,
  padding: 0,
  listStyle: "none",
});
export const row = style({
  display: "flex",
  alignItems: "center",
  gap: "clamp(8px, 1.2vw, 14px)",
  width: "100%",
  minWidth: 0,
  minHeight: 102,
  textAlign: "left",
  color: vars.ink,
  background: vars.surface,
  border: `1px solid ${vars.clayLight}`,
  borderRadius: 9,
  padding: "12px clamp(8px, 1vw, 12px)",
  selectors: {
    '&[aria-pressed="true"]': {
      borderColor: vars.vermilion,
      background: vars.selected,
      boxShadow: `inset 3px 0 0 ${vars.vermilion}`,
    },
    "button&:hover": { outline: `1px solid ${vars.focus}`, outlineOffset: 1 },
  },
  "@media": { "(max-width: 420px)": { gap: 8, padding: "10px 8px" } },
});
export const identity = style({ flex: "1 1 0", minWidth: 0 });
globalStyle(`${identity} > strong`, {
  display: "block",
  color: vars.heading,
  fontSize: 17,
  lineHeight: 1.2,
  margin: "5px 0 3px",
  overflowWrap: "anywhere",
});
export const rank = style({
  display: "inline-block",
  fontSize: 11,
  fontWeight: 750,
  color: "#fff",
  background: vars.indigo,
  padding: "3px 7px",
  borderRadius: 20,
  lineHeight: 1.4,
});
export const secondary = style({
  display: "block",
  fontSize: 11,
  color: vars.secondaryText,
});
export const opponent = style({
  display: "block",
  fontSize: 11,
  color: vars.secondaryText,
  marginTop: 6,
});
export const portraitMount = style({
  display: "flex",
  flexShrink: 0,
  borderRadius: 6,
});
export const portraitFrame = style({
  display: "block",
  width: 58,
  height: 76,
  overflow: "hidden",
  background: vars.paperWarm,
  border: `1px solid ${vars.clayLight}`,
  borderRadius: 6,
  "@media": { "(max-width: 420px)": { width: 48, height: 64 } },
});
export const inkImage = style({
  width: "100%",
  height: "100%",
  display: "block",
  objectFit: "cover",
  transform: "scale(1.04)",
});
export const photoImage = style({
  width: "100%",
  height: "100%",
  display: "block",
  objectFit: "contain",
});
export const rowPoints = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "end",
  minWidth: 24,
  flexShrink: 0,
  color: vars.heading,
  fontVariantNumeric: "tabular-nums",
});
globalStyle(`${rowPoints} strong`, { fontSize: 23, lineHeight: 1.1 });
globalStyle(`${rowPoints} > span`, { color: vars.secondaryText, fontSize: 11 });
export const pickMark = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  fontSize: 11,
  fontWeight: 750,
  color: vars.positiveText,
  background: vars.mossLight,
  border: `1px solid ${vars.positiveBorder}`,
  borderRadius: 5,
  padding: "7px 6px",
  flexShrink: 0,
  minWidth: 47,
  textAlign: "center",
  "@media": {
    "(max-width: 420px)": { minWidth: 36, minHeight: 36, padding: 5 },
  },
});
export const pickText = style({
  "@media": { "(max-width: 420px)": { display: "none" } },
});
export const record = style({ whiteSpace: "nowrap" });
export const picked = style({
  color: "#fff",
  background: vars.vermilion,
  borderColor: vars.vermilion,
});
export const footnote = style({
  color: vars.secondaryText,
  fontSize: 11,
  paddingTop: 16,
});
export const previewFooter = style({
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: vars.secondaryText,
  fontSize: 11,
  marginTop: 22,
  paddingTop: 12,
  borderTop: `1px solid ${vars.clayLight}`,
});
export const status = style({
  minHeight: 22,
  marginTop: "18px !important",
  fontSize: 12,
  color: vars.secondaryText,
});
export const reviewNotes = style({
  maxWidth: 850,
  marginTop: 20,
  paddingTop: 18,
  borderTop: `1px solid ${vars.clayLight}`,
  fontSize: 13,
  color: vars.secondaryText,
});
globalStyle(`${reviewNotes} h2`, {
  fontSize: 15,
  marginBottom: 7,
  color: vars.heading,
});
globalStyle(`${reviewNotes} summary`, {
  padding: "14px 0 8px",
  cursor: "pointer",
  color: vars.heading,
  minHeight: 44,
});
globalStyle(`${reviewNotes} li`, { paddingBottom: 5 });

// Every alternative rule is scoped to the proposal panel. The reference uses
// the existing theme contract; neither is imported by the production entry.
globalStyle(`${paper} ${masthead}`, {
  borderBottom: `3px double ${trial.rule}`,
});
globalStyle(`${paper} ${wordmark}`, {
  fontFamily: 'Georgia, "Times New Roman", serif',
  color: trial.ink,
  fontWeight: 500,
  fontSize: 21,
});
globalStyle(`${paper} ${pageHeading} h3`, {
  fontFamily: 'Georgia, "Times New Roman", serif',
  color: trial.ink,
  fontWeight: 500,
  fontSize: "clamp(30px, 3.2vw, 40px)",
});
globalStyle(
  `${paper} ${kicker}, ${paper} ${edition}, ${paper} ${previewFooter}`,
  { color: trial.muted },
);
globalStyle(`${paper} ${panel}`, {
  borderRadius: 2,
  boxShadow: "none",
  background: trial.surface,
  borderColor: trial.rule,
});
globalStyle(`${paper} ${panelHeading} h4`, {
  color: trial.ink,
  fontFamily: "Georgia, serif",
  fontWeight: 500,
  fontSize: 23,
});
globalStyle(
  `${paper} ${panelHeading} p, ${paper} ${secondary}, ${paper} ${opponent}, ${paper} ${footnote}`,
  { color: trial.muted },
);
globalStyle(`${paper} ${total}`, {
  color: trial.ink,
  background: "transparent",
  border: 0,
  borderRadius: 0,
  padding: "2px 0 2px 12px",
  borderLeft: `1px solid ${trial.rule}`,
});
globalStyle(`${paper} ${total} strong`, {
  fontFamily: "Georgia, serif",
  fontWeight: 500,
  fontSize: 34,
});
globalStyle(`${paper} ${list}`, {
  gap: 0,
  borderTop: `1px solid ${trial.rule}`,
});
globalStyle(`${paper} ${row}`, {
  border: 0,
  borderBottom: `1px solid ${trial.rule}`,
  borderRadius: 0,
  background: "transparent",
  padding: "14px 0",
  minHeight: 116,
});
globalStyle(`${paper} ${row}[aria-pressed="true"]`, {
  background: vars.selected,
  boxShadow: `inset 3px 0 0 ${vars.vermilion}`,
  paddingLeft: 8,
  paddingRight: 6,
});
globalStyle(`${paper} ${rank}`, {
  padding: 0,
  borderRadius: 0,
  background: "transparent",
  color: trial.muted,
  fontSize: 11,
  letterSpacing: ".015em",
});
globalStyle(`${paper} ${identity} > strong`, {
  color: trial.ink,
  fontFamily: "Georgia, serif",
  fontWeight: 500,
  fontSize: 23,
  margin: "4px 0",
  "@media": { "(max-width: 420px)": { fontSize: 20 } },
});
globalStyle(`${paper} ${portraitMount}`, {
  padding: 3,
  background: trial.mount,
  border: `1px solid ${trial.rule}`,
  borderRadius: 2,
});
globalStyle(`${paper} ${portraitFrame}`, {
  borderRadius: 0,
  border: 0,
  background: trial.mount,
});
globalStyle(`${paper} ${inkImage}`, {
  objectFit: "cover",
  transform: "scale(1.04)",
});
globalStyle(`${paper} ${rowPoints}`, { color: trial.ink });
globalStyle(`${paper} ${rowPoints} strong`, {
  fontFamily: "Georgia, serif",
  fontWeight: 500,
  fontSize: 28,
});
globalStyle(`${paper} ${rowPoints} > span`, { color: trial.muted });
globalStyle(`${paper} ${stamp}, ${paper} ${wordmark} > span`, {
  color: trial.accent,
});
globalStyle(`${paper} ${jokerNotice}`, {
  borderRadius: 2,
  background: "transparent",
  borderColor: trial.rule,
});
globalStyle(`${paper} ${jokerNotice} strong`, { color: trial.ink });
globalStyle(`${paper} ${jokerNotice} div > span`, { color: trial.muted });
globalStyle(`${paper} ${previewFooter}`, { borderColor: trial.rule });
