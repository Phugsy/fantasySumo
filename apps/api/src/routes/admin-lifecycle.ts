import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { Repositories } from "@fantasy-sumo/db";
import type { BashoLifecycleAction } from "@fantasy-sumo/domain";
import type { AuthService } from "../auth.js";
import { isAuthenticatedAdmin, sendAdminForbidden } from "../admin-auth.js";
import { findCurrentLiveBasho, findDemoBasho } from "./basho.js";

interface RouteContext {
  auth: AuthService;
  now: () => Date;
  repositories: Repositories;
}

const currentBashoQuerySchema = z.object({
  mode: z.enum(["demo"]).optional(),
});

export function registerAdminLifecycleRoutes(
  app: FastifyInstance,
  context: RouteContext,
) {
  app.addHook("preHandler", async (request, reply) => {
    if (!isLifecycleAdminUrl(request.url)) {
      return;
    }

    if (await isAuthenticatedAdmin(request, context.auth)) {
      return;
    }

    return sendAdminForbidden(reply);
  });

  app.get<{ Querystring: unknown }>(
    "/api/admin/basho/current",
    async (request, reply) => {
      const parsedQuery = currentBashoQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply.code(400).send({
          error: "invalid-request",
          message: "The admin basho mode is invalid.",
        });
      }

      const basho =
        parsedQuery.data.mode === "demo"
          ? await findDemoBasho(context.repositories)
          : await findCurrentLiveBasho(context.repositories);

      if (basho === undefined) {
        return reply.code(404).send({
          error: "not-found",
          message:
            parsedQuery.data.mode === "demo"
              ? "The demo basho is not available. Reset the demo fixture first."
              : "No live basho is available.",
        });
      }

      return { basho };
    },
  );

  registerLifecycleAction(app, context, "open-picks");
  registerLifecycleAction(app, context, "start");
  registerLifecycleAction(app, context, "close");
}

function registerLifecycleAction(
  app: FastifyInstance,
  context: RouteContext,
  action: BashoLifecycleAction,
) {
  app.post<{ Params: { bashoId: string } }>(
    `/api/admin/basho/:bashoId/${action}`,
    async (request, reply) => {
      const result = await context.repositories.transitionBashoLifecycle(
        request.params.bashoId,
        action,
        context.now().toISOString(),
      );

      if (result === undefined) {
        return reply.code(404).send({
          error: "not-found",
          message: `Basho ${request.params.bashoId} was not found.`,
        });
      }

      if (!result.transition.allowed) {
        return sendInvalidTransition(reply, result);
      }

      return {
        action,
        basho: result.basho,
        changed: result.transition.changed,
      };
    },
  );
}

function sendInvalidTransition(
  reply: FastifyReply,
  result: Exclude<
    Awaited<ReturnType<Repositories["transitionBashoLifecycle"]>>,
    undefined
  >,
) {
  if (result.transition.allowed) {
    return;
  }

  return reply.code(409).send({
    error: result.transition.code,
    message: result.transition.message,
    basho: result.basho,
  });
}

function isLifecycleAdminUrl(url: string): boolean {
  return (
    url.startsWith("/api/admin/basho/current") ||
    /^\/api\/admin\/basho\/[^/]+\/(open-picks|start|close)(?:\?|$)/.test(url)
  );
}
