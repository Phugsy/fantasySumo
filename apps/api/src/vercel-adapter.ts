import type {
  IncomingMessage,
  OutgoingHttpHeaders,
  ServerResponse,
} from "node:http";
import type { FastifyInstance } from "fastify";

type VercelRequest = IncomingMessage & {
  body?: unknown;
};

type InjectMethod =
  | "DELETE"
  | "GET"
  | "HEAD"
  | "PATCH"
  | "POST"
  | "PUT"
  | "OPTIONS";

interface InjectOptions {
  method: InjectMethod;
  url: string;
  headers: IncomingMessage["headers"];
  payload?: string | Buffer;
}

interface InjectResponse {
  statusCode: number;
  headers: OutgoingHttpHeaders;
  payload: string;
}

export async function handleVercelRequest(
  app: FastifyInstance,
  request: IncomingMessage,
  response: ServerResponse,
) {
  const payload = getParsedRequestPayload(request);
  const injectOptions: InjectOptions = {
    method: (request.method?.toUpperCase() ?? "GET") as InjectMethod,
    url: request.url ?? "/",
    headers:
      payload === undefined
        ? request.headers
        : withoutContentLength(request.headers),
    payload,
  };
  const result = (await app.inject(injectOptions)) as InjectResponse;

  response.statusCode = result.statusCode;

  for (const [header, value] of Object.entries(result.headers)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      Array.isArray(value)
    ) {
      response.setHeader(header, value);
    }
  }

  response.end(result.payload);
}

function getParsedRequestPayload(request: IncomingMessage) {
  if (!requestCanHaveBody(request)) {
    return undefined;
  }

  const parsedBody = (request as VercelRequest).body;

  if (parsedBody !== undefined) {
    return serialiseParsedBody(parsedBody);
  }

  return undefined;
}

function requestCanHaveBody(request: IncomingMessage) {
  return request.method !== "GET" && request.method !== "HEAD";
}

function serialiseParsedBody(parsedBody: unknown) {
  if (typeof parsedBody === "string" || Buffer.isBuffer(parsedBody)) {
    return parsedBody;
  }

  return JSON.stringify(parsedBody);
}

function withoutContentLength(headers: IncomingMessage["headers"]) {
  const nextHeaders = { ...headers };
  delete nextHeaders["content-length"];

  return nextHeaders;
}
