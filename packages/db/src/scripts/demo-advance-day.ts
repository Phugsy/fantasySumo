import { createDatabaseClient } from "../client.js";
import { advanceDemoBashoDay } from "../demo-progression.js";
import { createRepositories } from "../repositories.js";

const client = createDatabaseClient();

try {
  const result = await advanceDemoBashoDay(createRepositories(client));
  console.log(
    `Demo advanced: status=${result.basho.status}, currentDay=${result.basho.currentDay ?? 0}, appliedResults=${result.appliedResults}.`,
  );
} finally {
  await client.close();
}
