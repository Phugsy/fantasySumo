import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { JokerError, type Repositories } from "@fantasy-sumo/db";
import type { AuthService } from "../auth.js";
import { isAuthenticatedAdmin, sendAdminForbidden } from "../admin-auth.js";

export function registerJokerRoutes(
  app: FastifyInstance,
  context: { repositories: Repositories; auth: AuthService; now: () => Date },
) {
  app.get<{ Params: { bashoId: string } }>(
    "/api/admin/basho/:bashoId/jokers",
    async (request, reply) => {
      if (!(await isAuthenticatedAdmin(request, context.auth)))
        return sendAdminForbidden(reply);
      return {
        trial:
          (await context.repositories.getLiveJokerTrial(
            request.params.bashoId,
          )) ?? null,
      };
    },
  );
  app.post<{ Params: { bashoId: string }; Body: unknown }>(
    "/api/admin/basho/:bashoId/jokers",
    async (request, reply) => {
      if (!(await isAuthenticatedAdmin(request, context.auth)))
        return sendAdminForbidden(reply);
      const parsed = z
        .object({
          confirmBashoId: z.literal("2026-11"),
          acceptPreStartTrial: z.literal(true),
        })
        .strict()
        .safeParse(request.body);
      if (
        !parsed.success ||
        request.params.bashoId !== parsed.data.confirmBashoId
      )
        return reply.code(400).send({ error: "confirmation-required" });
      const user = await context.auth.getCurrentUser(request);
      try {
        return {
          trial: await context.repositories.enableNovemberJokers(
            request.params.bashoId,
            user!.id,
            context.now,
          ),
        };
      } catch (error) {
        if (!(error instanceof JokerError)) throw error;
        return reply.code(error.code === "basho-not-found" ? 404 : 409).send({
          error: error.code,
          message: `Joker trial cannot be enabled: ${error.code}.`,
        });
      }
    },
  );
  const commandSchema = z
    .object({
      day: z.number().int().min(1).max(15),
      rikishiId: z.string().min(1).max(120).nullable(),
      boutId: z.string().min(1).max(200).nullable(),
      opponentId: z.string().min(1).max(120).nullable(),
      expectedRevision: z.number().int().min(0),
      requestId: z.string().min(1).max(80),
    })
    .strict();
  for (const method of ["GET", "PUT"] as const)
    app.route<{ Params: { bashoId: string }; Body: unknown }>({
      method,
      url: "/api/basho/:bashoId/my-jokers",
      handler: async (request, reply) => {
        const user = await context.auth.getCurrentUser(request);
        if (!user)
          return reply.code(401).send({
            error: "unauthenticated",
            message: "Sign in to manage your jokers.",
          });
        const parsed =
          method === "PUT" ? commandSchema.safeParse(request.body) : undefined;
        if (parsed && !parsed.success)
          return reply.code(400).send({
            error: "invalid-command",
            message: "Invalid joker request.",
          });
        try {
          const snapshot = await context.repositories.getJokerSnapshot(
            request.params.bashoId,
            context.now,
            user.id,
            parsed?.success
              ? { ...parsed.data, ownerUserId: user.id }
              : undefined,
          );
          if (!snapshot && method === "PUT")
            return reply.code(409).send({
              error: "trial-disabled",
              message: "Joker trial is not enabled.",
            });
          return { snapshot: snapshot ?? null };
        } catch (error) {
          if (!(error instanceof JokerError)) throw error;
          return reply
            .code(
              ["team-not-found", "basho-not-found"].includes(error.code)
                ? 404
                : 409,
            )
            .send({
              error: error.code,
              message: `Joker action unavailable: ${error.code}. Refresh the window and try again.`,
            });
        }
      },
    });
}
