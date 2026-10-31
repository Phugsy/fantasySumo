import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  defaultPreferences,
  DISPLAY_STORAGE_KEY,
  parsePreferences,
  readPreferences,
} from "./display-preferences";
import type { DisplayPreferences } from "./display-preferences";

const Context = createContext({
  preferences: defaultPreferences,
  update: (patch: Partial<DisplayPreferences>) => {
    void patch;
  },
});

export function DisplayPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [preferences, setPreferences] = useState(readPreferences);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        DISPLAY_STORAGE_KEY,
        JSON.stringify(preferences),
      );
    } catch {
      // Preferences still work for this visit when storage is unavailable.
    }
  }, [preferences]);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        preferences.theme === "system"
          ? media?.matches
            ? "dark"
            : "light"
          : preferences.theme;
    };
    apply();
    media?.addEventListener("change", apply);
    return () => media?.removeEventListener("change", apply);
  }, [preferences.theme]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === DISPLAY_STORAGE_KEY || event.key === null)
        setPreferences(parsePreferences(event.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const update = (patch: Partial<DisplayPreferences>) => {
    setPreferences((previous) => ({ ...previous, ...patch }));
  };
  return (
    <Context.Provider value={{ preferences, update }}>
      {children}
    </Context.Provider>
  );
}

export const useDisplayPreferences = () => useContext(Context);
