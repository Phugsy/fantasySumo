import { useEffect } from "react";

// iOS can shrink/pan the visual viewport while leaving the layout viewport
// unchanged. Keep an actively edited field inside the visible area.
export function useMobileInputVisibility() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const input = document.activeElement;
        const editing =
          window.matchMedia("(max-width: 640px)").matches &&
          ((input instanceof HTMLInputElement &&
            !["checkbox", "radio", "button", "submit"].includes(input.type)) ||
            input instanceof HTMLTextAreaElement);
        if (!editing) {
          delete document.documentElement.dataset.mobileInputFocused;
          return;
        }
        document.documentElement.dataset.mobileInputFocused = "true";
        const rect = input.getBoundingClientRect();
        const top = viewport.offsetTop + 16;
        const bottom = viewport.offsetTop + viewport.height - 16;
        if (rect.top < top)
          window.scrollBy({ top: rect.top - top, behavior: "instant" });
        else if (rect.bottom > bottom)
          window.scrollBy({ top: rect.bottom - bottom, behavior: "instant" });
      });
    };
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    viewport.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      viewport.removeEventListener("resize", update);
      delete document.documentElement.dataset.mobileInputFocused;
    };
  }, []);
}
