import { z } from "zod";
import {
  createDatabaseClient,
  createRepositories,
  runMigrations,
} from "@fantasy-sumo/db";

const argv = process.argv.slice(2);
const option = (name: string) => {
  const index = argv.indexOf(`--${name}`);
  return index < 0 ? undefined : argv[index + 1];
};
const identity = z
  .object({
    source: z.enum(["jsa", "sumo-api"]),
    sourceRikishiId: z.string().regex(/^[1-9][0-9]*$/),
    rikishiId: z.string().min(1),
  })
  .parse({
    source: option("source"),
    sourceRikishiId: option("source-id"),
    rikishiId: option("rikishi"),
  });
const dryRun = argv.includes("--dry-run");
const client = createDatabaseClient();
try {
  await runMigrations(client);
  const repositories = createRepositories(client);
  const known = await repositories.listRikishi();
  if (!known.some((rikishi) => rikishi.id === identity.rikishiId)) {
    throw new Error(
      "The canonical rikishi must already exist. Verify the intended row first.",
    );
  }
  const aliases = await repositories.listRikishiSourceIdentities();
  if (
    aliases.some(
      (alias) =>
        alias.source === identity.source &&
        ((alias.sourceRikishiId === identity.sourceRikishiId &&
          alias.rikishiId !== identity.rikishiId) ||
          (alias.rikishiId === identity.rikishiId &&
            alias.sourceRikishiId !== identity.sourceRikishiId)),
    )
  ) {
    throw new Error(
      "Conflicting identity: this command cannot reassign or merge existing mappings.",
    );
  }
  if (!dryRun) await repositories.attachRikishiSourceIdentity(identity);
  console.log(JSON.stringify({ dryRun, identity }, null, 2));
} finally {
  await client.close();
}
