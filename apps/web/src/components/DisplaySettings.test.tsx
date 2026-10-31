import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DisplayPreferencesProvider } from "../DisplayPreferences";
import { DISPLAY_STORAGE_KEY } from "../display-preferences";
import { DisplaySettings } from "./DisplaySettings";

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});
describe("display settings", () => {
  it("restores preferences, follows system changes and preserves an explicit choice", () => {
    let matches = true;
    let changed = () => {};
    vi.stubGlobal("matchMedia", () => ({
      get matches() {
        return matches;
      },
      addEventListener: (_name: string, listener: () => void) => {
        changed = listener;
      },
      removeEventListener: vi.fn(),
    }));
    window.localStorage.setItem(
      DISPLAY_STORAGE_KEY,
      JSON.stringify({ theme: "system", photos: true, order: "score" }),
    );
    const view = render(
      <DisplayPreferencesProvider>
        <DisplaySettings />
      </DisplayPreferencesProvider>,
    );
    fireEvent.click(screen.getByText("Display"));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(screen.getByLabelText("Show rikishi photos")).toBeChecked();
    expect(screen.getByLabelText("Rikishi order")).toHaveValue("score");
    matches = false;
    changed();
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    fireEvent.change(screen.getByLabelText("Colour theme"), {
      target: { value: "dark" },
    });
    matches = false;
    changed();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    fireEvent.change(screen.getByLabelText("Rikishi order"), {
      target: { value: "name" },
    });
    expect(
      JSON.parse(window.localStorage.getItem(DISPLAY_STORAGE_KEY)!),
    ).toMatchObject({ theme: "dark", order: "name" });
    view.unmount();
    render(
      <DisplayPreferencesProvider>
        <DisplaySettings />
      </DisplayPreferencesProvider>,
    );
    expect(screen.getByLabelText("Rikishi order")).toHaveValue("name");
  });

  it("allows changes when storage is blocked", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(
      <DisplayPreferencesProvider>
        <DisplaySettings />
      </DisplayPreferencesProvider>,
    );
    fireEvent.click(screen.getByText("Display"));
    fireEvent.change(screen.getByLabelText("Colour theme"), {
      target: { value: "dark" },
    });
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});
