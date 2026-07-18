import type {
  BanzukeEntry,
  Basho,
  BoutResult,
  FantasyPick,
  FantasyTeam,
  Rikishi,
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
