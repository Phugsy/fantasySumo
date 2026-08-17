import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import {
  createDatabaseClient,
  createRepositories,
  type AppDatabase,
} from "@fantasy-sumo/db";
import {
  getAdminImportToken,
  getAdminUserIds,
  getAuthMode,
  getCronSecret,
  getDemoAdminToken,
  getNeonAuthAudience,
  getNeonAuthIssuer,
  getNeonAuthJwksUrl,
  getTeamSize,
} from "./config.js";
import {
  createAuthService,
  registerAuthRoutes,
  type AuthClientSessionFailureReporter,
  type AuthenticatedUser,
  type NeonJwtVerificationFailureReporter,
} from "./auth.js";
import { registerAdminDemoRoutes } from "./routes/admin-demo.js";
import { registerAdminImportRoutes } from "./routes/admin-imports.js";
import { registerAdminLifecycleRoutes } from "./routes/admin-lifecycle.js";
import { registerBashoRoutes } from "./routes/basho.js";
import { registerScheduledImportRoutes } from "./routes/scheduled-imports.js";

interface AppOptions {
  db?: AppDatabase;
  now?: () => Date;
  sourceFetch?: typeof fetch;
  teamIdFactory?: () => string;
  teamSize?: number;
  demoAdminToken?: string;
  adminImportToken?: string;
  adminUserIds?: readonly string[];
  authMode?: "local" | "neon";
  neonAuthAudience?: string;
  neonAuthIssuer?: string;
  neonAuthJwksUrl?: string;
  neonJwtVerifier?: (token: string) => Promise<AuthenticatedUser | undefined>;
  neonJwtVerificationFailureReporter?: NeonJwtVerificationFailureReporter;
  authClientSessionFailureReporter?: AuthClientSessionFailureReporter;
  cronSecret?: string;
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
    adminUserIds: options.adminUserIds ?? getAdminUserIds(),
    mode: options.authMode ?? getAuthMode(),
    neonAuthAudience: options.neonAuthAudience ?? getNeonAuthAudience(),
    neonAuthIssuer: options.neonAuthIssuer ?? getNeonAuthIssuer(),
    neonAuthJwksUrl: options.neonAuthJwksUrl ?? getNeonAuthJwksUrl(),
    neonJwtVerifier: options.neonJwtVerifier,
    neonJwtVerificationFailureReporter:
      options.neonJwtVerificationFailureReporter,
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

  registerAuthRoutes(app, auth, {
    authClientSessionFailureReporter: options.authClientSessionFailureReporter,
  });
  registerBashoRoutes(app, {
    auth,
    repositories,
    now: options.now ?? (() => new Date()),
    teamIdFactory: options.teamIdFactory ?? randomUUID,
    teamSize: options.teamSize ?? getTeamSize(),
  });
  registerAdminImportRoutes(app, {
    adminImportToken: options.adminImportToken ?? getAdminImportToken(),
    allowUnprotectedAdminImports: options.allowUnprotectedAdminImports ?? false,
    auth,
    repositories,
    sourceFetch: options.sourceFetch ?? fetch,
  });
  registerAdminDemoRoutes(app, {
    allowUnprotectedDemoAdmin: options.allowUnprotectedDemoAdmin ?? false,
    auth,
    demoAdminToken: options.demoAdminToken ?? getDemoAdminToken(),
    repositories,
    now: options.now ?? (() => new Date()),
  });
  registerAdminLifecycleRoutes(app, {
    auth,
    now: options.now ?? (() => new Date()),
    repositories,
  });
  registerScheduledImportRoutes(app, {
    cronSecret: options.cronSecret ?? getCronSecret(),
    now: options.now ?? (() => new Date()),
    repositories,
    sourceFetch: options.sourceFetch ?? fetch,
  });
  return app;
}
