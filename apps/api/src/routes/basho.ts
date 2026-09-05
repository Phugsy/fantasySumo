import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DEMO_BASHO_ID, type Repositories } from "@fantasy-sumo/db";
import type {
  Basho,
  FantasyPick,
  FantasyTeam,
  ScheduledBoutPublication,
} from "@fantasy-sumo/domain";
import type { AuthService } from "../auth.js";
import { getEffectiveBashoGameConfig } from "../game-config.js";
import { isCompleteScheduledBoutPublicationSource } from "../imports/types.js";
import {
  calculateLeaderboard,
  calculateTeamScore,
  canEditFantasyPicks,
  deriveRikishiTournamentNotes,
  getVerifiedBoutResultsThroughDay,
  hasBoutResultForScheduledBout,
  getPickLockMessage,
  validateFantasyPicks,
} from "@fantasy-sumo/domain";

interface RouteContext {
  auth: AuthService;
  defaultTeamSize: number;
  repositories: Repositories;
  now: () => Date;
  teamIdFactory: () => string;
}

const createTeamBodySchema = z.object({
  displayName: z.string().trim().min(1),
  ownerName: z.string().trim().optional(),
  rikishiIds: z.array(z.string().trim().min(1)),
});

const currentBashoQuerySchema = z.object({
  mode: z.enum(["demo"]).optional(),
});

