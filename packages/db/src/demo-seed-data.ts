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
import { DEMO_BASHO_ID } from "./demo-constants.js";

export const demoBasho: Basho = {
  id: DEMO_BASHO_ID,
  isDemo: true,
  name: "Demo May Basho",
  startDate: "2026-05-10",
  endDate: "2026-05-24",
  status: "upcoming",
  currentDay: 0,
};

export const demoRikishi: Rikishi[] = [
  {
    id: "onosato",
    shikona: "Onosato",
    heya: "Nishonoseki",
  },
  {
    id: "hoshoryu",
    shikona: "Hoshoryu",
    heya: "Tatsunami",
  },
  {
    id: "kotozakura",
    shikona: "Kotozakura",
    heya: "Sadogatake",
  },
  {
    id: "kirishima",
    shikona: "Kirishima",
    heya: "Oitekaze",
  },
  {
    id: "wakatakakage",
    shikona: "Wakatakakage",
    heya: "Arashio",
  },
  {
    id: "takayasu",
    shikona: "Takayasu",
    heya: "Tagonoura",
  },
  {
    id: "ura",
    shikona: "Ura",
    heya: "Kise",
  },
  {
    id: "tobizaru",
    shikona: "Tobizaru",
    heya: "Oitekaze",
  },
];

export const demoBanzukeEntries: BanzukeEntry[] = [
  {
    id: "demo-2026-05-onosato",
    bashoId: demoBasho.id,
    rikishiId: "onosato",
    rank: "Yokozuna",
    rankOrder: 1,
  },
  {
    id: "demo-2026-05-hoshoryu",
    bashoId: demoBasho.id,
    rikishiId: "hoshoryu",
    rank: "Yokozuna",
    rankOrder: 2,
  },
  {
    id: "demo-2026-05-kotozakura",
    bashoId: demoBasho.id,
    rikishiId: "kotozakura",
    rank: "Ozeki",
    rankOrder: 3,
  },
  {
    id: "demo-2026-05-kirishima",
    bashoId: demoBasho.id,
    rikishiId: "kirishima",
    rank: "Ozeki",
    rankOrder: 4,
  },
  {
    id: "demo-2026-05-wakatakakage",
    bashoId: demoBasho.id,
    rikishiId: "wakatakakage",
    rank: "Sekiwake",
    rankOrder: 5,
  },
  {
    id: "demo-2026-05-takayasu",
    bashoId: demoBasho.id,
    rikishiId: "takayasu",
    rank: "Komusubi",
    rankOrder: 6,
  },
  {
    id: "demo-2026-05-ura",
    bashoId: demoBasho.id,
    rikishiId: "ura",
    rank: "Maegashira #10",
    rankOrder: 7,
  },
  {
    id: "demo-2026-05-tobizaru",
    bashoId: demoBasho.id,
    rikishiId: "tobizaru",
    rank: "Maegashira #12",
    rankOrder: 8,
  },
];

export const demoFantasyTeams: FantasyTeam[] = [
  {
    id: "demo-team-yusho-hunters",
    bashoId: demoBasho.id,
    displayName: "Yusho Hunters",
    ownerName: "Demo Player A",
    createdAt: "2026-05-01T09:00:00.000Z",
  },
  {
    id: "demo-team-tachiai-titans",
    bashoId: demoBasho.id,
    displayName: "Tachiai Titans",
    ownerName: "Demo Player B",
    createdAt: "2026-05-01T09:05:00.000Z",
  },
  {
    id: "demo-team-salt-circle",
    bashoId: demoBasho.id,
    displayName: "Salt Circle",
    ownerName: "Demo Player C",
    createdAt: "2026-05-01T09:10:00.000Z",
  },
  {
    id: "demo-team-dohyo-dreamers",
    bashoId: demoBasho.id,
    displayName: "Dohyo Dreamers",
    ownerName: "Demo Player D",
    createdAt: "2026-05-01T09:15:00.000Z",
  },
];

