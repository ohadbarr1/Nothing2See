import type { FastifyInstance } from "fastify";
import { DiscoverParamsSchema, TitleTypeSchema } from "@nothing2see/types";
import * as discoverService from "../services/discoverService";
import { requireAuth } from "../middleware/auth";
import { getDb } from "../db";
import { usersTable, userServicesTable } from "../db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Query params allowed on /discover/new (region & services come from the user's DB record)
const DiscoverNewQuerySchema = z.object({
  type: TitleTypeSchema.optional(),
  genre: z.string().optional(),
});

export async function discoverRoutes(fastify: FastifyInstance) {
  // GET /api/v1/discover/new — titles added to availability in the past 7 days
  // FIX-7: authenticated endpoint — region and services come from the user's DB record
  fastify.get("/new", { preHandler: requireAuth }, async (request, reply) => {
    const rawQuery = request.query as Record<string, string>;
    const parseResult = DiscoverNewQuerySchema.safeParse(rawQuery);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          details: parseResult.error.flatten(),
        },
      });
    }

    const { type, genre } = parseResult.data;
    const userId = request.user!.id;
    const db = getDb();

    // Read user's region from DB
    const [userRow] = await db
      .select({ region: usersTable.region })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const region = userRow?.region ?? "US";

    // Read user's saved services from DB
    const serviceRows = await db
      .select({ service_id: userServicesTable.service_id })
      .from(userServicesTable)
      .where(eq(userServicesTable.user_id, userId));

    const services = serviceRows.map((r) => r.service_id);

    if (services.length === 0) {
      return reply.send({
        success: true,
        data: [],
        meta: {
          total: 0,
          message:
            "You haven't saved any streaming services yet. Add services in your profile to see new releases.",
        },
      });
    }

    try {
      const titles = await discoverService.discoverNew({
        region,
        services,
        type,
        genre,
      });

      return reply.send({
        success: true,
        data: titles,
        meta: { total: titles.length },
      });
    } catch (err) {
      fastify.log.error({ err }, "Discover new error");
      return reply.status(500).send({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch new titles",
        },
      });
    }
  });

  // GET /api/v1/discover/top
  fastify.get("/top", async (request, reply) => {
    const rawQuery = request.query as Record<string, string>;

    const parseResult = DiscoverParamsSchema.safeParse(rawQuery);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          details: parseResult.error.flatten(),
        },
      });
    }

    const { region, services, type, genre, min_rating } = parseResult.data;

    try {
      const titles = await discoverService.discoverTop({
        region,
        services: Array.isArray(services) ? services : [],
        type,
        genre,
        min_rating,
      });

      return reply.send({
        success: true,
        data: titles,
        meta: {
          total: titles.length,
        },
      });
    } catch (err) {
      fastify.log.error({ err }, "Discover top error");
      return reply.status(500).send({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch top titles",
        },
      });
    }
  });
}
