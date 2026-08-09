import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthService } from "./auth.js";

export async function isAuthenticatedAdmin(
  request: FastifyRequest,
  auth: AuthService,
): Promise<boolean> {
  const user = await auth.getCurrentUser(request);
  return user !== undefined && auth.isAdmin(user);
}

export function sendAdminForbidden(reply: FastifyReply) {
  return reply.code(403).send({
    error: "admin-forbidden",
    message: "Administrator access is required for this action.",
  });
}
