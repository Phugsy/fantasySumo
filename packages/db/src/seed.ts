import type {
  BanzukeEntry,
  Basho,
  BoutResult,
  FantasyPick,
  FantasyTeam,
  Rikishi,
} from "@fantasy-sumo/domain";
import type { Repositories } from "./repositories.js";
import {
  demoBanzukeEntries,
  demoBasho,
  demoFantasyPicks,
  demoFantasyTeams,
  demoRikishi,
  demoScheduledBoutPublications,
  demoScheduledBouts,
} from "./demo-seed-data.js";
import {
  sampleBanzukeEntries,
  sampleBasho,
  sampleBoutResults,
  sampleFantasyPicks,
  sampleFantasyTeams,
  sampleRikishi,
} from "./seed-data.js";

export async function seedDatabase(repositories: Repositories): Promise<void> {
  await replaceAllSeedData(repositories, {
    basho: sampleBasho,
    rikishi: sampleRikishi,
    banzukeEntries: sampleBanzukeEntries,
    fantasyTeams: sampleFantasyTeams,
    fantasyPicks: sampleFantasyPicks,
    boutResults: sampleBoutResults,
  });
}

export async function seedDemoDatabase(
  repositories: Repositories,
): Promise<void> {
  await repositories.replaceDemoBashoData({
    basho: demoBasho,
    rikishi: demoRikishi,
    banzukeEntries: demoBanzukeEntries,
    fantasyTeams: demoFantasyTeams,
    fantasyPicks: demoFantasyPicks,
    boutResults: [],
    scheduledBoutPublications: demoScheduledBoutPublications,
    scheduledBouts: demoScheduledBouts,
  });
}

async function replaceAllSeedData(
  repositories: Repositories,
  seedData: SeedData,
): Promise<void> {
  await repositories.resetAllDataForLocalFixtures();

  await repositories.applyBanzukeImport({
    basho: seedData.basho,
    rikishi: seedData.rikishi,
    banzukeEntries: seedData.banzukeEntries,
  });

  for (const team of seedData.fantasyTeams) {
    await repositories.insertFantasyTeam(team);
  }

  for (const pick of seedData.fantasyPicks) {
    await repositories.insertFantasyPick(pick);
  }

  for (const result of seedData.boutResults) {
    await repositories.upsertBoutResult(result);
  }
}

interface SeedData {
  basho: Basho;
  rikishi: readonly Rikishi[];
  banzukeEntries: readonly BanzukeEntry[];
  fantasyTeams: readonly FantasyTeam[];
  fantasyPicks: readonly FantasyPick[];
  boutResults: readonly BoutResult[];
}
