import type { FastifyInstance } from "fastify";
import type { Repositories } from "@fantasy-sumo/db";
import { runScheduledPickLock } from "../scheduled-pick-lock.js";

interface RouteContext {
  cronSecret?: string;
  now: () => Date;
  repositories: Repositories;
}

export function registerScheduledPickLockRoutes(
  app: FastifyInstance,
  context: RouteContext,
) {
  app.get("/api/cron/lock-picks", async (request, reply) => {
    if (context.cronSecret === undefined) {
      return reply.code(404).send({
        error: "scheduled-pick-lock-disabled",
        message: "Scheduled pick locking is not enabled.",
      });
    }

    if (request.headers.authorization !== `Bearer ${context.cronSecret}`) {
      return reply.code(401).send({
        error: "scheduled-pick-lock-unauthorized",
        message: "Scheduled pick locking requires a valid cron secret.",
      });
    }

    try {
      const result = await runScheduledPickLock(context.repositories, {
        now: context.now,
      });

      request.log.info(result, "Scheduled pick lock finished.");

      return result;
    } catch (error) {
      request.log.error({ err: error }, "Scheduled pick lock failed.");

      return reply.code(500).send({
        status: "failed",
        error: "scheduled-pick-lock-failed",
        message:
          error instanceof Error
            ? error.message
            : "Scheduled pick lock failed.",
      });
    }
  });
}
