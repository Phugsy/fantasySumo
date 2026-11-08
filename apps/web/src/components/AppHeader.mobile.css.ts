import { style } from "@vanilla-extract/css";

export const mobileInputHeader = style({
  "@media": {
    "(max-width: 640px)": {
      selectors: {
        ':root[data-mobile-input-focused="true"] &': { position: "static" },
      },
    },
  },
});
