import { registerPushRoutes } from "./routes/push.js";
import { installPushPublicationObserver, type PushRuntime } from "./push.js";
import { registerJokerRoutes } from "./routes/jokers.js";
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
import { registerAdminGameConfigRoutes } from "./routes/admin-game-config.js";
import { registerAdminImportRoutes } from "./routes/admin-imports.js";
import { registerAdminLifecycleRoutes } from "./routes/admin-lifecycle.js";
import { registerBashoRoutes } from "./routes/basho.js";
import { registerScheduledImportRoutes } from "./routes/scheduled-imports.js";

interface AppOptions {
  pushRuntime?: PushRuntime;
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
  if (options.pushRuntime) {
    const origin = new URL(options.pushRuntime.origin);
    if (
      origin.origin !== options.pushRuntime.origin ||
      (origin.protocol !== "https:" &&
        !["localhost", "127.0.0.1"].includes(origin.hostname))
    )
      throw new Error("invalid-push-origin");
    installPushPublicationObserver(
      repositories,
      options.pushRuntime,
      options.now ?? (() => new Date()),
    );
  }
  const defaultTeamSize = options.teamSize ?? getTeamSize();
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

  registerPushRoutes(app, {
    auth,
    repositories,
    now: options.now ?? (() => new Date()),
    runtime: options.pushRuntime,
  });
  registerAuthRoutes(app, auth, {
    authClientSessionFailureReporter: options.authClientSessionFailureReporter,
  });
  registerJokerRoutes(app, {
    auth,
    repositories,
    now: options.now ?? (() => new Date()),
  });
  registerBashoRoutes(app, {
    auth,
    defaultTeamSize,
    repositories,
    now: options.now ?? (() => new Date()),
    teamIdFactory: options.teamIdFactory ?? randomUUID,
  });
  registerAdminGameConfigRoutes(app, {
    auth,
    defaultTeamSize,
    repositories,
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
