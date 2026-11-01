import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PushError, type Repositories } from "@fantasy-sumo/db";
import type { AuthService } from "../auth.js";
import { validatePushSubscription } from "../push-transport.js";
import type { PushRuntime } from "../push.js";
const body = z
  .object({
    expectedOwnerId: z.string().min(1).max(200),
    deviceId: z.string().uuid(),
    expectedRevision: z.string().uuid().nullable(),
    subscription: z
      .object({
        endpoint: z.string().url().max(2048),
        expirationTime: z.number().finite().nullable(),
        keys: z
          .object({ p256dh: z.string().max(100), auth: z.string().max(30) })
          .strict(),
        timezone: z.string().min(1).max(100),
      })
      .strict(),
  })
  .strict();
export function registerPushRoutes(
  app: FastifyInstance,
  context: {
    auth: AuthService;
    repositories: Repositories;
    now: () => Date;
    runtime?: PushRuntime;
  },
) {
  app.get("/api/push/preferences", async (request, reply) => {
    const user = await context.auth.getCurrentUser(request);
    if (!user) return reply.code(401).send({ error: "unauthorized" });
    if (!context.runtime)
      return { available: false, subscribed: false, revision: null };
    await context.repositories.cleanPushRetention(
      context.runtime.bashoId,
      context.now,
    );
    const preferences = await context.repositories.getPushPreferences(
      context.runtime.bashoId,
      user.id,
      context.now,
    );
    return {
      ...preferences,
      ...(preferences.available
        ? { publicKey: context.runtime.publicKey }
        : {}),
    };
  });
  app.put<{ Body: unknown }>(
    "/api/push/subscription",
    { bodyLimit: 4096 },
    async (request, reply) => {
      const user = await context.auth.getCurrentUser(request);
      if (!user) return reply.code(401).send({ error: "unauthorized" });
      const runtime = context.runtime;
      if (!runtime) return reply.code(404).send({ error: "not-available" });
      if (
        request.headers.origin !== runtime.origin ||
        request.headers["sec-fetch-site"] === "cross-site"
      )
        return reply.code(403).send({ error: "same-origin-required" });
      const parsed = body.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid-subscription" });
      if (parsed.data.expectedOwnerId !== user.id)
        return reply.code(409).send({ error: "session-changed" });
      try {
        validatePushSubscription(
          parsed.data.subscription,
          runtime.allowedHosts,
        );
        const revokeToken = randomBytes(32).toString("base64url");
        const revision = await context.repositories.savePushSubscription(
          runtime.bashoId,
          user.id,
          parsed.data.deviceId,
          parsed.data.expectedRevision,
          parsed.data.subscription,
          context.now,
          revokeToken,
        );
        return { revision, revokeToken };
      } catch (error) {
        return reply
          .code(error instanceof PushError ? 409 : 400)
          .send({ error: "subscription-rejected" });
      }
    },
  );

  // A signed-in device can revoke its prior account binding using a 256-bit
  // revocation-only capability. It cannot read data or create another consent.
  app.post<{ Body: unknown }>(
    "/api/push/revoke-device",
    { bodyLimit: 512 },
    async (request, reply) => {
      const user = await context.auth.getCurrentUser(request);
      if (!user) return reply.code(401).send({ error: "unauthorized" });
      const runtime = context.runtime;
      if (!runtime) return reply.code(404).send({ error: "not-available" });
      if (
        request.headers.origin !== runtime.origin ||
        request.headers["sec-fetch-site"] === "cross-site"
      )
        return reply.code(403).send({ error: "same-origin-required" });
      const parsed = z
        .object({
          deviceId: z.string().uuid(),
          revokeToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        })
        .strict()
        .safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid-request" });
      await context.repositories.revokePushDevice(
        runtime.bashoId,
        parsed.data.deviceId,
        parsed.data.revokeToken,
      );
      return reply.code(204).send();
    },
  );
  app.delete<{ Body: unknown }>(
    "/api/push/subscription",
    { bodyLimit: 512 },
    async (request, reply) => {
      const user = await context.auth.getCurrentUser(request);
      if (!user) return reply.code(401).send({ error: "unauthorized" });
      const runtime = context.runtime;
      if (!runtime) return reply.code(404).send({ error: "not-available" });
      if (
        request.headers.origin !== runtime.origin ||
        request.headers["sec-fetch-site"] === "cross-site"
      )
        return reply.code(403).send({ error: "same-origin-required" });
      const parsed = z
        .object({ deviceId: z.string().uuid().optional() })
        .strict()
        .safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid-request" });
      await context.repositories.disablePushSubscriptions(
        runtime.bashoId,
        user.id,
        parsed.data.deviceId,
      );
      return reply.code(204).send();
    },
  );
}
