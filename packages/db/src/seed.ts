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
  sampleBanzukeEntries,
  sampleBasho,
  sampleBoutResults,
  sampleFantasyPicks,
  sampleFantasyTeams,
  sampleRikishi,
} from "./seed-data.js";

export function seedDatabase(db: SqliteDatabase): void {
  db.delete(fantasyPicks).run();
  db.delete(fantasyTeams).run();
  db.delete(boutResults).run();
  db.delete(banzukeEntries).run();
  db.delete(rikishi).run();
  db.delete(basho).run();

  db.insert(basho).values(sampleBasho).run();
  db.insert(rikishi).values(sampleRikishi).run();
  db.insert(banzukeEntries).values(sampleBanzukeEntries).run();
  db.insert(fantasyTeams).values(sampleFantasyTeams).run();
  db.insert(fantasyPicks)
    .values(
      sampleFantasyPicks.map((pick) => ({
        id: pick.id ?? `${pick.teamId}-${pick.rikishiId}`,
        teamId: pick.teamId,
        rikishiId: pick.rikishiId,
      })),
    )
    .run();
  db.insert(boutResults).values(sampleBoutResults).run();
}
