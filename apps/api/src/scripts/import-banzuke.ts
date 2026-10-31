import {
  createDatabaseClient,
  createRepositories,
  runMigrations,
} from "@fantasy-sumo/db";
import { fetchJsaBanzukeImport } from "../imports/adapters.js";
import { importBanzuke } from "../imports/service.js";
import { fetchSumoApiBanzukeImport } from "../imports/sumo-api-banzuke.js";
import { parseBanzukeImportArgs } from "./import-banzuke-options.js";

const options = parseBanzukeImportArgs(process.argv.slice(2));
const client = createDatabaseClient();

try {
  await runMigrations(client);

  const command =
    options.source === "sumo-api"
      ? await fetchSumoApiBanzukeImport(fetch, { bashoId: options.bashoId! })
      : await fetchJsaBanzukeImport(fetch);
  const result = await importBanzuke(createRepositories(client), command, {
    dryRun: options.dryRun,
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await client.close();
}
