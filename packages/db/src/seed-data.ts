import type {
  BanzukeEntry,
  Basho,
  BoutResult,
  FantasyPick,
  FantasyTeam,
  Rikishi,
  ScheduledBout,
  ScheduledBoutPublication,
} from "@fantasy-sumo/domain";

export const sampleBasho: Basho = {
  id: "2026-05",
  isDemo: false,
  name: "May 2026 Sample Basho",
  startDate: "2026-05-10",
  endDate: "2026-05-24",
  status: "upcoming",
  currentDay: 0,
};

export const sampleRikishi: Rikishi[] = [
  {
    id: "onosato",
    shikona: "Onosato",
    heya: "Nishonoseki",
  },
  {
    id: "kotozakura",
    shikona: "Kotozakura",
    heya: "Sadogatake",
  },
  {
    id: "hoshoryu",
    shikona: "Hoshoryu",
    heya: "Tatsunami",
  },
  {
    id: "kirishima",
    shikona: "Kirishima",
    heya: "Oitekaze",
  },
];

export const sampleBanzukeEntries: BanzukeEntry[] = [
  {
    id: "2026-05-onosato",
    bashoId: sampleBasho.id,
    rikishiId: "onosato",
    rank: "Ozeki",
    rankOrder: 1,
  },
  {
    id: "2026-05-kotozakura",
    bashoId: sampleBasho.id,
    rikishiId: "kotozakura",
    rank: "Ozeki",
    rankOrder: 2,
  },
  {
    id: "2026-05-hoshoryu",
    bashoId: sampleBasho.id,
    rikishiId: "hoshoryu",
    rank: "Sekiwake",
    rankOrder: 3,
  },
  {
    id: "2026-05-kirishima",
    bashoId: sampleBasho.id,
    rikishiId: "kirishima",
    rank: "Komusubi",
    rankOrder: 4,
  },
];

export const sampleFantasyTeams: FantasyTeam[] = [
  {
    id: "team-east",
    bashoId: sampleBasho.id,
    displayName: "East Side",
    ownerName: "Demo Player",
    createdAt: "2026-05-01T12:00:00.000Z",
  },
  {
    id: "team-west",
    bashoId: sampleBasho.id,
    displayName: "West Side",
    ownerName: "Demo Rival",
    createdAt: "2026-05-01T12:05:00.000Z",
  },
];

export const sampleFantasyPicks: FantasyPick[] = [
  {
    id: "pick-east-onosato",
    teamId: "team-east",
    rikishiId: "onosato",
  },
  {
    id: "pick-east-kirishima",
    teamId: "team-east",
    rikishiId: "kirishima",
  },
  {
    id: "pick-west-kotozakura",
    teamId: "team-west",
    rikishiId: "kotozakura",
  },
  {
    id: "pick-west-hoshoryu",
    teamId: "team-west",
    rikishiId: "hoshoryu",
  },
];

export const sampleBoutResults: BoutResult[] = [
  {
    id: "2026-05-day-1-bout-1",
    bashoId: sampleBasho.id,
    day: 1,
    winnerRikishiId: "onosato",
    loserRikishiId: "hoshoryu",
    kimarite: "oshidashi",
  },
  {
    id: "2026-05-day-1-bout-2",
    bashoId: sampleBasho.id,
    day: 1,
    winnerRikishiId: "kotozakura",
    loserRikishiId: "kirishima",
    kimarite: "yorikiri",
  },
  {
    id: "2026-05-day-2-bout-1",
    bashoId: sampleBasho.id,
    day: 2,
    winnerRikishiId: "kirishima",
    loserRikishiId: "hoshoryu",
    kimarite: "hatakikomi",
  },
];

export const samplePreviousBasho: Basho = {
  id: "2026-03",
  isDemo: false,
  name: "March 2026 Sample Basho",
  startDate: "2026-03-08",
  endDate: "2026-03-22",
  status: "complete",
  currentDay: 15,
};

export const samplePreviousBanzukeEntries: BanzukeEntry[] =
  sampleBanzukeEntries.map((entry) => ({
    ...entry,
    id: entry.id.replace(sampleBasho.id, samplePreviousBasho.id),
    bashoId: samplePreviousBasho.id,
  }));

export const samplePreviousBoutResults: BoutResult[] = Array.from(
  { length: 15 },
  (_, index) => {
    const day = index + 1;

    return [
      toSamplePreviousResult(
        day,
        1,
        day <= 10 ? "onosato" : "kotozakura",
        day <= 10 ? "kotozakura" : "onosato",
      ),
      toSamplePreviousResult(
        day,
        2,
        day % 2 === 1 ? "hoshoryu" : "kirishima",
        day % 2 === 1 ? "kirishima" : "hoshoryu",
      ),
    ];
  },
).flat();

export const samplePreviousScheduledBoutPublications: ScheduledBoutPublication[] =
  Array.from({ length: 15 }, (_, index) => {
    const day = index + 1;

    return {
      id: `${samplePreviousBasho.id}-day-${day}-schedule`,
      bashoId: samplePreviousBasho.id,
      day,
      source: "sample-fixture:complete",
      publishedAt: `2026-03-${String(7 + day).padStart(2, "0")}T08:00:00.000Z`,
    };
  });

export const samplePreviousScheduledBouts: ScheduledBout[] =
  samplePreviousBoutResults.map((result) => ({
    id: result.id.replace("-bout-", "-match-"),
    bashoId: result.bashoId,
    day: result.day,
    eastRikishiId: result.winnerRikishiId,
    westRikishiId: result.loserRikishiId,
    status: "scheduled",
  }));

function toSamplePreviousResult(
  day: number,
  bout: number,
  winnerRikishiId: string,
  loserRikishiId: string,
): BoutResult {
  return {
    id: `${samplePreviousBasho.id}-day-${day}-bout-${bout}`,
    bashoId: samplePreviousBasho.id,
    day,
    winnerRikishiId,
    loserRikishiId,
  };
}
