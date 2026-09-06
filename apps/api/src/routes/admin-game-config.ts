import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Repositories } from "@fantasy-sumo/db";
import type { AuthService } from "../auth.js";
import { isAuthenticatedAdmin, sendAdminForbidden } from "../admin-auth.js";
import { getEffectiveBashoGameConfig } from "../game-config.js";

interface RouteContext {
  auth: AuthService;
  defaultTeamSize: number;
  repositories: Repositories;
}

const gameConfigBodySchema = z.object({
  teamSize: z.number().int().min(1).max(42),
});

export function registerAdminGameConfigRoutes(
  app: FastifyInstance,
  context: RouteContext,
) {
  app.addHook("preHandler", async (request, reply) => {
    if (!isGameConfigAdminUrl(request.routeOptions.url ?? "")) {
      return;
    }

    if (await isAuthenticatedAdmin(request, context.auth)) {
      return;
    }

    return sendAdminForbidden(reply);
  });

  app.get<{ Params: { bashoId: string } }>(
    "/api/admin/basho/:bashoId/game-config",
    async (request, reply) => {
      const basho = await context.repositories.getBasho(request.params.bashoId);

      if (basho === undefined) {
        return reply.code(404).send({
          error: "not-found",
          message: `Basho ${request.params.bashoId} was not found.`,
        });
      }

      const [gameConfig, teams] = await Promise.all([
        getEffectiveBashoGameConfig(
          context.repositories,
          basho.id,
          context.defaultTeamSize,
        ),
        context.repositories.listFantasyTeamsForBasho(basho.id),
      ]);

      return {
        bashoId: basho.id,
        gameConfig,
        canChangeScoringMode:
          basho.status === "upcoming" && !gameConfig.scoringLocked,
        canChangeTeamSize: basho.status === "upcoming" && teams.length === 0,
      };
    },
  );

  app.put<{
    Params: { bashoId: string };
    Body: unknown;
  }>("/api/admin/basho/:bashoId/game-config", async (request, reply) => {
    const parsedBody = gameConfigBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.code(400).send({
        error: "invalid-request",
        message: "Game configuration request is invalid.",
        details: parsedBody.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const result = await context.repositories.setBashoGameConfigIfConfigurable(
      {
        bashoId: request.params.bashoId,
        teamSize: parsedBody.data.teamSize,
      },
      context.defaultTeamSize,
    );

    if (result.status === "not-found") {
      return reply.code(404).send({
        error: "not-found",
        message: `Basho ${request.params.bashoId} was not found.`,
      });
    }

    if (result.status === "locked") {
      return reply.code(409).send({
        error: "game-config-locked",
        message:
          result.reason === "teams-exist"
            ? "Team size cannot change after the first stable has been submitted."
            : "Team size cannot change after picks have closed.",
        reason: result.reason,
        basho: result.basho,
        gameConfig: await getEffectiveBashoGameConfig(
          context.repositories,
          result.basho.id,
          context.defaultTeamSize,
        ),
      });
    }

    return {
      bashoId: result.config.bashoId,
      changed: result.changed,
      gameConfig: await getEffectiveBashoGameConfig(
        context.repositories,
        result.config.bashoId,
        context.defaultTeamSize,
      ),
      canChangeScoringMode: !(
        await context.repositories.getBashoScoringConfig(result.config.bashoId)
      )?.locked,
      canChangeTeamSize: result.canChangeTeamSize,
    };
  });
  app.put<{ Params: { bashoId: string }; Body: unknown }>(
    "/api/admin/basho/:bashoId/game-config/scoring",
    async (request, reply) => {
      const body = z
        .object({ scoringMode: z.enum(["wins-v0", "achievements-v1"]) })
        .strict()
        .safeParse(request.body);
      if (!body.success)
        return reply.code(400).send({
          error: "invalid-request",
          message: "Select a supported scoring mode.",
        });
      const result = await context.repositories.setBashoScoringMode(
        request.params.bashoId,
        body.data.scoringMode,
      );
      if (result === "not-found")
        return reply
          .code(404)
          .send({ error: "not-found", message: "Basho not found." });
      if (result === "locked")
        return reply.code(409).send({
          error: "scoring-locked",
          message:
            "Official scoring cannot change after picks have locked, even if picks reopen.",
        });
      const gameConfig = await getEffectiveBashoGameConfig(
        context.repositories,
        request.params.bashoId,
        context.defaultTeamSize,
      );
      return { bashoId: request.params.bashoId, gameConfig };
    },
  );
}

function isGameConfigAdminUrl(url: string): boolean {
  return /^\/api\/admin\/basho\/[^/]+\/game-config(?:\/scoring)?(?:\?|$)/.test(
    url,
  );
}
