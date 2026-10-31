import type { RikishiSourceIdentity } from "@fantasy-sumo/db";

export interface RikishiPhoto {
  url: string;
  sourceUrl: string;
  author: string;
  license: string;
  licenseUrl?: string;
}

const commonsLicense = {
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
};

// Curated source identities, not mutable shikona. Missing mappings stay unknown.
// File/author/license and provider IDs verified on 31 October 2026.
const photos: Record<string, RikishiPhoto> = {
  "8850": {
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/Oonosato.jpg/250px-Oonosato.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Oonosato.jpg",
    author: "Nigtkn",
    ...commonsLicense,
  },
  "19": {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Hoshoryu_Tomokatsu20220115.jpg/330px-Hoshoryu_Tomokatsu20220115.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Hoshoryu_Tomokatsu20220115.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
};

export function getRikishiPhoto(
  rikishiId: string,
  isDemo: boolean,
  aliases: readonly RikishiSourceIdentity[],
): RikishiPhoto | undefined {
  if (isDemo) {
    // A real image, a deliberately failed image, and unmapped rows exercise
    // every display state without contacting an external service in E2E.
    if (rikishiId !== "onosato" && rikishiId !== "hoshoryu") return undefined;
    return {
      url:
        rikishiId === "onosato"
          ? "/demo/rikishi.svg"
          : "/demo/unavailable-rikishi.svg",
      sourceUrl: "/demo/rikishi.svg",
      author: "Fantasy Sumo",
      license: "Demo illustration",
    };
  }
  const alias = aliases.find(
    (entry) => entry.rikishiId === rikishiId && entry.source === "sumo-api",
  );
  return alias === undefined ? undefined : photos[alias.sourceRikishiId];
}
