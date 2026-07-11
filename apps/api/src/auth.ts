import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

export interface AuthenticatedUser {
  id: string;
  email?: string;
  displayName?: string;
}

export type AuthMode = "local" | "neon";

interface AuthServiceOptions {
  mode: AuthMode;
  neonAuthAudience?: string;
  neonAuthIssuer?: string;
  neonAuthJwksUrl?: string;
  neonJwtVerifier?: (token: string) => Promise<AuthenticatedUser | undefined>;
}

export interface AuthService {
  mode: AuthMode;
  getCurrentUser: (
    request: FastifyRequest,
  ) => Promise<AuthenticatedUser | undefined>;
}

const LOCAL_AUTH_COOKIE = "fantasy_sumo_dev_user";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const localSessionSchema = z.object({
  id: z.string().trim().min(1),
  email: z.string().trim().email(),
  displayName: z.string().trim().min(1),
});

const loginBodySchema = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().min(1),
});

export function createAuthService(options: AuthServiceOptions): AuthService {
  const neonJwtVerifier =
    options.neonJwtVerifier ??
    createNeonJwtVerifier({
      audience: options.neonAuthAudience,
      issuer: options.neonAuthIssuer,
      jwksUrl: options.neonAuthJwksUrl,
    });

  return {
    mode: options.mode,
    getCurrentUser: async (request) => {
      if (options.mode === "neon") {
        const token = getBearerToken(request);

        return token === undefined ? undefined : neonJwtVerifier(token);
      }

      return Promise.resolve(getLocalSessionUser(request));
    },
  };
}

export function registerAuthRoutes(app: FastifyInstance, auth: AuthService) {
  app.get("/api/session", async (request) => {
    const user = await auth.getCurrentUser(request);

    return {
      user: user ?? null,
      mode: auth.mode,
    };
  });

  app.post<{ Body: unknown }>("/api/session", async (request, reply) => {
    if (auth.mode !== "local") {
      return reply.code(404).send({
        error: "not-found",
        message: "Local session login is not available in this environment.",
      });
    }

    const parsedBody = loginBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.code(400).send({
        error: "invalid-request",
        message: "Session request is invalid.",
        details: parsedBody.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const user = createLocalUser(parsedBody.data);

    reply.header(
      "set-cookie",
      serializeCookie(LOCAL_AUTH_COOKIE, encodeLocalSession(user), {
        httpOnly: true,
        maxAge: SESSION_MAX_AGE_SECONDS,
        path: "/",
        sameSite: "Lax",
      }),
    );

    return reply.code(201).send({ user, mode: auth.mode });
  });

  app.delete("/api/session", async (_request, reply) => {
    reply.header(
      "set-cookie",
      serializeCookie(LOCAL_AUTH_COOKIE, "", {
        httpOnly: true,
        maxAge: 0,
        path: "/",
        sameSite: "Lax",
      }),
    );

    return reply.code(204).send();
  });
}

function createLocalUser(input: {
  email: string;
  displayName: string;
}): AuthenticatedUser {
  const email = input.email.trim().toLowerCase();
  const digest = createHash("sha256").update(email).digest("base64url");

  return {
    id: `local-${digest.slice(0, 24)}`,
    email,
    displayName: input.displayName.trim(),
  };
}

function getLocalSessionUser(
  request: FastifyRequest,
): AuthenticatedUser | undefined {
  const cookie = parseCookies(request.headers.cookie)[LOCAL_AUTH_COOKIE];

  if (cookie === undefined) {
    return undefined;
  }

  try {
    const parsed = localSessionSchema.safeParse(
      JSON.parse(Buffer.from(cookie, "base64url").toString("utf8")),
    );

    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function encodeLocalSession(user: AuthenticatedUser): string {
  return Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
}

function firstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getBearerToken(request: FastifyRequest): string | undefined {
  const authorization = firstHeaderValue(request.headers.authorization);

  if (authorization === undefined) {
    return undefined;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || token === undefined) {
    return undefined;
  }

  const trimmedToken = token.trim();

  return trimmedToken.length === 0 ? undefined : trimmedToken;
}

function createNeonJwtVerifier(options: {
  audience?: string;
  issuer?: string;
  jwksUrl?: string;
}): (token: string) => Promise<AuthenticatedUser | undefined> {
  if (options.jwksUrl === undefined) {
    return async () => undefined;
  }

  const jwks = createRemoteJWKSet(new URL(options.jwksUrl));

  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        ...(options.audience === undefined
          ? {}
          : { audience: options.audience }),
        ...(options.issuer === undefined ? {} : { issuer: options.issuer }),
      });

      if (payload.sub === undefined || payload.sub.length === 0) {
        return undefined;
      }

      const email =
        typeof payload.email === "string" ? payload.email.trim() : undefined;
      const displayName =
        typeof payload.name === "string" ? payload.name.trim() : undefined;

      return {
        id: payload.sub,
        ...(email === undefined || email.length === 0 ? {} : { email }),
        ...(displayName === undefined || displayName.length === 0
          ? {}
          : { displayName }),
      };
    } catch {
      return undefined;
    }
  };
}

function parseCookies(
  cookieHeader: string | undefined,
): Record<string, string> {
  if (cookieHeader === undefined || cookieHeader.length === 0) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((cookie) => cookie.trim().split("="))
      .filter((parts): parts is [string, string] => parts.length === 2)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  );
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    httpOnly: boolean;
    maxAge: number;
    path: string;
    sameSite: "Lax";
  },
): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${options.maxAge}`,
    `Path=${options.path}`,
    `SameSite=${options.sameSite}`,
    ...(options.httpOnly ? ["HttpOnly"] : []),
  ].join("; ");
}
