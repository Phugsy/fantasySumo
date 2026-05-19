import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import {
  createDatabaseClient,
  createRepositories,
  type SqliteDatabase,
} from "@fantasy-sumo/db";
import { registerMvpRoutes } from "./routes/mvp.js";

const MVP_TEAM_SIZE = 2;

interface AppOptions {
  db?: SqliteDatabase;
  now?: () => Date;
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

  registerMvpRoutes(app, {
    repositories,
    now: options.now ?? (() => new Date()),
    teamIdFactory: options.teamIdFactory ?? randomUUID,
    teamSize: options.teamSize ?? MVP_TEAM_SIZE,
  });

  return app;
}
