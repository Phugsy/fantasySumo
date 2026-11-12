import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css";

export const jokerWin = style({
  background: vars.chartPurple,
  color: vars.paper,
});

export const goldStar = style({
  isolation: "isolate",
  color: "#3e2d00",
  "::before": {
    content: '""',
    position: "absolute",
    inset: 1,
    zIndex: -1,
    background: "#f5c54b",
    clipPath:
      "polygon(50% 0, 65% 29%, 100% 34%, 77% 59%, 81% 94%, 50% 80%, 19% 94%, 23% 59%, 0 34%, 35% 29%)",
  },
});
