import type {
  IncomingHttpHeaders,
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
  headers: IncomingHttpHeaders;
  payload?: string | object | Buffer | NodeJS.ReadableStream;
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
  const injectOptions: InjectOptions = {
    method: toInjectMethod(request.method),
    url: request.url ?? "/",
    headers: request.headers,
    payload: await getRequestPayload(request),
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

function toInjectMethod(method: string | undefined): InjectMethod {
  switch (method?.toUpperCase()) {
    case "DELETE":
    case "GET":
    case "HEAD":
    case "PATCH":
    case "POST":
    case "PUT":
    case "OPTIONS":
      return method.toUpperCase() as InjectMethod;
    default:
      return "GET";
  }
}

async function getRequestPayload(request: IncomingMessage) {
  if (!requestCanHaveBody(request)) {
    return undefined;
  }

  const parsedBody = (request as VercelRequest).body;

  if (parsedBody !== undefined) {
    return serialiseParsedBody(parsedBody, request.headers);
  }

  const chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return Buffer.concat(chunks);
}

function requestCanHaveBody(request: IncomingMessage) {
  return request.method !== "GET" && request.method !== "HEAD";
}

function serialiseParsedBody(
  parsedBody: unknown,
  headers: IncomingHttpHeaders,
) {
  if (typeof parsedBody === "string" || Buffer.isBuffer(parsedBody)) {
    return parsedBody;
  }

  if (headers["content-type"]?.includes("application/json")) {
    return JSON.stringify(parsedBody);
  }

  return String(parsedBody);
}
