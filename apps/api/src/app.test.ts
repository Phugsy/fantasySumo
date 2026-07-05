import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@fantasy-sumo/db";
import { buildApp } from "./app.js";

let app: FastifyInstance;
let client: DatabaseClient;

beforeEach(async () => {
  client = createDatabaseClient(":memory:");
  app = buildApp({
    db: client,
  });
});

afterEach(async () => {
  await app.close();
  await client.close();
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
