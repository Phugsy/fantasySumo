import { describe, expect, it } from "vitest";
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
    const app = buildApp({
      authMode: "neon",
      neonJwtVerifier: async () => undefined,
    });

    try {
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
    } finally {
      await app.close();
    }
  });
});
