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
  adminUserIds?: readonly string[];
  mode: AuthMode;
  neonAuthAudience?: string;
  neonAuthIssuer?: string;
  neonAuthJwksUrl?: string;
  neonJwtVerifier?: (token: string) => Promise<AuthenticatedUser | undefined>;
  neonJwtVerificationFailureReporter?: NeonJwtVerificationFailureReporter;
}

export interface NeonJwtVerificationFailure {
  errorCode?: string;
  errorName: string;
  event: "neon-jwt-verification-failed";
  reason: "token-rejected" | "verification-error";
}

export type NeonJwtVerificationFailureReporter = (
  failure: NeonJwtVerificationFailure,
) => void;

export interface AuthClientSessionFailure {
  event: "auth-client-session-failed";
  reason: "access-token-unavailable";
}

export type AuthClientSessionFailureReporter = (
  failure: AuthClientSessionFailure,
) => void;

const AUTH_CLIENT_SESSION_FAILURE_REPORT_INTERVAL_MS = 60_000;

export interface AuthService {
  mode: AuthMode;
  getCurrentUser: (
    request: FastifyRequest,
  ) => Promise<AuthenticatedUser | undefined>;
  isAdmin: (user: AuthenticatedUser) => boolean;
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
  const adminUserIds = new Set(options.adminUserIds ?? []);
  const neonJwtVerifier =
    options.neonJwtVerifier ??
    createNeonJwtVerifier({
      audience: options.neonAuthAudience,
      issuer: options.neonAuthIssuer,
      jwksUrl: options.neonAuthJwksUrl,
    });

  return {
    mode: options.mode,
    isAdmin: (user) => adminUserIds.has(user.id),
    getCurrentUser: async (request) => {
      if (options.mode === "neon") {
        const token = getBearerToken(request);

        if (token === undefined) {
          return undefined;
        }

        try {
          const user = await neonJwtVerifier(token);

          if (user === undefined) {
            reportNeonJwtVerificationFailure(
              {
                errorName: "NeonJwtRejectedError",
                event: "neon-jwt-verification-failed",
                reason: "token-rejected",
              },
              options.neonJwtVerificationFailureReporter,
              request,
            );
          }

          return user;
        } catch (error) {
          reportNeonJwtVerificationFailure(
            toSafeNeonJwtVerificationFailure(error),
            options.neonJwtVerificationFailureReporter,
            request,
          );

          return undefined;
        }
      }

      return Promise.resolve(getLocalSessionUser(request));
    },
  };
}

export function registerAuthRoutes(
  app: FastifyInstance,
  auth: AuthService,
  options: {
    authClientSessionFailureReporter?: AuthClientSessionFailureReporter;
  } = {},
) {
  let nextAuthClientSessionFailureReportAt = 0;

  app.get("/api/session", async (request) => {
    if (Date.now() >= nextAuthClientSessionFailureReportAt) {
      const reported = reportAuthClientSessionFailure(
        request,
        auth.mode,
        options.authClientSessionFailureReporter,
      );

      if (reported) {
        nextAuthClientSessionFailureReportAt =
          Date.now() + AUTH_CLIENT_SESSION_FAILURE_REPORT_INTERVAL_MS;
      }
    }
    const user = await auth.getCurrentUser(request);

    return {
      user:
        user === undefined ? null : { ...user, isAdmin: auth.isAdmin(user) },
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

    return reply.code(201).send({
      user: { ...user, isAdmin: auth.isAdmin(user) },
      mode: auth.mode,
    });
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

function reportAuthClientSessionFailure(
  request: FastifyRequest,
  mode: AuthMode,
  reporter: AuthClientSessionFailureReporter | undefined,
): boolean {
  if (
    mode !== "neon" ||
    firstHeaderValue(request.headers["x-fantasy-sumo-auth-diagnostic"]) !==
      "access-token-unavailable"
  ) {
    return false;
  }

  const failure: AuthClientSessionFailure = {
    event: "auth-client-session-failed",
    reason: "access-token-unavailable",
  };

  if (reporter !== undefined) {
    reporter(failure);
    return true;
  }

  request.log.warn(failure, "Auth client could not obtain a session token.");
  return true;
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
    return async () => {
      throw new NeonAuthConfigurationError();
    };
  }

  const jwks = createRemoteJWKSet(new URL(options.jwksUrl));

  return async (token) => {
    const { payload } = await jwtVerify(token, jwks, {
      ...(options.audience === undefined ? {} : { audience: options.audience }),
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
  };
}

class NeonAuthConfigurationError extends Error {
  readonly code = "NEON_AUTH_JWKS_URL_MISSING";

  constructor() {
    super("Neon Auth JWT verification is not configured.");
    this.name = "NeonAuthConfigurationError";
  }
}

function toSafeNeonJwtVerificationFailure(
  error: unknown,
): NeonJwtVerificationFailure {
  const errorCode = getStringProperty(error, "code");

  return {
    ...(errorCode === undefined ? {} : { errorCode }),
    errorName:
      error instanceof Error && error.name.length > 0
        ? error.name
        : "UnknownError",
    event: "neon-jwt-verification-failed",
    reason: "verification-error",
  };
}

function getStringProperty(
  value: unknown,
  property: string,
): string | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  let propertyValue: unknown;

  try {
    propertyValue = Reflect.get(value, property);
  } catch {
    return undefined;
  }

  return typeof propertyValue === "string" && propertyValue.length > 0
    ? propertyValue
    : undefined;
}

function reportNeonJwtVerificationFailure(
  failure: NeonJwtVerificationFailure,
  reporter: NeonJwtVerificationFailureReporter | undefined,
  request: FastifyRequest,
) {
  if (reporter !== undefined) {
    reporter(failure);
    return;
  }

  request.log.warn(failure, "Neon JWT verification failed.");
}

function parseCookies(
  cookieHeader: string | undefined,
): Record<string, string> {
  if (cookieHeader === undefined || cookieHeader.length === 0) {
    return {};
  }

  const cookies: Record<string, string> = {};

  for (const cookie of cookieHeader.split(";")) {
    const trimmedCookie = cookie.trim();
    const separatorIndex = trimmedCookie.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmedCookie.slice(0, separatorIndex);
    const value = trimmedCookie.slice(separatorIndex + 1);

    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      // Ignore malformed cookie values so unrelated cookies cannot break auth.
    }
  }

  return cookies;
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