export const demoFantasyPicks: FantasyPick[] = [
  {
    id: "demo-pick-yusho-hoshoryu",
    teamId: "demo-team-yusho-hunters",
    rikishiId: "hoshoryu",
  },
  {
    id: "demo-pick-yusho-kotozakura",
    teamId: "demo-team-yusho-hunters",
    rikishiId: "kotozakura",
  },
  {
    id: "demo-pick-tachiai-onosato",
    teamId: "demo-team-tachiai-titans",
    rikishiId: "onosato",
  },
  {
    id: "demo-pick-tachiai-kirishima",
    teamId: "demo-team-tachiai-titans",
    rikishiId: "kirishima",
  },
  {
    id: "demo-pick-salt-takayasu",
    teamId: "demo-team-salt-circle",
    rikishiId: "takayasu",
  },
  {
    id: "demo-pick-salt-ura",
    teamId: "demo-team-salt-circle",
    rikishiId: "ura",
  },
  {
    id: "demo-pick-dohyo-wakatakakage",
    teamId: "demo-team-dohyo-dreamers",
    rikishiId: "wakatakakage",
  },
  {
    id: "demo-pick-dohyo-tobizaru",
    teamId: "demo-team-dohyo-dreamers",
    rikishiId: "tobizaru",
  },
];

