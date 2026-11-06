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

const commonsPublicDomain = {
  license: "CC0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
};

// Wikimedia Commons thumbnails reviewed for the November 2026 banzuke.
// Map by Sumo API identity so a change of shikona keeps the same photo.
const photos: Record<string, RikishiPhoto> = {
  // Asanoyama
  "2": {
    url: "/rikishi-photos/2-5a5f9c0bc38b.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Asanoyama_2017_March.jpg",
    author: "FourTildes",
    ...commonsLicense,
  },
  // Hakunofuji
  "3": {
    url: "/rikishi-photos/3-0f7865b0ef5d.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Ochiai_Tetsuya20230514.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Takerufuji
  "5": {
    url: "/rikishi-photos/5-2a9b25ad21b2.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Takerufuji_20240916.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Kirishima
  "7": {
    url: "/rikishi-photos/7-48144a442117.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Kiribayama_Tetsuo20230514.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Kotoshoho
  "8": {
    url: "/rikishi-photos/8-c5f2bf80d583.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Kotoshoho_Yoshinari20220115-2.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Daieisho
  "9": {
    url: "/rikishi-photos/9-9b6ab909248a.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Daieisho_2014.JPG",
    author: "FourTildes",
    ...commonsLicense,
  },
  // Ichiyamamoto
  "11": {
    url: "/rikishi-photos/11-08fd14319e0f.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Ichiyamamoto_Daiki20220115-2.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Wakamotoharu
  "13": {
    url: "/rikishi-photos/13-49ff07db4781.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Wakamotoharu_Minato20220115.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Tamawashi
  "14": {
    url: "/rikishi-photos/14-df8def57f613.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Tamawashi_Ichir%C5%8D_on_April_17,_2017.jpg",
    author:
      "江戸村のとくぞう on Wikimedia Commons (Original version)  UCinternational (Crop)",
    ...commonsLicense,
  },
  // Hoshoryu
  "19": {
    url: "/rikishi-photos/19-0faf4798bc75.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Hoshoryu_Tomokatsu20220115.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Kotozakura
  "20": {
    url: "/rikishi-photos/20-c01ae68c09db.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Kotonowaka_Masahiro20220115-2.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Abi
  "22": {
    url: "/rikishi-photos/22-a71098ccdaac.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Abi-Masatora20180526.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Hiradoumi
  "24": {
    url: "/rikishi-photos/24-38736e0ad56a.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Hiradoumi_20230416.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Ura
  "28": {
    url: "/rikishi-photos/28-3f132a742f60.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Ura_Kazuki20220115-1.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Takanosho
  "37": {
    url: "/rikishi-photos/37-7735961bee77.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Takanosho_Nobuaki20220115.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Nishikifuji
  "40": {
    url: "/rikishi-photos/40-e39a84b49308.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Nishikifuji_Ryusei20220115-2.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Oho
  "41": {
    url: "/rikishi-photos/41-6d83a765d188.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Oho_Konosuke20220115-1.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Takayasu
  "44": {
    url: "/rikishi-photos/44-e6aad3a6d35a.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Takayasu_Akira_20150426.jpg",
    author: "Daraku K.",
    ...commonsLicense,
  },
  // Kinbozan
  "50": {
    url: "/rikishi-photos/50-8848411ed2b4.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Kinbozan_20230514-2.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Roga
  "55": {
    url: "/rikishi-photos/55-871d4729e99a.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Roga_Tokiyoshi20220718.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Gonoyama
  "56": {
    url: "/rikishi-photos/56-ae8a047e5af5.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Gonoyama_Toki20220718.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Oshoma
  "61": {
    url: "/rikishi-photos/61-5129ec151e3a.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Oshoma_Deki20230514.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Churanoumi
  "71": {
    url: "/rikishi-photos/71-4839565c6271.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:%E5%9C%9F%E4%BF%B5%E5%85%A5%E3%82%8A%E3%80%81%E7%BE%8E%E3%83%8E%E6%B5%B7_(cropped).jpg",
    author: "A2B48",
    ...commonsPublicDomain,
  },
  // Atamifuji
  "74": {
    url: "/rikishi-photos/74-a6de5745c713.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Atamifuji_Sakutaro20220718.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Fujiseiun
  "82": {
    url: "/rikishi-photos/82-55511c722e05.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Fujiseiun_20240916.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Tokihayate
  "83": {
    url: "/rikishi-photos/83-3ca1e80033de.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Tokihayate_20240916.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Shishi
  "86": {
    url: "/rikishi-photos/86-65d841b974ad.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Shishi-20250721.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Asakoryu
  "164": {
    url: "/rikishi-photos/164-b4f8ff644dc0.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Asakoryu-20250721.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Daiseizan
  "378": {
    url: "/rikishi-photos/378-a62b5ee4c333.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Daiseizan_20240916.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Fujinokawa
  "615": {
    url: "/rikishi-photos/615-4056e24bf069.jpg",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Fujinokawa-20250721.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Onosato
  "8850": {
    url: "/rikishi-photos/8850-0808c71c0060.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Oonosato.jpg",
    author: "Nigtkn",
    ...commonsLicense,
  },
  // Aonishiki
  "8854": {
    url: "/rikishi-photos/8854-b68bdc4c2dc6.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Aonishiki-20250721.jpg",
    author: "TSUBAME98",
    ...commonsLicense,
  },
  // Yoshinofuji
  "8857": {
    url: "/rikishi-photos/8857-eda871fc987c.jpg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Kusano-20250721.jpg",
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
