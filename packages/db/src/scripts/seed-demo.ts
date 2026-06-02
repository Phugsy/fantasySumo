import { createDatabaseClient } from "../client.js";
import { runMigrations } from "../migrate.js";
import { seedDemoDatabase } from "../seed.js";

const client = createDatabaseClient();

try {
  runMigrations(client.db);
  seedDemoDatabase(client.db);
  console.log("Demo database seeded.");
} finally {
  client.close();
}