export const demoBoutResults: BoutResult[] = [
  {
    id: "demo-2026-05-day-1-bout-1",
    bashoId: demoBasho.id,
    day: 1,
    winnerRikishiId: "onosato",
    loserRikishiId: "hoshoryu",
    kimarite: "oshidashi",
  },
  {
    id: "demo-2026-05-day-1-bout-2",
    bashoId: demoBasho.id,
    day: 1,
    winnerRikishiId: "kotozakura",
    loserRikishiId: "kirishima",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-1-bout-3",
    bashoId: demoBasho.id,
    day: 1,
    winnerRikishiId: "takayasu",
    loserRikishiId: "ura",
    kimarite: "hatakikomi",
  },
  {
    id: "demo-2026-05-day-1-bout-4",
    bashoId: demoBasho.id,
    day: 1,
    winnerRikishiId: "wakatakakage",
    loserRikishiId: "tobizaru",
    kimarite: "oshidashi",
  },
  {
    id: "demo-2026-05-day-2-bout-1",
    bashoId: demoBasho.id,
    day: 2,
    winnerRikishiId: "onosato",
    loserRikishiId: "kotozakura",
    kimarite: "uwatenage",
  },
  {
    id: "demo-2026-05-day-2-bout-2",
    bashoId: demoBasho.id,
    day: 2,
    winnerRikishiId: "hoshoryu",
    loserRikishiId: "kirishima",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-2-bout-3",
    bashoId: demoBasho.id,
    day: 2,
    winnerRikishiId: "ura",
    loserRikishiId: "takayasu",
    kimarite: "okuridashi",
  },
  {
    id: "demo-2026-05-day-2-bout-4",
    bashoId: demoBasho.id,
    day: 2,
    winnerRikishiId: "tobizaru",
    loserRikishiId: "wakatakakage",
    kimarite: "hikiotoshi",
  },
  {
    id: "demo-2026-05-day-3-bout-1",
    bashoId: demoBasho.id,
    day: 3,
    winnerRikishiId: "kirishima",
    loserRikishiId: "onosato",
    kimarite: "oshidashi",
  },
  {
    id: "demo-2026-05-day-3-bout-2",
    bashoId: demoBasho.id,
    day: 3,
    winnerRikishiId: "hoshoryu",
    loserRikishiId: "kotozakura",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-3-bout-3",
    bashoId: demoBasho.id,
    day: 3,
    winnerRikishiId: "takayasu",
    loserRikishiId: "wakatakakage",
    kimarite: "tsukiotoshi",
  },
  {
    id: "demo-2026-05-day-3-bout-4",
    bashoId: demoBasho.id,
    day: 3,
    winnerRikishiId: "ura",
    loserRikishiId: "tobizaru",
    kimarite: "katasukashi",
  },
  {
    id: "demo-2026-05-day-4-bout-1",
    bashoId: demoBasho.id,
    day: 4,
    winnerRikishiId: "onosato",
    loserRikishiId: "ura",
    kimarite: "oshidashi",
  },
  {
    id: "demo-2026-05-day-4-bout-2",
    bashoId: demoBasho.id,
    day: 4,
    winnerRikishiId: "kirishima",
    loserRikishiId: "takayasu",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-4-bout-3",
    bashoId: demoBasho.id,
    day: 4,
    winnerRikishiId: "hoshoryu",
    loserRikishiId: "tobizaru",
    kimarite: "uwatenage",
  },
  {
    id: "demo-2026-05-day-4-bout-4",
    bashoId: demoBasho.id,
    day: 4,
    winnerRikishiId: "kotozakura",
    loserRikishiId: "wakatakakage",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-5-bout-1",
    bashoId: demoBasho.id,
    day: 5,
    winnerRikishiId: "hoshoryu",
    loserRikishiId: "onosato",
    kimarite: "shitatenage",
  },
  {
    id: "demo-2026-05-day-5-bout-2",
    bashoId: demoBasho.id,
    day: 5,
    winnerRikishiId: "kotozakura",
    loserRikishiId: "kirishima",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-5-bout-3",
    bashoId: demoBasho.id,
    day: 5,
    winnerRikishiId: "takayasu",
    loserRikishiId: "tobizaru",
    kimarite: "oshidashi",
  },
  {
    id: "demo-2026-05-day-5-bout-4",
    bashoId: demoBasho.id,
    day: 5,
    winnerRikishiId: "wakatakakage",
    loserRikishiId: "ura",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-6-bout-1",
    bashoId: demoBasho.id,
    day: 6,
    winnerRikishiId: "onosato",
    loserRikishiId: "takayasu",
    kimarite: "oshidashi",
  },
  {
    id: "demo-2026-05-day-6-bout-2",
    bashoId: demoBasho.id,
    day: 6,
    winnerRikishiId: "kotozakura",
    loserRikishiId: "tobizaru",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-6-bout-3",
    bashoId: demoBasho.id,
    day: 6,
    winnerRikishiId: "hoshoryu",
    loserRikishiId: "wakatakakage",
    kimarite: "uwatenage",
  },
  {
    id: "demo-2026-05-day-6-bout-4",
    bashoId: demoBasho.id,
    day: 6,
    winnerRikishiId: "ura",
    loserRikishiId: "kirishima",
    kimarite: "katasukashi",
  },
  {
    id: "demo-2026-05-day-7-bout-1",
    bashoId: demoBasho.id,
    day: 7,
    winnerRikishiId: "onosato",
    loserRikishiId: "tobizaru",
    kimarite: "oshidashi",
  },
  {
    id: "demo-2026-05-day-7-bout-2",
    bashoId: demoBasho.id,
    day: 7,
    winnerRikishiId: "kirishima",
    loserRikishiId: "wakatakakage",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-7-bout-3",
    bashoId: demoBasho.id,
    day: 7,
    winnerRikishiId: "takayasu",
    loserRikishiId: "kotozakura",
    kimarite: "hatakikomi",
  },
  {
    id: "demo-2026-05-day-7-bout-4",
    bashoId: demoBasho.id,
    day: 7,
    winnerRikishiId: "hoshoryu",
    loserRikishiId: "ura",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-8-bout-1",
    bashoId: demoBasho.id,
    day: 8,
    winnerRikishiId: "kotozakura",
    loserRikishiId: "onosato",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-8-bout-2",
    bashoId: demoBasho.id,
    day: 8,
    winnerRikishiId: "hoshoryu",
    loserRikishiId: "takayasu",
    kimarite: "uwatenage",
  },
  {
    id: "demo-2026-05-day-8-bout-3",
    bashoId: demoBasho.id,
    day: 8,
    winnerRikishiId: "wakatakakage",
    loserRikishiId: "ura",
    kimarite: "oshidashi",
  },
  {
    id: "demo-2026-05-day-8-bout-4",
    bashoId: demoBasho.id,
    day: 8,
    winnerRikishiId: "kirishima",
    loserRikishiId: "tobizaru",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-9-bout-1",
    bashoId: demoBasho.id,
    day: 9,
    winnerRikishiId: "onosato",
    loserRikishiId: "wakatakakage",
    kimarite: "oshidashi",
  },
  {
    id: "demo-2026-05-day-9-bout-2",
    bashoId: demoBasho.id,
    day: 9,
    winnerRikishiId: "hoshoryu",
    loserRikishiId: "kirishima",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-9-bout-3",
    bashoId: demoBasho.id,
    day: 9,
    winnerRikishiId: "takayasu",
    loserRikishiId: "tobizaru",
    kimarite: "hatakikomi",
  },
  {
    id: "demo-2026-05-day-9-bout-4",
    bashoId: demoBasho.id,
    day: 9,
    winnerRikishiId: "kotozakura",
    loserRikishiId: "ura",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-10-bout-1",
    bashoId: demoBasho.id,
    day: 10,
    winnerRikishiId: "hoshoryu",
    loserRikishiId: "onosato",
    kimarite: "shitatenage",
  },
  {
    id: "demo-2026-05-day-10-bout-2",
    bashoId: demoBasho.id,
    day: 10,
    winnerRikishiId: "kirishima",
    loserRikishiId: "kotozakura",
    kimarite: "oshidashi",
  },
  {
    id: "demo-2026-05-day-10-bout-3",
    bashoId: demoBasho.id,
    day: 10,
    winnerRikishiId: "ura",
    loserRikishiId: "takayasu",
    kimarite: "okuridashi",
  },
  {
    id: "demo-2026-05-day-10-bout-4",
    bashoId: demoBasho.id,
    day: 10,
    winnerRikishiId: "wakatakakage",
    loserRikishiId: "tobizaru",
    kimarite: "oshidashi",
  },
  {
    id: "demo-2026-05-day-11-bout-1",
    bashoId: demoBasho.id,
    day: 11,
    winnerRikishiId: "onosato",
    loserRikishiId: "kirishima",
    kimarite: "oshidashi",
  },
  {
    id: "demo-2026-05-day-11-bout-2",
    bashoId: demoBasho.id,
    day: 11,
    winnerRikishiId: "kotozakura",
    loserRikishiId: "hoshoryu",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-11-bout-3",
    bashoId: demoBasho.id,
    day: 11,
    winnerRikishiId: "takayasu",
    loserRikishiId: "wakatakakage",
    kimarite: "hatakikomi",
  },
  {
    id: "demo-2026-05-day-11-bout-4",
    bashoId: demoBasho.id,
    day: 11,
    winnerRikishiId: "ura",
    loserRikishiId: "tobizaru",
    kimarite: "katasukashi",
  },
  {
    id: "demo-2026-05-day-12-bout-1",
    bashoId: demoBasho.id,
    day: 12,
    winnerRikishiId: "onosato",
    loserRikishiId: "ura",
    kimarite: "oshidashi",
  },
  {
    id: "demo-2026-05-day-12-bout-2",
    bashoId: demoBasho.id,
    day: 12,
    winnerRikishiId: "hoshoryu",
    loserRikishiId: "tobizaru",
    kimarite: "uwatenage",
  },
  {
    id: "demo-2026-05-day-12-bout-3",
    bashoId: demoBasho.id,
    day: 12,
    winnerRikishiId: "kotozakura",
    loserRikishiId: "wakatakakage",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-12-bout-4",
    bashoId: demoBasho.id,
    day: 12,
    winnerRikishiId: "kirishima",
    loserRikishiId: "takayasu",
    kimarite: "oshidashi",
  },
  {
    id: "demo-2026-05-day-13-bout-1",
    bashoId: demoBasho.id,
    day: 13,
    winnerRikishiId: "ura",
    loserRikishiId: "onosato",
    kimarite: "katasukashi",
  },
  {
    id: "demo-2026-05-day-13-bout-2",
    bashoId: demoBasho.id,
    day: 13,
    winnerRikishiId: "kotozakura",
    loserRikishiId: "takayasu",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-13-bout-3",
    bashoId: demoBasho.id,
    day: 13,
    winnerRikishiId: "wakatakakage",
    loserRikishiId: "kirishima",
    kimarite: "oshidashi",
  },
  {
    id: "demo-2026-05-day-13-bout-4",
    bashoId: demoBasho.id,
    day: 13,
    winnerRikishiId: "hoshoryu",
    loserRikishiId: "tobizaru",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-14-bout-1",
    bashoId: demoBasho.id,
    day: 14,
    winnerRikishiId: "onosato",
    loserRikishiId: "kotozakura",
    kimarite: "oshidashi",
  },
  {
    id: "demo-2026-05-day-14-bout-2",
    bashoId: demoBasho.id,
    day: 14,
    winnerRikishiId: "hoshoryu",
    loserRikishiId: "wakatakakage",
    kimarite: "uwatenage",
  },
  {
    id: "demo-2026-05-day-14-bout-3",
    bashoId: demoBasho.id,
    day: 14,
    winnerRikishiId: "kirishima",
    loserRikishiId: "ura",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-14-bout-4",
    bashoId: demoBasho.id,
    day: 14,
    winnerRikishiId: "takayasu",
    loserRikishiId: "tobizaru",
    kimarite: "hatakikomi",
  },
  {
    id: "demo-2026-05-day-15-bout-1",
    bashoId: demoBasho.id,
    day: 15,
    winnerRikishiId: "onosato",
    loserRikishiId: "hoshoryu",
    kimarite: "oshidashi",
  },
  {
    id: "demo-2026-05-day-15-bout-2",
    bashoId: demoBasho.id,
    day: 15,
    winnerRikishiId: "kotozakura",
    loserRikishiId: "kirishima",
    kimarite: "yorikiri",
  },
  {
    id: "demo-2026-05-day-15-bout-3",
    bashoId: demoBasho.id,
    day: 15,
    winnerRikishiId: "wakatakakage",
    loserRikishiId: "ura",
    kimarite: "oshidashi",
  },
  {
    id: "demo-2026-05-day-15-bout-4",
    bashoId: demoBasho.id,
    day: 15,
    winnerRikishiId: "takayasu",
    loserRikishiId: "tobizaru",
    kimarite: "hatakikomi",
    loserAbsent: true,
  },
];

