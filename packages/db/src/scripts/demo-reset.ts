import { createDatabaseClient } from "../client.js";
import { runMigrations } from "../migrate.js";
import { resetDemoProgression } from "../demo-progression.js";

const client = createDatabaseClient();

try {
  runMigrations(client.db);
  resetDemoProgression(client.db);
  console.log("Demo progression reset to day 0 with picks open.");
} finally {
  client.close();
}
