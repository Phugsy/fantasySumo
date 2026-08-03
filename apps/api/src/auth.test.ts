import { describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";

describe("auth routes", () => {
  it("establishes and clears a local development session", async () => {
    const app = buildApp({
      authMode: "local",
    });

    try {
      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/session",
        payload: {
          email: "Player@Example.com",
          displayName: "East Stand",
        },
      });
      const cookie = loginResponse.headers["set-cookie"];
      const cookieHeader = Array.isArray(cookie) ? cookie[0] : cookie;

      expect(loginResponse.statusCode).toBe(201);
      expect(cookieHeader).toBeDefined();
      expect(loginResponse.json()).toMatchObject({
        mode: "local",
        user: {
          id: expect.stringMatching(/^local-/),
          email: "player@example.com",
          displayName: "East Stand",
        },
      });

      const sessionResponse = await app.inject({
        headers: {
          cookie: cookieHeader ?? "",
        },
        method: "GET",
        url: "/api/session",
      });

      expect(sessionResponse.statusCode).toBe(200);
      expect(sessionResponse.json()).toMatchObject({
        user: {
          email: "player@example.com",
        },
      });

      const logoutResponse = await app.inject({
        method: "DELETE",
        url: "/api/session",
      });

      expect(logoutResponse.statusCode).toBe(204);
    } finally {
      await app.close();
    }
  });

  it("uses a verified Neon bearer token when configured for production auth", async () => {
    const app = buildApp({
      authMode: "neon",
      neonJwtVerifier: async (token) =>
        token === "valid-token"
          ? {
              id: "neon-user-123",
              email: "neon@example.com",
              displayName: "Neon Player",
            }
          : undefined,
    });

    try {
      const response = await app.inject({
        headers: {
          authorization: "Bearer valid-token",
        },
        method: "GET",
        url: "/api/session",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        mode: "neon",
        user: {
          id: "neon-user-123",
          email: "neon@example.com",
          displayName: "Neon Player",
        },
      });
    } finally {
      await app.close();
    }
  });

  it("rejects missing or invalid Neon bearer tokens", async () => {
    const verificationFailureReporter = vi.fn();
    const app = buildApp({
      authMode: "neon",
      neonJwtVerifier: async () => undefined,
      neonJwtVerificationFailureReporter: verificationFailureReporter,
    });

    try {
      const missingTokenResponse = await app.inject({
        method: "GET",
        url: "/api/session",
      });

      expect(missingTokenResponse.statusCode).toBe(200);
      expect(missingTokenResponse.json()).toEqual({
        mode: "neon",
        user: null,
      });
      expect(verificationFailureReporter).not.toHaveBeenCalled();

      const response = await app.inject({
        headers: {
          authorization: "Bearer invalid-token",
        },
        method: "GET",
        url: "/api/session",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        mode: "neon",
        user: null,
      });
      expect(verificationFailureReporter).toHaveBeenCalledWith({
        errorName: "NeonJwtRejectedError",
        event: "neon-jwt-verification-failed",
        reason: "token-rejected",
      });
    } finally {
      await app.close();
    }
  });

  it("reports only safe metadata when Neon JWT verification throws", async () => {
    const verificationFailureReporter = vi.fn();
    const verificationError = Object.assign(
      new Error("secret token and claims must not appear in logs"),
      {
        code: "ERR_JWT_CLAIM_VALIDATION_FAILED",
        name: "JWTClaimValidationFailed",
      },
    );
    const app = buildApp({
      authMode: "neon",
      neonJwtVerifier: async () => Promise.reject(verificationError),
      neonJwtVerificationFailureReporter: verificationFailureReporter,
    });

    try {
      const response = await app.inject({
        headers: {
          authorization: "Bearer private-token-value",
        },
        method: "GET",
        url: "/api/session",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        mode: "neon",
        user: null,
      });
      expect(verificationFailureReporter).toHaveBeenCalledWith({
        errorCode: "ERR_JWT_CLAIM_VALIDATION_FAILED",
        errorName: "JWTClaimValidationFailed",
        event: "neon-jwt-verification-failed",
        reason: "verification-error",
      });
      expect(
        JSON.stringify(verificationFailureReporter.mock.calls),
      ).not.toMatch(/private-token-value|secret token|claims must not appear/);
    } finally {
      await app.close();
    }
  });

  it("treats malformed cookie values as an anonymous local session", async () => {
    const app = buildApp({
      authMode: "local",
    });

    try {
      const response = await app.inject({
        headers: {
          cookie: "unrelated=%",
        },
        method: "GET",
        url: "/api/session",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        mode: "local",
        user: null,
      });
    } finally {
      await app.close();
    }
  });
});