export function registerBashoRoutes(
  app: FastifyInstance,
  context: RouteContext,
) {
  app.get<{ Querystring: unknown }>(
    "/api/basho/current",
    async (request, reply) => {
      const parsedQuery = currentBashoQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply.code(400).send({
          error: "invalid-request",
          message: "The current basho mode is invalid.",
        });
      }

      const currentBasho =
        parsedQuery.data.mode === "demo"
          ? await findDemoBasho(context.repositories)
          : await findCurrentBasho(context.repositories);

      if (currentBasho === undefined) {
        return reply.code(404).send({
          error: "not-found",
          message:
            parsedQuery.data.mode === "demo"
              ? "The demo basho is not available."
              : "No basho is available.",
        });
      }

      const gameConfig = await getEffectiveBashoGameConfig(
        context.repositories,
        currentBasho.id,
        context.defaultTeamSize,
      );

      return {
        ...currentBasho,
        teamSize: gameConfig.teamSize,
      };
    },
  );

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

    const [
      allRikishi,
      banzukeEntries,
      boutResults,
      scheduledBouts,
      scheduledBoutPublications,
    ] = await Promise.all([
      context.repositories.listRikishi(),
      context.repositories.listBanzukeEntriesForBasho(basho.id),
      context.repositories.listBoutResultsForBasho(basho.id),
      context.repositories.listScheduledBoutsForBasho(basho.id),
      context.repositories.listScheduledBoutPublicationsForBasho(basho.id),
    ]);
    const completeScheduleDays = getCompleteScheduleDays(
      basho,
      scheduledBoutPublications,
    );
    const verifiedThroughDay =
      basho.status === "upcoming"
        ? 0
        : getVerifiedBoutResultsThroughDay({
            boutResults,
            completeScheduleDays,
            scheduledBouts,
            throughDay: 15,
          });
    const rikishiById = new Map(
      allRikishi.map((rikishi) => [rikishi.id, rikishi]),
    );
    const rikishi = banzukeEntries.map((entry) => {
      const rikishiEntry = rikishiById.get(entry.rikishiId);

      return {
        id: entry.rikishiId,
        shikona: rikishiEntry?.shikona ?? entry.rikishiId,
        heya: rikishiEntry?.heya,
        rank: entry.rank,
        rankOrder: entry.rankOrder,
        tournamentNotes: deriveRikishiTournamentNotes({
          banzukeEntries,
          boutResults,
          rikishiId: entry.rikishiId,
          scheduledBouts,
          throughDay: verifiedThroughDay,
        }),
      };
    });

    return {
      basho,
      rikishi,
    };
  });

  app.get<{
    Params: { bashoId: string };
  }>("/api/basho/:bashoId/schedule", async (request, reply) => {
    const basho = await context.repositories.getBasho(request.params.bashoId);

    if (basho === undefined) {
      return reply.code(404).send({
        error: "not-found",
        message: `Basho ${request.params.bashoId} was not found.`,
      });
    }

    const afterDay = basho.currentDay ?? 0;
    const publications = (
      await context.repositories.listScheduledBoutPublicationsForBasho(basho.id)
    ).filter((publication) => publication.day > afterDay);
    const publishedDays = new Set(
      publications.map((publication) => publication.day),
    );
    const banzukeByRikishiId = new Map(
      (await context.repositories.listBanzukeEntriesForBasho(basho.id)).map(
        (entry) => [entry.rikishiId, entry],
      ),
    );
    const rikishiById = new Map(
      (await context.repositories.listRikishi()).map((rikishi) => [
        rikishi.id,
        rikishi,
      ]),
    );
    const boutResults = await context.repositories.listBoutResultsForBasho(
      basho.id,
    );
    const toScheduledRikishi = (rikishiId: string) => {
      const rikishi = rikishiById.get(rikishiId);
      const banzuke = banzukeByRikishiId.get(rikishiId);

      return {
        id: rikishiId,
        shikona: rikishi?.shikona ?? rikishiId,
        ...(banzuke === undefined ? {} : { rank: banzuke.rank }),
      };
    };
    const bouts = (
      await context.repositories.listScheduledBoutsForBasho(basho.id)
    )
      .filter((bout) => publishedDays.has(bout.day))
      .filter(
        (bout) =>
          !hasBoutResultForScheduledBout({
            boutResults,
            scheduledBout: bout,
          }),
      )
      .map((bout) => ({
        id: bout.id,
        day: bout.day,
        status: bout.status,
        east: toScheduledRikishi(bout.eastRikishiId),
        west: toScheduledRikishi(bout.westRikishiId),
        ...(bout.withdrawnRikishiId === undefined
          ? {}
          : { withdrawnRikishiId: bout.withdrawnRikishiId }),
      }));

    return {
      bashoId: basho.id,
      publishedDays: publications.map((publication) => publication.day),
      bouts,
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

    const existingTeam = await context.repositories.getFantasyTeamForOwner(
      basho.id,
      currentUser.id,
    );
    const teamId = existingTeam?.id ?? `team-${context.teamIdFactory()}`;
    const gameConfig = await getEffectiveBashoGameConfig(
      context.repositories,
      basho.id,
      context.defaultTeamSize,
    );
    const validatedRequest = await validateTeamRequest(
      request.body,
      basho.id,
      teamId,
      context.repositories,
      gameConfig.teamSize,
      "Team creation request is invalid.",
    );

    if (!validatedRequest.success) {
      return reply
        .code(validatedRequest.statusCode)
        .send(validatedRequest.body);
    }

    const { displayName, picks } = validatedRequest;

    const team: FantasyTeam & { ownerUserId: string } = {
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

    const savedTeamWithPicks =
      await context.repositories.saveOwnedFantasyTeamWithPicksIfBashoUpcoming(
        team,
        picks,
        context.defaultTeamSize,
      );

    if (savedTeamWithPicks.status === "picks-locked") {
      return reply
        .code(409)
        .send(
          await getPicksLockedResponse(
            context.repositories,
            basho.id,
            currentUser.id,
          ),
        );
    }

    if (savedTeamWithPicks.status === "invalid-team-size") {
      return reply.code(409).send({
        error: "team-size-changed",
        message: `Team size changed to ${savedTeamWithPicks.teamSize}. Review your picks and try again.`,
        teamSize: savedTeamWithPicks.teamSize,
      });
    }

    const created =
      existingTeam === undefined && savedTeamWithPicks.team.id === team.id;

    return reply.code(created ? 201 : 200).send({
      team: savedTeamWithPicks.team,
      picks: savedTeamWithPicks.picks,
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

    const [
      picks,
      boutResults,
      banzukeEntries,
      allRikishi,
      scheduledBouts,
      scheduledBoutPublications,
    ] = await Promise.all([
      context.repositories.listFantasyPicksForTeam(team.id),
      context.repositories.listBoutResultsForBasho(basho.id),
      context.repositories.listBanzukeEntriesForBasho(basho.id),
      context.repositories.listRikishi(),
      context.repositories.listScheduledBoutsForBasho(basho.id),
      context.repositories.listScheduledBoutPublicationsForBasho(basho.id),
    ]);
    const completeScheduleDays = getCompleteScheduleDays(
      basho,
      scheduledBoutPublications,
    );
    const verifiedThroughDay =
      basho.status === "upcoming"
        ? 0
        : getVerifiedBoutResultsThroughDay({
            boutResults,
            completeScheduleDays,
            scheduledBouts,
            throughDay: 15,
          });
    const teamScore = calculateTeamScore(team, picks, boutResults, {
      throughDay: verifiedThroughDay,
    });
    const scoresByRikishiId = new Map(
      teamScore.rikishiScores.map((score) => [score.rikishiId, score]),
    );
    const banzukeByRikishiId = new Map(
      banzukeEntries.map((entry) => [entry.rikishiId, entry]),
    );
    const rikishiById = new Map(
      allRikishi.map((rikishi) => [rikishi.id, rikishi]),
    );

    return {
      basho,
      team,
      totalScore: teamScore.score,
      picks: picks
        .map((pick) => {
          const rikishi = rikishiById.get(pick.rikishiId);
          const banzukeEntry = banzukeByRikishiId.get(pick.rikishiId);
          const score = scoresByRikishiId.get(pick.rikishiId);

          return {
            ...pick,
            shikona: rikishi?.shikona ?? pick.rikishiId,
            ...(rikishi?.heya === undefined ? {} : { heya: rikishi.heya }),
            ...(banzukeEntry === undefined
              ? {}
              : {
                  rank: banzukeEntry.rank,
                  rankOrder: banzukeEntry.rankOrder,
                }),
            wins: score?.wins ?? 0,
            score: score?.score ?? 0,
            tournamentNotes: deriveRikishiTournamentNotes({
              banzukeEntries,
              boutResults,
              rikishiId: pick.rikishiId,
              scheduledBouts,
              throughDay: verifiedThroughDay,
            }),
          };
        })
        .sort(
          (left, right) =>
            (left.rankOrder ?? Number.MAX_SAFE_INTEGER) -
              (right.rankOrder ?? Number.MAX_SAFE_INTEGER) ||
            left.shikona.localeCompare(right.shikona),
        ),
    };
  });

  app.put<{
    Params: { bashoId: string };
    Body: unknown;
  }>("/api/basho/:bashoId/my-team", async (request, reply) => {
    const currentUser = await context.auth.getCurrentUser(request);

    if (currentUser === undefined) {
      return reply.code(401).send({
        error: "unauthenticated",
        message: "Sign in before editing your fantasy team.",
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

    const existingTeam = await context.repositories.getFantasyTeamForOwner(
      basho.id,
      currentUser.id,
    );

    if (existingTeam === undefined) {
      return reply.code(404).send({
        error: "not-found",
        message: "You do not have a fantasy team for this basho yet.",
      });
    }

    const gameConfig = await getEffectiveBashoGameConfig(
      context.repositories,
      basho.id,
      context.defaultTeamSize,
    );

    const validatedRequest = await validateTeamRequest(
      request.body,
      basho.id,
      existingTeam.id,
      context.repositories,
      gameConfig.teamSize,
      "Team update request is invalid.",
    );

    if (!validatedRequest.success) {
      return reply
        .code(validatedRequest.statusCode)
        .send(validatedRequest.body);
    }

    const { displayName, picks } = validatedRequest;

    const updatedTeamWithPicks =
      await context.repositories.saveOwnedFantasyTeamWithPicksIfBashoUpcoming(
        {
          ...existingTeam,
          displayName,
          ownerUserId: currentUser.id,
          ...(currentUser.displayName === undefined ||
          currentUser.displayName.length === 0
            ? {}
            : { ownerName: currentUser.displayName }),
        },
        picks,
        context.defaultTeamSize,
      );

    if (updatedTeamWithPicks.status === "picks-locked") {
      return reply
        .code(409)
        .send(
          await getPicksLockedResponse(
            context.repositories,
            basho.id,
            currentUser.id,
          ),
        );
    }

    if (updatedTeamWithPicks.status === "invalid-team-size") {
      return reply.code(409).send({
        error: "team-size-changed",
        message: `Team size changed to ${updatedTeamWithPicks.teamSize}. Review your picks and try again.`,
        teamSize: updatedTeamWithPicks.teamSize,
      });
    }

    return {
      team: updatedTeamWithPicks.team,
      picks: updatedTeamWithPicks.picks,
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

    const [boutResults, scheduledBouts, scheduledBoutPublications] =
      await Promise.all([
        context.repositories.listBoutResultsForBasho(basho.id),
        context.repositories.listScheduledBoutsForBasho(basho.id),
        context.repositories.listScheduledBoutPublicationsForBasho(basho.id),
      ]);
    const verifiedThroughDay =
      basho.status === "upcoming"
        ? 0
        : getVerifiedBoutResultsThroughDay({
            boutResults,
            completeScheduleDays: getCompleteScheduleDays(
              basho,
              scheduledBoutPublications,
            ),
            scheduledBouts,
            throughDay: 15,
          });

    const leaderboard = calculateLeaderboard(
      await context.repositories.listFantasyTeamsForBasho(basho.id),
      await context.repositories.listFantasyPicksForBasho(basho.id),
      boutResults,
      { throughDay: verifiedThroughDay },
    );

    return {
      basho,
      bashoId: basho.id,
      totalDays: getBashoTotalDays(basho),
      leaderboard:
        basho.status === "upcoming"
          ? leaderboard.map((entry) => ({
              ...entry,
              rikishiScores: [],
              scoreHistory: entry.scoreHistory.map((history) => ({
                ...history,
                rikishiScores: [],
              })),
            }))
          : leaderboard,
    };
  });
}

function getCompleteScheduleDays(
  basho: Basho,
  publications: readonly ScheduledBoutPublication[],
): ReadonlySet<number> {
  return new Set(
    basho.isDemo
      ? Array.from({ length: 15 }, (_value, index) => index + 1)
      : publications
          .filter((publication) =>
            isCompleteScheduledBoutPublicationSource(publication.source),
          )
          .map((publication) => publication.day),
  );
}

async function getPicksLockedResponse(
  repositories: Repositories,
  bashoId: string,
  ownerUserId: string,
) {
  const [currentBasho, currentTeam] = await Promise.all([
    repositories.getBasho(bashoId),
    repositories.getFantasyTeamForOwner(bashoId, ownerUserId),
  ]);

  return {
    error: "picks-locked",
    message:
      (currentBasho === undefined
        ? undefined
        : getPickLockMessage(currentBasho)) ??
      "Fantasy team picks are locked for this basho.",
    bashoStatus: currentBasho?.status ?? "locked",
    ...(currentBasho?.status !== "upcoming" ||
    currentTeam?.lockedAt === undefined
      ? {}
      : { teamLockedAt: currentTeam.lockedAt }),
  };
}

async function validateTeamRequest(
  body: unknown,
  bashoId: string,
  teamId: string,
  repositories: Repositories,
  teamSize: number,
  invalidRequestMessage: string,
) {
  const parsedBody = createTeamBodySchema.safeParse(body);

  if (!parsedBody.success) {
    return {
      success: false as const,
      statusCode: 400 as const,
      body: {
        error: "invalid-request",
        message: invalidRequestMessage,
        details: parsedBody.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    };
  }

  const { displayName, rikishiIds } = parsedBody.data;

  if (rikishiIds.length !== teamSize) {
    return {
      success: false as const,
      statusCode: 409 as const,
      body: {
        error: "team-size-changed",
        message: `Team size changed to ${teamSize}. Review your picks and try again.`,
        teamSize,
      },
    };
  }

  const picks = rikishiIds.map(
    (rikishiId): FantasyPick => ({
      teamId,
      rikishiId,
    }),
  );
  const pickErrors = validateFantasyPicks(picks, {
    teamSize,
  });

  if (pickErrors.length > 0) {
    return {
      success: false as const,
      statusCode: 400 as const,
      body: {
        error: "invalid-picks",
        message: "Fantasy team picks are invalid.",
        details: pickErrors,
      },
    };
  }

  const validRikishiIds = new Set(
    (await repositories.listBanzukeEntriesForBasho(bashoId)).map(
      (entry) => entry.rikishiId,
    ),
  );
  const invalidRikishiIds = rikishiIds.filter(
    (rikishiId) => !validRikishiIds.has(rikishiId),
  );

  if (invalidRikishiIds.length > 0) {
    return {
      success: false as const,
      statusCode: 400 as const,
      body: {
        error: "invalid-picks",
        message: "Fantasy team picks include rikishi outside this basho.",
        details: invalidRikishiIds.map((rikishiId) => ({
          code: "unknown-rikishi",
          message: `Rikishi ${rikishiId} is not available for basho ${bashoId}.`,
          rikishiId,
        })),
      },
    };
  }

  return {
    success: true as const,
    displayName,
    picks,
  };
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

export async function findCurrentBasho(repositories: Repositories) {
  const bashos = await repositories.listBashos();
  const liveBashos = bashos.filter((basho) => !basho.isDemo);
  const candidates = liveBashos.length > 0 ? liveBashos : bashos;

  return findPreferredCurrentBasho(candidates);
}

export async function findCurrentLiveBasho(repositories: Repositories) {
  return findPreferredCurrentBasho(
    (await repositories.listBashos()).filter((basho) => !basho.isDemo),
  );
}

function findPreferredCurrentBasho(
  candidates: Awaited<ReturnType<Repositories["listBashos"]>>,
) {
  const latestFirst = [...candidates].reverse();

  return (
    latestFirst.find((basho) => basho.status === "active") ??
    latestFirst.find((basho) => basho.status === "locked") ??
    latestFirst.at(0)
  );
}

export async function findDemoBasho(repositories: Repositories) {
  const basho = await repositories.getBasho(DEMO_BASHO_ID);
  return basho?.isDemo === true ? basho : undefined;
}
