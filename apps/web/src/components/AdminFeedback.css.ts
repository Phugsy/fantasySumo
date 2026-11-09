import { style, globalStyle } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";
export const feedback = style({
  position: "fixed",
  pointerEvents: "none",
  zIndex: 40,
  bottom: "max(16px, env(safe-area-inset-bottom))",
  right: 16,
  width: "min(480px, calc(100vw - 32px))",
  maxHeight: "45dvh",
  overflowY: "auto",
});
globalStyle(`${feedback} > p`, { margin: 0, boxShadow: vars.shadow });
globalStyle(`${feedback} button`, {
  pointerEvents: "auto",
  justifySelf: "start",
  width: "max-content",
  display: "block",
  minHeight: 44,
  marginTop: 8,
  padding: "8px 12px",
  background: vars.paper,
  color: vars.ink,
  border: `1px solid ${vars.clay}`,
  borderRadius: 6,
});
globalStyle(`${feedback} button:focus-visible`, {
  outline: `3px solid ${vars.focus}`,
  outlineOffset: -3,
});
