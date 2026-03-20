import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SearchParamsSchema, TitleTypeSchema, AvailabilityReportSchema } from "@nothing2see/types";
import * as titleService from "../services/titleService";
import { getDb } from "../db";
import { availabilityReportsTable } from "../db/schema";

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

  // POST /api/v1/titles/:tmdb_id/report
  fastify.post("/:tmdb_id/report", async (request, reply) => {
    const { tmdb_id } = request.params as { tmdb_id: string };
    const tmdbId = parseInt(tmdb_id, 10);

    if (isNaN(tmdbId) || tmdbId <= 0) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "tmdb_id must be a positive integer" },
      });
    }

    const parseResult = AvailabilityReportSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parseResult.error.flatten(),
        },
      });
    }

    const { region, service_slug, notes } = parseResult.data;

    // Optional: attach user id if authenticated
    const authHeader = request.headers["authorization"];
    let reporterUserId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const jwt = await import("jsonwebtoken");
        const secret = process.env["JWT_SECRET"];
        if (secret) {
          const payload = jwt.default.verify(authHeader.slice(7), secret) as { sub: string };
          reporterUserId = payload.sub;
        }
      } catch {
        // ignore — report is allowed without auth
      }
    }

    try {
      const db = getDb();
      const [report] = await db
        .insert(availabilityReportsTable)
        .values({
          title_id: tmdbId,
          region,
          service_id: service_slug,
          notes: notes ?? null,
          reporter_user_id: reporterUserId,
        })
        .returning();

      return reply.status(201).send({
        success: true,
        data: {
          id: report!.id,
          title_id: report!.title_id,
          region: report!.region,
          service_id: report!.service_id,
          reported_at: report!.reported_at.toISOString(),
          notes: report!.notes,
        },
      });
    } catch (err) {
      fastify.log.error({ err, tmdbId }, "Report availability error");
      return reply.status(500).send({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to submit report" },
      });
    }
  });
}
