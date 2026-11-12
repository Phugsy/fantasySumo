import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

export const jokerWin = style({
  background: vars.chartPurple,
  color: vars.paper,
});

export const withCornerMark = style({ paddingTop: 8 });

const cornerMark = style({
  position: "absolute",
  top: 2,
  fontSize: "0.625rem",
  lineHeight: 1,
});

export const jokerMark = style([cornerMark, { left: 3 }]);

export const goldStar = style([
  cornerMark,
  {
    right: 2,
    color: vars.warningText,
    background: vars.warningSurface,
    borderRadius: "50%",
  },
]);
