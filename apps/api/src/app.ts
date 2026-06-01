import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import {
  createDatabaseClient,
  createRepositories,
  type SqliteDatabase,
} from "@fantasy-sumo/db";
import { getTeamSize } from "./config.js";
import { registerAdminImportRoutes } from "./routes/admin-imports.js";
import { registerBashoRoutes } from "./routes/basho.js";

interface AppOptions {
  db?: SqliteDatabase;
  now?: () => Date;
  sourceFetch?: typeof fetch;
  teamIdFactory?: () => string;
  teamSize?: number;
}

export function buildApp(options: AppOptions = {}) {
  const ownedClient =
    options.db === undefined ? createDatabaseClient() : undefined;
  const app = Fastify({
    logger: true,
  });
  const db = options.db ?? ownedClient!.db;
  const repositories = createRepositories(db);

  if (ownedClient !== undefined) {
    app.addHook("onClose", async () => {
      ownedClient.close();
    });
  }

  app.get("/api/health", async () => ({
    ok: true,
    service: "fantasy-sumo-api",
    domain: "core-ready",
  }));

  registerBashoRoutes(app, {
    repositories,
    now: options.now ?? (() => new Date()),
    teamIdFactory: options.teamIdFactory ?? randomUUID,
    teamSize: options.teamSize ?? getTeamSize(),
  });
  registerAdminImportRoutes(app, {
    repositories,
    sourceFetch: options.sourceFetch ?? fetch,
  });

  return app;
}
