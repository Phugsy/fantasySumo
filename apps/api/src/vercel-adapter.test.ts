import { Readable } from "node:stream";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { handleVercelRequest } from "./vercel-adapter.js";
import type { IncomingMessage, ServerResponse } from "node:http";

describe("Vercel adapter", () => {
  it("forwards Vercel parsed JSON bodies to Fastify", async () => {
    const app = Fastify();
    app.post("/api/echo", async (request) => request.body);

    const request = createRequest({
      method: "POST",
      url: "/api/echo",
      headers: { "content-type": "application/json" },
      body: { name: "North Side" },
    });
    const response = createResponse();

    await handleVercelRequest(app, request, response);
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(JSON.parse(response.body)).toEqual({ name: "North Side" });
  });

  it("drops stale content lengths for reserialized parsed bodies", async () => {
    const app = Fastify();
    app.post("/api/echo", async (request) => request.body);

    const request = createRequest({
      method: "POST",
      url: "/api/echo",
      headers: {
        "content-length": "999",
        "content-type": "application/json",
      },
      body: { name: "East Side" },
    });
    const response = createResponse();

    await handleVercelRequest(app, request, response);
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ name: "East Side" });
  });
});

interface RequestOptions {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

function createRequest(options: RequestOptions): IncomingMessage {
  const request = Readable.from([]) as IncomingMessage & { body?: unknown };

  request.method = options.method;
  request.url = options.url;
  request.headers = options.headers;
  request.body = options.body;

  return request;
}

function createResponse() {
  const response = {
    body: "",
    headers: {} as Record<string, number | string | string[]>,
    statusCode: 200,
    setHeader(name: string, value: number | string | string[]) {
      this.headers[name.toLowerCase()] = value;
      return this as unknown as ServerResponse;
    },
    end(chunk?: Uint8Array | string) {
      if (chunk !== undefined) {
        this.body += Buffer.isBuffer(chunk)
          ? chunk.toString("utf8")
          : String(chunk);
      }
      return this as unknown as ServerResponse;
    },
  };

  return response as typeof response & ServerResponse;
}
