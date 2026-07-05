import { createDatabaseClient } from "../client.js";
import { runMigrations } from "../migrate.js";
import { createRepositories } from "../repositories.js";
import { seedDemoDatabase } from "../seed.js";

const client = createDatabaseClient();

try {
  await runMigrations(client);
  await seedDemoDatabase(createRepositories(client));
  console.log("Demo database seeded.");
} finally {
  await client.close();
}
