import { createDatabaseClient } from "../client.js";
import { runMigrations } from "../migrate.js";
import { resetDemoProgression } from "../demo-progression.js";
import { createRepositories } from "../repositories.js";

const client = createDatabaseClient();

try {
  await runMigrations(client);
  await resetDemoProgression(createRepositories(client));
  console.log("Demo progression reset to day 0 with picks open.");
} finally {
  await client.close();
}
