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
import type { BanzukeImportData, Repositories } from "./repositories.js";
import {
  demoBanzukeEntries,
  demoBasho,
  demoFantasyPicks,
  demoFantasyTeams,
  demoRikishi,
  demoScheduledBoutPublications,
  demoScheduledBouts,
  demoPreviousBanzukeEntries,
  demoPreviousBasho,
  demoPreviousBoutResults,
  demoPreviousRikishi,
  demoPreviousScheduledBoutPublications,
  demoPreviousScheduledBouts,
} from "./demo-seed-data.js";
import {
  sampleBanzukeEntries,
  sampleBasho,
  sampleBoutResults,
  sampleFantasyPicks,
  sampleFantasyTeams,
  sampleRikishi,
  samplePreviousBanzukeEntries,
  samplePreviousBasho,
  samplePreviousBoutResults,
  samplePreviousScheduledBoutPublications,
  samplePreviousScheduledBouts,
} from "./seed-data.js";

export async function seedDatabase(repositories: Repositories): Promise<void> {
  await replaceAllSeedData(repositories, {
    basho: sampleBasho,
    rikishi: sampleRikishi,
    banzukeEntries: sampleBanzukeEntries,
    fantasyTeams: sampleFantasyTeams,
    fantasyPicks: sampleFantasyPicks,
    boutResults: sampleBoutResults,
    previousBasho: {
      basho: samplePreviousBasho,
      rikishi: sampleRikishi,
      banzukeEntries: samplePreviousBanzukeEntries,
      boutResults: samplePreviousBoutResults,
      scheduledBoutPublications: samplePreviousScheduledBoutPublications,
      scheduledBouts: samplePreviousScheduledBouts,
    },
  });
}

export async function seedDemoDatabase(
  repositories: Repositories,
): Promise<void> {
  await repositories.replaceDemoBashosData([
    {
      basho: demoBasho,
      rikishi: demoRikishi,
      banzukeEntries: demoBanzukeEntries,
      fantasyTeams: demoFantasyTeams,
      fantasyPicks: demoFantasyPicks,
      boutResults: [],
      scheduledBoutPublications: demoScheduledBoutPublications,
      scheduledBouts: demoScheduledBouts,
    },
    {
      basho: demoPreviousBasho,
      rikishi: demoPreviousRikishi.filter(
        (rikishi) => !demoRikishi.some((current) => current.id === rikishi.id),
      ),
      banzukeEntries: demoPreviousBanzukeEntries,
      fantasyTeams: [],
      fantasyPicks: [],
      boutResults: demoPreviousBoutResults,
      scheduledBoutPublications: demoPreviousScheduledBoutPublications,
      scheduledBouts: demoPreviousScheduledBouts,
    },
  ]);
}

async function replaceAllSeedData(
  repositories: Repositories,
  seedData: SeedData,
): Promise<void> {
  await repositories.resetAllDataForLocalFixtures();

  await seedCompletedBasho(repositories, seedData.previousBasho);

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

async function seedCompletedBasho(
  repositories: Repositories,
  seedData: CompletedBashoSeedData,
): Promise<void> {
  await repositories.applyBanzukeImport({
    basho: seedData.basho,
    rikishi: seedData.rikishi,
    banzukeEntries: seedData.banzukeEntries,
  });

  for (const publication of seedData.scheduledBoutPublications) {
    await repositories.applyScheduledBoutsImport({
      publication,
      bouts: seedData.scheduledBouts.filter(
        (bout) => bout.day === publication.day,
      ),
    });
  }

  for (let day = 1; day <= 15; day += 1) {
    await repositories.applyBoutResultsImport({
      bashoId: seedData.basho.id,
      day,
      results: seedData.boutResults.filter((result) => result.day === day),
    });
  }
}

interface SeedData {
  basho: Basho;
  rikishi: readonly Rikishi[];
  banzukeEntries: readonly BanzukeEntry[];
  fantasyTeams: readonly FantasyTeam[];
  fantasyPicks: readonly FantasyPick[];
  boutResults: readonly BoutResult[];
  previousBasho: CompletedBashoSeedData;
}

interface CompletedBashoSeedData extends BanzukeImportData {
  boutResults: readonly BoutResult[];
  scheduledBoutPublications: readonly ScheduledBoutPublication[];
  scheduledBouts: readonly ScheduledBout[];
}
