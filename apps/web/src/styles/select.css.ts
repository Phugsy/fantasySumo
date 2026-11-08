import { style } from "@vanilla-extract/css";

// Keep the native select behaviour, with a consistently inset decorative arrow.
export const selectControl = style({
  selectors: {
    "&:not([multiple])": {
      appearance: "none",
      paddingInlineEnd: 40,
      backgroundImage:
        "linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%)",
      backgroundPosition: "right 18px center, right 13px center",
      backgroundSize: "5px 5px",
      backgroundRepeat: "no-repeat",
    },
  },
  "@media": {
    "(forced-colors: active)": {
      selectors: {
        "&:not([multiple])": { appearance: "auto", backgroundImage: "none" },
      },
    },
  },
});
