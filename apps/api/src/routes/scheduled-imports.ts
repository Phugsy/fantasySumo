import type { FastifyInstance } from "fastify";
import type { Repositories } from "@fantasy-sumo/db";
import { runScheduledResultsImport } from "../imports/scheduled-results.js";
import type { SourceFetch } from "../imports/types.js";

interface RouteContext {
  cronSecret?: string;
  now: () => Date;
  repositories: Repositories;
  sourceFetch: SourceFetch;
}

export function registerScheduledImportRoutes(
  app: FastifyInstance,
  context: RouteContext,
) {
  app.get("/api/cron/import-results", async (request, reply) => {
    if (context.cronSecret === undefined) {
      return reply.code(404).send({
        error: "scheduled-import-disabled",
        message: "Scheduled result imports are not enabled.",
      });
    }

    if (request.headers.authorization !== `Bearer ${context.cronSecret}`) {
      return reply.code(401).send({
        error: "scheduled-import-unauthorized",
        message: "Scheduled result imports require a valid cron secret.",
      });
    }

    try {
      const result = await runScheduledResultsImport(
        context.repositories,
        context.sourceFetch,
        { now: context.now },
      );

      request.log.info(
        {
          bashoId: result.bashoId,
          day: result.status === "skipped" ? undefined : result.day,
          japanDate: result.japanDate,
          lockedAt: result.status === "locked" ? result.lockedAt : undefined,
          reason: result.status === "skipped" ? result.reason : undefined,
          status: result.status,
        },
        "Scheduled basho update finished.",
      );

      return result;
    } catch (error) {
      request.log.error({ err: error }, "Scheduled basho update failed.");

      return reply.code(500).send({
        status: "failed",
        error: "scheduled-results-import-failed",
        message:
          error instanceof Error ? error.message : "Scheduled import failed.",
      });
    }
  });
}
