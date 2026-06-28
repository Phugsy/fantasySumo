import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../apps/api/src/app.js";

const app = buildApp();
const appReady = app.ready();

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  await appReady;
  app.server.emit("request", request, response);
}
