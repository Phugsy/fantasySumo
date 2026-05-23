import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Repositories } from "@fantasy-sumo/db";
import type { FantasyPick, FantasyTeam } from "@fantasy-sumo/domain";
import {
  calculateLeaderboard,
  validateFantasyPicks,
} from "@fantasy-sumo/domain";

interface RouteContext {
  repositories: Repositories;
  now: () => Date;
  teamIdFactory: () => string;
  teamSize: number;
}

const createTeamBodySchema = z.object({
  displayName: z.string().trim().min(1),
  ownerName: z.string().trim().optional(),
  rikishiIds: z.array(z.string().trim().min(1)),
});

export function registerBashoRoutes(
  app: FastifyInstance,
  context: RouteContext,
) {
  app.get("/api/basho/current", async (_request, reply) => {
    const currentBasho = findCurrentBasho(context.repositories);

    if (currentBasho === undefined) {
      return reply.code(404).send({
        error: "not-found",
        message: "No basho is available.",
      });
    }

    return currentBasho;
  });

  app.get<{
    Params: { bashoId: string };
  }>("/api/basho/:bashoId/rikishi", async (request, reply) => {
    const basho = context.repositories.getBasho(request.params.bashoId);

    if (basho === undefined) {
      return reply.code(404).send({
        error: "not-found",
        message: `Basho ${request.params.bashoId} was not found.`,
      });
    }

    const rikishiById = new Map(
      context.repositories
        .listRikishi()
        .map((rikishi) => [rikishi.id, rikishi]),
    );
    const rikishi = context.repositories
      .listBanzukeEntriesForBasho(basho.id)
      .map((entry) => {
        const rikishiEntry = rikishiById.get(entry.rikishiId);

        return {
          id: entry.rikishiId,
          shikona: rikishiEntry?.shikona ?? entry.rikishiId,
          heya: rikishiEntry?.heya,
          rank: entry.rank,
          rankOrder: entry.rankOrder,
        };
      });

    return {
      basho,
      rikishi,
    };
  });

  app.post<{
    Params: { bashoId: string };
    Body: unknown;
  }>("/api/basho/:bashoId/teams", async (request, reply) => {
    const basho = context.repositories.getBasho(request.params.bashoId);

    if (basho === undefined) {
      return reply.code(404).send({
        error: "not-found",
        message: `Basho ${request.params.bashoId} was not found.`,
      });
    }

    const parsedBody = createTeamBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.code(400).send({
        error: "invalid-request",
        message: "Team creation request is invalid.",
        details: parsedBody.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const { displayName, ownerName, rikishiIds } = parsedBody.data;
    const teamId = `team-${context.teamIdFactory()}`;
    const picks = rikishiIds.map(
      (rikishiId): FantasyPick => ({
        teamId,
        rikishiId,
      }),
    );
    const pickErrors = validateFantasyPicks(picks, {
      teamSize: context.teamSize,
    });

    if (pickErrors.length > 0) {
      return reply.code(400).send({
        error: "invalid-picks",
        message: "Fantasy team picks are invalid.",
        details: pickErrors,
      });
    }

    const validRikishiIds = new Set(
      context.repositories
        .listBanzukeEntriesForBasho(basho.id)
        .map((entry) => entry.rikishiId),
    );
    const invalidRikishiIds = rikishiIds.filter(
      (rikishiId) => !validRikishiIds.has(rikishiId),
    );

    if (invalidRikishiIds.length > 0) {
      return reply.code(400).send({
        error: "invalid-picks",
        message: "Fantasy team picks include rikishi outside this basho.",
        details: invalidRikishiIds.map((rikishiId) => ({
          code: "unknown-rikishi",
          message: `Rikishi ${rikishiId} is not available for basho ${basho.id}.`,
          rikishiId,
        })),
      });
    }

    const team: FantasyTeam = {
      id: teamId,
      bashoId: basho.id,
      displayName,
      ...(ownerName === undefined || ownerName.length === 0
        ? {}
        : { ownerName }),
      createdAt: context.now().toISOString(),
    };

    context.repositories.insertFantasyTeamWithPicks(team, picks);

    return reply.code(201).send({
      team,
      picks: context.repositories.listFantasyPicksForTeam(team.id),
    });
  });

  app.get<{
    Params: { bashoId: string; teamId: string };
  }>("/api/basho/:bashoId/teams/:teamId", async (request, reply) => {
    const basho = context.repositories.getBasho(request.params.bashoId);

    if (basho === undefined) {
      return reply.code(404).send({
        error: "not-found",
        message: `Basho ${request.params.bashoId} was not found.`,
      });
    }

    const team = context.repositories.getFantasyTeam(request.params.teamId);

    if (team === undefined || team.bashoId !== basho.id) {
      return reply.code(404).send({
        error: "not-found",
        message: `Team ${request.params.teamId} was not found for basho ${basho.id}.`,
      });
    }

    return {
      team,
      picks: context.repositories.listFantasyPicksForTeam(team.id),
    };
  });

  app.get<{
    Params: { bashoId: string };
  }>("/api/basho/:bashoId/leaderboard", async (request, reply) => {
    const basho = context.repositories.getBasho(request.params.bashoId);

    if (basho === undefined) {
      return reply.code(404).send({
        error: "not-found",
        message: `Basho ${request.params.bashoId} was not found.`,
      });
    }

    return {
      bashoId: basho.id,
      leaderboard: calculateLeaderboard(
        context.repositories.listFantasyTeamsForBasho(basho.id),
        context.repositories.listFantasyPicksForBasho(basho.id),
        context.repositories.listBoutResultsForBasho(basho.id),
      ),
    };
  });
}

function findCurrentBasho(repositories: Repositories) {
  const bashos = repositories.listBashos();

  return bashos.find((basho) => basho.status === "active") ?? bashos.at(-1);
}
