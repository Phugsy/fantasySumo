import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import {
  createDatabaseClient,
  createRepositories,
  type AppDatabase,
} from "@fantasy-sumo/db";
import {
  allowsUnprotectedAdminImports,
  getAdminImportToken,
  getAuthMode,
  getDemoAdminToken,
  getNeonAuthAudience,
  getNeonAuthIssuer,
  getNeonAuthJwksUrl,
  getTeamSize,
} from "./config.js";
import {
  createAuthService,
  registerAuthRoutes,
  type AuthenticatedUser,
} from "./auth.js";
import { registerAdminDemoRoutes } from "./routes/admin-demo.js";
import { registerAdminImportRoutes } from "./routes/admin-imports.js";
import { registerBashoRoutes } from "./routes/basho.js";

interface AppOptions {
  db?: AppDatabase;
  now?: () => Date;
  sourceFetch?: typeof fetch;
  teamIdFactory?: () => string;
  teamSize?: number;
  demoAdminToken?: string;
  adminImportToken?: string;
  authMode?: "local" | "neon";
  neonAuthAudience?: string;
  neonAuthIssuer?: string;
  neonAuthJwksUrl?: string;
  neonJwtVerifier?: (token: string) => Promise<AuthenticatedUser | undefined>;
  allowUnprotectedAdminImports?: boolean;
  allowUnprotectedDemoAdmin?: boolean;
}

export function buildApp(options: AppOptions = {}) {
  const ownedClient =
    options.db === undefined ? createDatabaseClient() : undefined;
  const app = Fastify({
    logger: true,
  });
  const db = options.db ?? ownedClient!;
  const repositories = createRepositories(db);
  const auth = createAuthService({
    mode: options.authMode ?? getAuthMode(),
    neonAuthAudience: options.neonAuthAudience ?? getNeonAuthAudience(),
    neonAuthIssuer: options.neonAuthIssuer ?? getNeonAuthIssuer(),
    neonAuthJwksUrl: options.neonAuthJwksUrl ?? getNeonAuthJwksUrl(),
    neonJwtVerifier: options.neonJwtVerifier,
  });

  if (ownedClient !== undefined) {
    app.addHook("onClose", async () => {
      await ownedClient.close();
    });
  }

  app.get("/api/health", async () => ({
    ok: true,
    service: "fantasy-sumo-api",
    domain: "core-ready",
  }));

  registerAuthRoutes(app, auth);
  registerBashoRoutes(app, {
    auth,
    repositories,
    now: options.now ?? (() => new Date()),
    teamIdFactory: options.teamIdFactory ?? randomUUID,
    teamSize: options.teamSize ?? getTeamSize(),
  });
  registerAdminImportRoutes(app, {
    adminImportToken: options.adminImportToken ?? getAdminImportToken(),
    allowUnprotectedAdminImports:
      options.allowUnprotectedAdminImports ?? allowsUnprotectedAdminImports(),
    repositories,
    sourceFetch: options.sourceFetch ?? fetch,
  });
  registerAdminDemoRoutes(app, {
    allowUnprotectedDemoAdmin: options.allowUnprotectedDemoAdmin ?? false,
    demoAdminToken: options.demoAdminToken ?? getDemoAdminToken(),
    repositories,
    now: options.now ?? (() => new Date()),
  });

  return app;
}
