import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Repositories } from "@fantasy-sumo/db";
import {
  fetchJsaBanzukeImport,
  fetchSumoApiScheduleImport,
} from "../imports/adapters.js";
import {
  importBanzuke,
  importScheduledBouts,
  ImportValidationError,
} from "../imports/service.js";
import { importDailyResultsAndFollowingSchedule } from "../imports/daily-update.js";
import type { SourceFetch } from "../imports/types.js";
import type { AuthService } from "../auth.js";
import { isAuthenticatedAdmin, sendAdminForbidden } from "../admin-auth.js";

interface RouteContext {
  adminImportToken?: string;
  allowUnprotectedAdminImports: boolean;
  auth: AuthService;
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
  confirmedSourceBashoId: z.string().trim().min(1).optional(),
  divisionId: z.number().int().positive().optional(),
  expectedBashoId: z.string().trim().min(1).optional(),
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
    if (
      !request.url.startsWith("/api/admin/basho/") ||
      (!request.url.includes("/import-results") &&
        !request.url.includes("/import-schedule"))
    ) {
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
      const { confirmedSourceBashoId, expectedBashoId, ...sourceOptions } =
        parsedBody.data;
      const command = await fetchJsaBanzukeImport(
        context.sourceFetch,
        sourceOptions,
      );

      if (
        !parsedQuery.data.dryRun &&
        command.basho.id !== confirmedSourceBashoId
      ) {
        return reply.code(409).send({
          error: "basho-target-mismatch",
          message: `The source banzuke is for ${command.basho.id}, but that basho was not confirmed for this import. No data was imported.`,
          confirmedSourceBashoId,
          expectedBashoId,
          sourceBashoId: command.basho.id,
        });
      }

      const result = await importBanzuke(context.repositories, command, {
        dryRun: parsedQuery.data.dryRun,
      });
      const targetBasho = parsedQuery.data.dryRun
        ? undefined
        : await context.repositories.getBasho(command.basho.id);

      return {
        ...result,
        targetBasho,
        targetBashoId: command.basho.id,
      };
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
      return await importDailyResultsAndFollowingSchedule(
        context.repositories,
        context.sourceFetch,
        {
          bashoId: request.params.bashoId,
          day: parsedBody.data.day,
          division: parsedBody.data.division,
          dryRun: parsedQuery.data.dryRun,
        },
      );
    } catch (error) {
      return sendImportError(reply, error);
    }
  });

  app.post<{
    Params: { bashoId: string };
    Querystring: unknown;
    Body: unknown;
  }>("/api/admin/basho/:bashoId/import-schedule", async (request, reply) => {
    const parsedQuery = dryRunQuerySchema.safeParse(request.query);
    const parsedBody = importResultsBodySchema.safeParse(request.body ?? {});

    if (!parsedQuery.success || !parsedBody.success) {
      return reply.code(400).send({
        error: "invalid-request",
        message: "Schedule import request is invalid.",
        details: [
          ...formatZodIssues(parsedQuery),
          ...formatZodIssues(parsedBody),
        ],
      });
    }

    try {
      const command = await fetchSumoApiScheduleImport(context.sourceFetch, {
        bashoId: request.params.bashoId,
        day: parsedBody.data.day,
        division: parsedBody.data.division,
      });

      return await importScheduledBouts(context.repositories, command, {
        dryRun: parsedQuery.data.dryRun,
      });
    } catch (error) {
      return sendImportError(reply, error);
    }
  });
}

async function authorizeAdminImport(
  request: FastifyRequest,
  reply: FastifyReply,
  context: RouteContext,
) {
  if (context.allowUnprotectedAdminImports) {
    return;
  }

  if (
    context.adminImportToken !== undefined &&
    getSuppliedAdminImportToken(request) === context.adminImportToken
  ) {
    return;
  }

  if (await isAuthenticatedAdmin(request, context.auth)) {
    return;
  }

  return sendAdminForbidden(reply);
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
