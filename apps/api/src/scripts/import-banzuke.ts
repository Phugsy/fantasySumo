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
  await runMigrations(client);

  const command = await fetchJsaBanzukeImport(fetch);
  const result = await importBanzuke(createRepositories(client), command, {
    dryRun,
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await client.close();
}