export const demoScheduledBoutPublications: ScheduledBoutPublication[] =
  Array.from({ length: 15 }, (_, index) => {
    const day = index + 1;

    return {
      id: `${demoBasho.id}-day-${day}-schedule`,
      bashoId: demoBasho.id,
      day,
      source: "demo-fixture",
      publishedAt: `2026-05-${String(8 + day).padStart(2, "0")}T08:00:00.000Z`,
    };
  });

function toDemoScheduledBout(
  result: BoutResult,
  includeWithdrawal: boolean,
): ScheduledBout {
  const isWithdrawal = includeWithdrawal && result.loserAbsent === true;

  return {
    id: result.id.replace("-bout-", "-match-"),
    bashoId: result.bashoId,
    day: result.day,
    eastRikishiId: result.winnerRikishiId,
    westRikishiId: result.loserRikishiId,
    status: isWithdrawal ? "cancelled" : "scheduled",
    ...(isWithdrawal ? { withdrawnRikishiId: result.loserRikishiId } : {}),
  };
}

export const demoScheduledBouts: ScheduledBout[] = demoBoutResults.map(
  (result) => toDemoScheduledBout(result, false),
);

export const demoPreviousBasho: Basho = {
  id: "demo-2026-03",
  isDemo: true,
  name: "Demo March Basho",
  startDate: "2026-03-08",
  endDate: "2026-03-22",
  status: "complete",
  currentDay: 15,
};

