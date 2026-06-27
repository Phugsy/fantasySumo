import type { FastifyInstance, FastifyReply } from "fastify";
import type { Repositories, SqliteDatabase } from "@fantasy-sumo/db";
import {
  DEMO_BASHO_ID,
  advanceDemoBashoDay,
  completeDemoBasho,
  resetDemoProgression,
  startDemoBasho,
} from "@fantasy-sumo/db";

interface RouteContext {
  db: SqliteDatabase;
  repositories: Repositories;
  now: () => Date;
}

export function registerAdminDemoRoutes(
  app: FastifyInstance,
  context: RouteContext,
) {
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
