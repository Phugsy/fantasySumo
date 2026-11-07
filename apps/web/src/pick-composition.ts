import {
  validatePickComposition,
  type PickCompositionMode,
} from "@fantasy-sumo/domain";
import type { RankedRikishi } from "./types";

export function getSelectionErrors(
  mode: PickCompositionMode | undefined,
  selectedIds: readonly string[],
  rikishi: readonly RankedRikishi[],
) {
  if (mode !== "heya-sanyaku-v1") return [];
  return validatePickComposition(
    selectedIds,
    rikishi.map((entry) => ({
      rikishiId: entry.id,
      rank: entry.rank,
      heya: entry.heya,
    })),
  ).map((error) => ({
    ...error,
    message:
      error.code === "invalid-selection-data"
        ? `Verified rank and heya unavailable for ${rikishi.find((entry) => entry.id === error.rikishiId)?.shikona ?? "this rikishi"}.`
        : error.message,
  }));
}
