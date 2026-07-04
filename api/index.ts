import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../apps/api/src/app.js";
import { handleVercelRequest } from "../apps/api/src/vercel-adapter.js";

const app = buildApp();
const appReady = app.ready();

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  await appReady;
  await handleVercelRequest(app, request, response);
}