export const demoPreviousRikishi: Rikishi[] = [
  ...demoRikishi.filter((rikishi) => rikishi.id !== "tobizaru"),
  { id: "meisei", shikona: "Meisei", heya: "Tatsunami" },
];

const demoPreviousRanks = [
  "Ozeki",
  "Ozeki",
  "Sekiwake",
  "Komusubi",
  "Juryo #1",
  "Maegashira #8",
  "Maegashira #10",
  "Maegashira #12",
];

export const demoPreviousBanzukeEntries: BanzukeEntry[] =
  demoPreviousRikishi.map((rikishi, index) => ({
    id: `${demoPreviousBasho.id}-${rikishi.id}`,
    bashoId: demoPreviousBasho.id,
    rikishiId: rikishi.id,
    rank: demoPreviousRanks[index]!,
    rankOrder: index + 1,
  }));

export const demoPreviousBoutResults: BoutResult[] = Array.from(
  { length: 15 },
  (_, index) => createDemoPreviousDayResults(index + 1),
).flat();

export const demoPreviousScheduledBoutPublications: ScheduledBoutPublication[] =
  Array.from({ length: 15 }, (_, index) => {
    const day = index + 1;

    return {
      id: `${demoPreviousBasho.id}-day-${day}-schedule`,
      bashoId: demoPreviousBasho.id,
      day,
      source: "demo-history-fixture",
      publishedAt: `2026-03-${String(7 + day).padStart(2, "0")}T08:00:00.000Z`,
    };
  });

