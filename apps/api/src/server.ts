import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";

import { titlesRoutes } from "./routes/titles";
import { discoverRoutes } from "./routes/discover";
import { servicesRoutes } from "./routes/services";
import { authRoutes } from "./routes/auth";
import { usersRoutes } from "./routes/users";
import { watchlistRoutes } from "./routes/watchlist";
import { errorHandler } from "./middleware/errorHandler";

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);
const HOST = process.env["HOST"] ?? "0.0.0.0";
const IS_DEV = process.env["NODE_ENV"] !== "production";

// ────────────────────────────────────────────────────────────
// Startup validation — fail fast if required API keys are missing
// NOTE: TMDB_API_KEY, OMDB_API_KEY, and RAPIDAPI_KEY (Streaming Availability)
// are all required. The server will exit with code 1 if any are absent.
// ────────────────────────────────────────────────────────────
function validateRequiredEnvVars() {
  const required = [
    "TMDB_API_KEY",
    "OMDB_API_KEY",
    "RAPIDAPI_KEY",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "COOKIE_SECRET",
  ] as const;
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `[startup] Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Set them in apps/api/.env (see apps/api/.env.example) and restart."
    );
    process.exit(1);
  }
}

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: IS_DEV ? "info" : "warn",
      transport: IS_DEV
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
    },
  });

  // Plugins
  await fastify.register(cors, {
    origin: IS_DEV
      ? true
      : (process.env["ALLOWED_ORIGINS"] ?? "").split(",").filter(Boolean),
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  });

  await fastify.register(helmet);

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await fastify.register(cookie, {
    // COOKIE_SECRET is validated as required in validateRequiredEnvVars() — no hardcoded fallback
    secret: process.env["COOKIE_SECRET"]!,
  });

  // Health check
  fastify.get("/api/v1/health", async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        status: "ok",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Routes
  await fastify.register(titlesRoutes, { prefix: "/api/v1/titles" });
  await fastify.register(discoverRoutes, { prefix: "/api/v1/discover" });
  await fastify.register(servicesRoutes, { prefix: "/api/v1/services" });
  await fastify.register(authRoutes, { prefix: "/api/v1/auth" });
  await fastify.register(usersRoutes, { prefix: "/api/v1/users" });
  await fastify.register(watchlistRoutes, { prefix: "/api/v1/users" });

  // Error handler
  fastify.setErrorHandler(errorHandler);

  // 404 handler
  fastify.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
      },
    });
  });

  return fastify;
}

async function start() {
  const server = await buildServer();

  try {
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`Nothing2See API running on http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

validateRequiredEnvVars();
start();
