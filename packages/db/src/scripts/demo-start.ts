import { createDatabaseClient } from "../client.js";
import { startDemoBasho } from "../demo-progression.js";
import { createRepositories } from "../repositories.js";

const client = createDatabaseClient();

try {
  const result = await startDemoBasho(createRepositories(client));
  console.log(
    `Demo basho started: status=${result.basho.status}, currentDay=${result.basho.currentDay ?? 0}, appliedResults=${result.appliedResults}.`,
  );
} finally {
  await client.close();
}
