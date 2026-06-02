import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { Repositories } from "@fantasy-sumo/db";
import {
  fetchJsaBanzukeImport,
  fetchSumoApiResultsImport,
} from "../imports/adapters.js";
import {
  importBanzuke,
  importBoutResults,
  ImportValidationError,
} from "../imports/service.js";
import type { SourceFetch } from "../imports/types.js";

interface RouteContext {
  repositories: Repositories;
  sourceFetch: SourceFetch;
}

const dryRunQuerySchema = z.object({
  dryRun: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

const importBanzukeBodySchema = z.object({
  divisionId: z.number().int().positive().optional(),
  page: z.number().int().positive().optional(),
});

const importResultsBodySchema = z.object({
  day: z.number().int().min(1).max(15),
  division: z.string().trim().min(1).optional(),
});

export function registerAdminImportRoutes(
  app: FastifyInstance,
  context: RouteContext,
) {
  app.post<{
    Querystring: unknown;
    Body: unknown;
  }>("/api/admin/import-banzuke", async (request, reply) => {
    const parsedQuery = dryRunQuerySchema.safeParse(request.query);
    const parsedBody = importBanzukeBodySchema.safeParse(request.body ?? {});

    if (!parsedQuery.success || !parsedBody.success) {
      return reply.code(400).send({
        error: "invalid-request",
        message: "Banzuke import request is invalid.",
        details: [
          ...formatZodIssues(parsedQuery),
          ...formatZodIssues(parsedBody),
        ],
      });
    }

    try {
      const command = await fetchJsaBanzukeImport(
        context.sourceFetch,
        parsedBody.data,
      );

      return importBanzuke(context.repositories, command, {
        dryRun: parsedQuery.data.dryRun,
      });
    } catch (error) {
      return sendImportError(reply, error);
    }
  });

  app.post<{
    Params: { bashoId: string };
    Querystring: unknown;
    Body: unknown;
  }>("/api/admin/basho/:bashoId/import-results", async (request, reply) => {
    const parsedQuery = dryRunQuerySchema.safeParse(request.query);
    const parsedBody = importResultsBodySchema.safeParse(request.body ?? {});

    if (!parsedQuery.success || !parsedBody.success) {
      return reply.code(400).send({
        error: "invalid-request",
        message: "Results import request is invalid.",
        details: [
          ...formatZodIssues(parsedQuery),
          ...formatZodIssues(parsedBody),
        ],
      });
    }

    try {
      const command = await fetchSumoApiResultsImport(context.sourceFetch, {
        bashoId: request.params.bashoId,
        day: parsedBody.data.day,
        division: parsedBody.data.division,
      });

      return importBoutResults(context.repositories, command, {
        dryRun: parsedQuery.data.dryRun,
      });
    } catch (error) {
      return sendImportError(reply, error);
    }
  });
}

function formatZodIssues(result: z.ZodSafeParseResult<unknown>) {
  if (result.success) {
    return [];
  }

  return result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function sendImportError(reply: FastifyReply, error: unknown) {
  if (error instanceof ImportValidationError) {
    return reply.code(400).send({
      error: "invalid-import",
      message: error.message,
      details: error.issues,
    });
  }

  return reply.code(502).send({
    error: "source-import-failed",
    message: error instanceof Error ? error.message : "Import failed.",
  });
}