export const demoPreviousScheduledBouts: ScheduledBout[] = Array.from(
  { length: 15 },
  (_, index) => createDemoPreviousDayBouts(index + 1),
).flat();

export function demoScheduledBoutsForDay(day: number): ScheduledBout[] {
  return demoBoutResults
    .filter((result) => result.day === day)
    .map((result) => toDemoScheduledBout(result, true));
}

function createDemoPreviousDayResults(day: number): BoutResult[] {
  const results = [
    toDemoPreviousResult(
      day,
      1,
      day <= 12 ? "onosato" : "hoshoryu",
      day <= 12 ? "hoshoryu" : "onosato",
    ),
    toDemoPreviousResult(
      day,
      2,
      day % 2 === 1 ? "kotozakura" : "kirishima",
      day % 2 === 1 ? "kirishima" : "kotozakura",
    ),
    toDemoPreviousResult(
      day,
      3,
      day <= 9 ? "wakatakakage" : "ura",
      day <= 9 ? "ura" : "wakatakakage",
    ),
  ];

  if (day <= 10) {
    results.push({
      ...toDemoPreviousResult(
        day,
        4,
        day <= 5 ? "takayasu" : "meisei",
        day <= 5 ? "meisei" : "takayasu",
      ),
      ...(day === 10 ? { loserAbsent: true } : {}),
    });
  }

  return results;
}

function createDemoPreviousDayBouts(day: number): ScheduledBout[] {
  const scheduledResults = createDemoPreviousDayResults(day);
  const bouts: ScheduledBout[] = scheduledResults.map((result) => ({
    id: result.id.replace("-bout-", "-match-"),
    bashoId: result.bashoId,
    day: result.day,
    eastRikishiId: result.winnerRikishiId,
    westRikishiId: result.loserRikishiId,
    status: "scheduled",
  }));

  if (day > 10) {
    bouts.push({
      id: `${demoPreviousBasho.id}-day-${day}-match-4`,
      bashoId: demoPreviousBasho.id,
      day,
      eastRikishiId: "takayasu",
      westRikishiId: "meisei",
      status: "cancelled",
      withdrawnRikishiId: "takayasu",
    });
  }

  return bouts;
}

function toDemoPreviousResult(
  day: number,
  bout: number,
  winnerRikishiId: string,
  loserRikishiId: string,
): BoutResult {
  return {
    id: `${demoPreviousBasho.id}-day-${day}-bout-${bout}`,
    bashoId: demoPreviousBasho.id,
    day,
    winnerRikishiId,
    loserRikishiId,
  };
}
