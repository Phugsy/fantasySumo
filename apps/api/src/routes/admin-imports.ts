import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
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
  adminImportToken?: string;
  allowUnprotectedAdminImports: boolean;
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
  app.addHook("preHandler", async (request, reply) => {
    if (!request.url.startsWith("/api/admin/import-banzuke")) {
      return;
    }

    return authorizeAdminImport(request, reply, context);
  });

  app.addHook("preHandler", async (request, reply) => {
    if (!request.url.includes("/import-results")) {
      return;
    }

    return authorizeAdminImport(request, reply, context);
  });

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

      return await importBanzuke(context.repositories, command, {
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

      return await importBoutResults(context.repositories, command, {
        dryRun: parsedQuery.data.dryRun,
      });
    } catch (error) {
      return sendImportError(reply, error);
    }
  });
}

function authorizeAdminImport(
  request: FastifyRequest,
  reply: FastifyReply,
  context: RouteContext,
) {
  if (context.allowUnprotectedAdminImports) {
    return;
  }

  if (context.adminImportToken === undefined) {
    return reply.code(404).send({
      error: "admin-import-disabled",
      message: "Admin import controls are not enabled.",
    });
  }

  if (getSuppliedAdminImportToken(request) !== context.adminImportToken) {
    return reply.code(401).send({
      error: "admin-import-unauthorized",
      message: "Admin import controls require a valid token.",
    });
  }
}

function getSuppliedAdminImportToken(
  request: FastifyRequest,
): string | undefined {
  const headerToken = request.headers["x-admin-import-token"];

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
