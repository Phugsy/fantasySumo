import type {
  BanzukeEntry,
  Basho,
  BoutResult,
  FantasyPick,
  FantasyTeam,
  Rikishi,
} from "@fantasy-sumo/domain";
import type { SqliteDatabase } from "./client.js";
import {
  banzukeEntries,
  basho,
  boutResults,
  fantasyPicks,
  fantasyTeams,
  rikishi,
} from "./schema.js";
import {
  demoBanzukeEntries,
  demoBasho,
  demoBoutResults,
  demoFantasyPicks,
  demoFantasyTeams,
  demoRikishi,
} from "./demo-seed-data.js";
import {
  sampleBanzukeEntries,
  sampleBasho,
  sampleBoutResults,
  sampleFantasyPicks,
  sampleFantasyTeams,
  sampleRikishi,
} from "./seed-data.js";

export function seedDatabase(db: SqliteDatabase): void {
  replaceSeedData(db, {
    basho: sampleBasho,
    rikishi: sampleRikishi,
    banzukeEntries: sampleBanzukeEntries,
    fantasyTeams: sampleFantasyTeams,
    fantasyPicks: sampleFantasyPicks,
    boutResults: sampleBoutResults,
  });
}

export function seedDemoDatabase(db: SqliteDatabase): void {
  replaceSeedData(db, {
    basho: demoBasho,
    rikishi: demoRikishi,
    banzukeEntries: demoBanzukeEntries,
    fantasyTeams: demoFantasyTeams,
    fantasyPicks: demoFantasyPicks,
    boutResults: demoBoutResults,
  });
}

function replaceSeedData(db: SqliteDatabase, seedData: SeedData): void {
  db.delete(fantasyPicks).run();
  db.delete(fantasyTeams).run();
  db.delete(boutResults).run();
  db.delete(banzukeEntries).run();
  db.delete(rikishi).run();
  db.delete(basho).run();

  db.insert(basho)
    .values({
      ...seedData.basho,
      currentDay: seedData.basho.currentDay ?? null,
    })
    .run();
  db.insert(rikishi)
    .values([...seedData.rikishi])
    .run();
  db.insert(banzukeEntries)
    .values([...seedData.banzukeEntries])
    .run();
  db.insert(fantasyTeams)
    .values([...seedData.fantasyTeams])
    .run();
  db.insert(fantasyPicks)
    .values(
      seedData.fantasyPicks.map((pick) => ({
        id: pick.id ?? `${pick.teamId}-${pick.rikishiId}`,
        teamId: pick.teamId,
        rikishiId: pick.rikishiId,
      })),
    )
    .run();
  db.insert(boutResults)
    .values([...seedData.boutResults])
    .run();
}

interface SeedData {
  basho: Basho;
  rikishi: readonly Rikishi[];
  banzukeEntries: readonly BanzukeEntry[];
  fantasyTeams: readonly FantasyTeam[];
  fantasyPicks: readonly FantasyPick[];
  boutResults: readonly BoutResult[];
}
