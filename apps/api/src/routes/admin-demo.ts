import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Repositories, SqliteDatabase } from "@fantasy-sumo/db";
import {
  DEMO_BASHO_ID,
  advanceDemoBashoDay,
  completeDemoBasho,
  resetDemoProgression,
  startDemoBasho,
} from "@fantasy-sumo/db";

interface RouteContext {
  allowUnprotectedDemoAdmin: boolean;
  db: SqliteDatabase;
  demoAdminToken?: string;
  repositories: Repositories;
  now: () => Date;
}

export function registerAdminDemoRoutes(
  app: FastifyInstance,
  context: RouteContext,
) {
  app.addHook("preHandler", async (request, reply) => {
    if (!request.url.startsWith("/api/admin/demo/")) {
      return;
    }

    return authorizeDemoAdmin(request, reply, context);
  });

  app.post("/api/admin/demo/reset", async () => {
    resetDemoProgression(context.db);

    return {
      action: "reset",
      basho: context.repositories.getBasho(DEMO_BASHO_ID),
      appliedResults: 0,
    };
  });

  app.post("/api/admin/demo/start", async (_request, reply) =>
    sendDemoProgressionResult(reply, "start", () =>
      startDemoBasho(context.repositories, context.now),
    ),
  );

  app.post("/api/admin/demo/advance-day", async (_request, reply) =>
    sendDemoProgressionResult(reply, "advance-day", () =>
      advanceDemoBashoDay(context.repositories, context.now),
    ),
  );

  app.post("/api/admin/demo/complete", async (_request, reply) =>
    sendDemoProgressionResult(reply, "complete", () =>
      completeDemoBasho(context.repositories, context.now),
    ),
  );
}

function authorizeDemoAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  context: RouteContext,
) {
  if (context.allowUnprotectedDemoAdmin) {
    return;
  }

  if (context.demoAdminToken === undefined) {
    return reply.code(404).send({
      error: "demo-admin-disabled",
      message: "Demo admin controls are not enabled.",
    });
  }

  if (getSuppliedDemoAdminToken(request) !== context.demoAdminToken) {
    return reply.code(401).send({
      error: "demo-admin-unauthorized",
      message: "Demo admin controls require a valid token.",
    });
  }
}

function getSuppliedDemoAdminToken(
  request: FastifyRequest,
): string | undefined {
  const headerToken = request.headers["x-demo-admin-token"];

  if (Array.isArray(headerToken)) {
    return headerToken[0];
  }

  if (headerToken !== undefined) {
    return headerToken;
  }

  const authorization = request.headers.authorization;
  const bearerPrefix = "Bearer ";

  if (authorization?.startsWith(bearerPrefix)) {
    return authorization.slice(bearerPrefix.length);
  }

  return undefined;
}

function sendDemoProgressionResult(
  reply: FastifyReply,
  action: string,
  run: () => ReturnType<typeof startDemoBasho>,
) {
  try {
    return {
      action,
      ...run(),
    };
  } catch (error) {
    return reply.code(404).send({
      error: "demo-basho-not-found",
      message:
        error instanceof Error
          ? error.message
          : "Demo basho was not found. Run demo reset first.",
    });
  }
}
