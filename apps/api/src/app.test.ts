import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

let app: FastifyInstance;

beforeEach(() => {
  app = buildApp();
});

afterEach(async () => {
  await app.close();
});

describe("GET /api/health", () => {
  it("returns the API health payload", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      service: "fantasy-sumo-api",
      domain: "core-ready",
    });
  });
});
