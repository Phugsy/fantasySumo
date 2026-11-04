import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { JokerError, type Repositories } from "@fantasy-sumo/db";
import type { AuthService } from "../auth.js";

export function registerJokerRoutes(
  app: FastifyInstance,
  context: { repositories: Repositories; auth: AuthService; now: () => Date },
) {
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
