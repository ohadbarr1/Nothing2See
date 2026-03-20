import type { FastifyInstance } from "fastify";
import { DiscoverParamsSchema } from "@nothing2see/types";
import * as discoverService from "../services/discoverService";

export async function discoverRoutes(fastify: FastifyInstance) {
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
