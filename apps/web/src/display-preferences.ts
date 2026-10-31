export const DISPLAY_STORAGE_KEY = "fantasy-sumo-display-v1";
export type RikishiOrder = "rank" | "score" | "name";
export type ColourTheme = "system" | "light" | "dark";
export interface DisplayPreferences {
  order: RikishiOrder;
  photos: boolean;
  theme: ColourTheme;
}
export const defaultPreferences: DisplayPreferences = {
  order: "rank",
  photos: false,
  theme: "system",
};

export function parsePreferences(value: string | null): DisplayPreferences {
  try {
    const parsed: unknown = JSON.parse(value ?? "null");
    if (parsed === null || typeof parsed !== "object")
      return defaultPreferences;
    const input = parsed as Record<string, unknown>;
    return {
      order:
        input.order === "score" || input.order === "name"
          ? input.order
          : "rank",
      photos: input.photos === true,
      theme:
        input.theme === "light" || input.theme === "dark"
          ? input.theme
          : "system",
    };
  } catch {
    return defaultPreferences;
  }
}

export function readPreferences(): DisplayPreferences {
  try {
    return parsePreferences(window.localStorage.getItem(DISPLAY_STORAGE_KEY));
  } catch {
    return defaultPreferences;
  }
}

interface SortableRikishi {
  id: string;
  shikona: string;
  rankOrder?: number;
  score?: number;
}

// rankOrder is the imported banzuke order, not an alphabetical rank label.
export function sortRikishi<T extends SortableRikishi>(
  entries: readonly T[],
  order: RikishiOrder,
): T[] {
  const byName = (a: T, b: T) =>
    a.shikona.localeCompare(b.shikona, "en", { sensitivity: "base" }) ||
    a.id.localeCompare(b.id, "en");
  return [...entries].sort((a, b) =>
    order === "name"
      ? byName(a, b)
      : (order === "score"
          ? (b.score ?? 0) - (a.score ?? 0)
          : (a.rankOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.rankOrder ?? Number.MAX_SAFE_INTEGER)) || byName(a, b),
  );
}
