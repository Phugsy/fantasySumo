import { createDatabaseClient } from "../client.js";
import { runMigrations } from "../migrate.js";
import { seedDatabase } from "../seed.js";

const client = createDatabaseClient();

try {
  runMigrations(client.db);
  seedDatabase(client.db);
  console.log("Database seeded.");
} finally {
  client.close();
}
