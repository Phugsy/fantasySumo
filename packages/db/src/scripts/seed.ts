import { createDatabaseClient } from "../client.js";
import { runMigrations } from "../migrate.js";
import { createRepositories } from "../repositories.js";
import { seedDatabase } from "../seed.js";

const client = createDatabaseClient();

try {
  await runMigrations(client);
  await seedDatabase(createRepositories(client));
  console.log("Database seeded.");
} finally {
  await client.close();
}
