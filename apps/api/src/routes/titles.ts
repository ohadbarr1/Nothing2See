import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SearchParamsSchema, TitleTypeSchema } from "@nothing2see/types";
import * as titleService from "../services/titleService";

export async function titlesRoutes(fastify: FastifyInstance) {
  // GET /api/v1/titles/search
  fastify.get("/search", async (request, reply) => {
    const rawQuery = request.query as Record<string, string>;
    const parseResult = SearchParamsSchema.safeParse(rawQuery);

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

    const { q, region, type, page, limit } = parseResult.data;

    try {
      const { titles, total, total_pages } = await titleService.searchTitles(
        q,
        region,
        type,
        page,
        limit
      );

      return reply.send({
        success: true,
        data: titles,
        meta: {
          page,
          limit,
          total,
          total_pages,
        },
      });
    } catch (err) {
      fastify.log.error({ err }, "Search titles error");
      return reply.status(500).send({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to search titles",
        },
      });
    }
  });

  // GET /api/v1/titles/:tmdb_id
  fastify.get("/:tmdb_id", async (request, reply) => {
    const { tmdb_id } = request.params as { tmdb_id: string };
    const { region, type: typeRaw } = request.query as {
      region?: string;
      type?: string;
    };

    const tmdbId = parseInt(tmdb_id, 10);
    if (isNaN(tmdbId) || tmdbId <= 0) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "tmdb_id must be a positive integer",
        },
      });
    }

    const typeResult = TitleTypeSchema.optional().safeParse(typeRaw);
    if (!typeResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: 'type must be "movie" or "series"',
        },
      });
    }

    try {
      const title = await titleService.getTitleById(
        tmdbId,
        region ?? "US",
        typeResult.data
      );

      if (!title) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Title with TMDB ID ${tmdbId} not found`,
          },
        });
      }

      return reply.send({ success: true, data: title });
    } catch (err) {
      fastify.log.error({ err, tmdbId }, "Get title error");
      return reply.status(500).send({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch title",
        },
      });
    }
  });
}
