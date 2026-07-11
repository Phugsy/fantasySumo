import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Repositories } from "@fantasy-sumo/db";
import type { FantasyPick, FantasyTeam } from "@fantasy-sumo/domain";
import type { AuthService } from "../auth.js";
import {
  calculateLeaderboard,
  canEditFantasyPicks,
  getPickLockMessage,
  validateFantasyPicks,
} from "@fantasy-sumo/domain";

interface RouteContext {
  auth: AuthService;
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
    const currentBasho = await findCurrentBasho(context.repositories);

    if (currentBasho === undefined) {
      return reply.code(404).send({
        error: "not-found",
        message: "No basho is available.",
      });
    }

    return {
      ...currentBasho,
      teamSize: context.teamSize,
    };
  });

  app.get<{
    Params: { bashoId: string };
  }>("/api/basho/:bashoId/rikishi", async (request, reply) => {
    const basho = await context.repositories.getBasho(request.params.bashoId);

    if (basho === undefined) {
      return reply.code(404).send({
        error: "not-found",
        message: `Basho ${request.params.bashoId} was not found.`,
      });
    }

    const rikishiById = new Map(
      (await context.repositories.listRikishi()).map((rikishi) => [
        rikishi.id,
        rikishi,
      ]),
    );
    const rikishi = (
      await context.repositories.listBanzukeEntriesForBasho(basho.id)
    ).map((entry) => {
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
    const currentUser = await context.auth.getCurrentUser(request);

    if (currentUser === undefined) {
      return reply.code(401).send({
        error: "unauthenticated",
        message: "Sign in before creating a fantasy team.",
      });
    }

    const basho = await context.repositories.getBasho(request.params.bashoId);

    if (basho === undefined) {
      return reply.code(404).send({
        error: "not-found",
        message: `Basho ${request.params.bashoId} was not found.`,
      });
    }

    if (!canEditFantasyPicks(basho)) {
      return reply.code(409).send({
        error: "picks-locked",
        message:
          getPickLockMessage(basho) ??
          "Fantasy team picks are locked for this basho.",
        bashoStatus: basho.status,
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

    const { displayName, rikishiIds } = parsedBody.data;
    const existingTeam = await context.repositories.getFantasyTeamForOwner(
      basho.id,
      currentUser.id,
    );
    const teamId = existingTeam?.id ?? `team-${context.teamIdFactory()}`;
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
      (await context.repositories.listBanzukeEntriesForBasho(basho.id)).map(
        (entry) => entry.rikishiId,
      ),
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
      ownerUserId: currentUser.id,
      ...(currentUser.displayName === undefined ||
      currentUser.displayName.length === 0
        ? {}
        : { ownerName: currentUser.displayName }),
      createdAt: existingTeam?.createdAt ?? context.now().toISOString(),
    };

    await context.repositories.saveFantasyTeamWithPicks(team, picks);

    return reply.code(existingTeam === undefined ? 201 : 200).send({
      team,
      picks: await context.repositories.listFantasyPicksForTeam(team.id),
    });
  });

  app.get<{
    Params: { bashoId: string };
  }>("/api/basho/:bashoId/my-team", async (request, reply) => {
    const currentUser = await context.auth.getCurrentUser(request);

    if (currentUser === undefined) {
      return reply.code(401).send({
        error: "unauthenticated",
        message: "Sign in before viewing your fantasy team.",
      });
    }

    const basho = await context.repositories.getBasho(request.params.bashoId);

    if (basho === undefined) {
      return reply.code(404).send({
        error: "not-found",
        message: `Basho ${request.params.bashoId} was not found.`,
      });
    }

    const team = await context.repositories.getFantasyTeamForOwner(
      basho.id,
      currentUser.id,
    );

    if (team === undefined) {
      return reply.code(404).send({
        error: "not-found",
        message: "You do not have a fantasy team for this basho yet.",
      });
    }

    return {
      team,
      picks: await context.repositories.listFantasyPicksForTeam(team.id),
    };
  });

  app.get<{
    Params: { bashoId: string; teamId: string };
  }>("/api/basho/:bashoId/teams/:teamId", async (request, reply) => {
    const currentUser = await context.auth.getCurrentUser(request);
    const basho = await context.repositories.getBasho(request.params.bashoId);

    if (basho === undefined) {
      return reply.code(404).send({
        error: "not-found",
        message: `Basho ${request.params.bashoId} was not found.`,
      });
    }

    const team = await context.repositories.getFantasyTeam(
      request.params.teamId,
    );

    if (team === undefined || team.bashoId !== basho.id) {
      return reply.code(404).send({
        error: "not-found",
        message: `Team ${request.params.teamId} was not found for basho ${basho.id}.`,
      });
    }

    if (
      team.ownerUserId !== undefined &&
      (currentUser === undefined || team.ownerUserId !== currentUser.id)
    ) {
      return reply.code(403).send({
        error: "forbidden",
        message: "You cannot view another user's private fantasy team.",
      });
    }

    return {
      team,
      picks: await context.repositories.listFantasyPicksForTeam(team.id),
    };
  });

  app.get<{
    Params: { bashoId: string };
  }>("/api/basho/:bashoId/leaderboard", async (request, reply) => {
    const basho = await context.repositories.getBasho(request.params.bashoId);

    if (basho === undefined) {
      return reply.code(404).send({
        error: "not-found",
        message: `Basho ${request.params.bashoId} was not found.`,
      });
    }

    const boutResults = await context.repositories.listBoutResultsForBasho(
      basho.id,
    );

    return {
      basho,
      bashoId: basho.id,
      totalDays: getBashoTotalDays(basho),
      leaderboard: calculateLeaderboard(
        await context.repositories.listFantasyTeamsForBasho(basho.id),
        await context.repositories.listFantasyPicksForBasho(basho.id),
        boutResults,
      ),
    };
  });
}

function getBashoTotalDays(basho: { startDate: string; endDate: string }) {
  const startDate = Date.parse(`${basho.startDate}T00:00:00.000Z`);
  const endDate = Date.parse(`${basho.endDate}T00:00:00.000Z`);

  if (Number.isNaN(startDate) || Number.isNaN(endDate) || endDate < startDate) {
    return undefined;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((endDate - startDate) / millisecondsPerDay) + 1;
}

async function findCurrentBasho(repositories: Repositories) {
  const bashos = await repositories.listBashos();
  const latestFirst = [...bashos].reverse();

  return (
    latestFirst.find((basho) => basho.status === "active") ??
    latestFirst.find((basho) => basho.status === "locked") ??
    latestFirst.at(0)
  );
}
