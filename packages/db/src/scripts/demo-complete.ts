import { createDatabaseClient } from "../client.js";
import { completeDemoBasho } from "../demo-progression.js";
import { createRepositories } from "../repositories.js";

const client = createDatabaseClient();

try {
  const result = await completeDemoBasho(createRepositories(client));
  console.log(
    `Demo completed: status=${result.basho.status}, currentDay=${result.basho.currentDay ?? 0}, appliedResults=${result.appliedResults}.`,
  );
} finally {
  await client.close();
}
