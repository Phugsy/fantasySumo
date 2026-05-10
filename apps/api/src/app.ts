import Fastify from "fastify";
import { foundationLabel } from "@fantasy-sumo/domain";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.get("/api/health", async () => ({
    ok: true,
    service: "fantasy-sumo-api",
    foundation: foundationLabel,
  }));

  return app;
}
