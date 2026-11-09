import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

// The container owns the space between consecutive blocks, including optional ones.
export const stack = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: vars.sectionGap,
  minWidth: 0,
});
globalStyle(`${stack}${stack} > *`, { marginBlock: 0, minWidth: 0 });
