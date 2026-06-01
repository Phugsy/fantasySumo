import {
  createDatabaseClient,
  createRepositories,
  runMigrations,
} from "@fantasy-sumo/db";
import { fetchJsaBanzukeImport } from "../imports/adapters.js";
import { importBanzuke } from "../imports/service.js";

const dryRun = process.argv.includes("--dry-run");
const client = createDatabaseClient();

try {
  runMigrations(client.db);

  const command = await fetchJsaBanzukeImport(fetch);
  const result = importBanzuke(createRepositories(client.db), command, {
    dryRun,
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  client.close();
}
