import type { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "@nothing2see/types";

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; email: string; display_name?: string | null };
  }
}

function getJwtSecret(): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.status(401).send({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid Authorization header",
      },
    });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
    request.user = {
      id: payload.sub,
      email: payload.email,
      display_name: payload.display_name ?? null,
    };
  } catch {
    return reply.status(401).send({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Token is invalid or expired",
      },
    });
  }
}
