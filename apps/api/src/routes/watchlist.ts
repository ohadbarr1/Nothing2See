import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import {
  watchlistTable,
  titlesTable,
  availabilityTable,
  userServicesTable,
} from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { AddToWatchlistSchema, PatchWatchlistSchema } from "@nothing2see/types";
import { z } from "zod";

// Extend AddToWatchlistSchema locally to accept email_notifications preference (AC-4.7)
const AddToWatchlistExtendedSchema = AddToWatchlistSchema.extend({
  email_notifications: z.boolean().default(true),
});

const MAX_WATCHLIST = 100;

export async function watchlistRoutes(fastify: FastifyInstance) {
  // GET /api/v1/users/me/watchlist
  fastify.get(
    "/me/watchlist",
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.user!.id;
      const db = getDb();

      // Get user's selected services
      const userServiceRows = await db
        .select({ service_id: userServicesTable.service_id })
        .from(userServicesTable)
        .where(eq(userServicesTable.user_id, userId));
      const userServiceIds = new Set(userServiceRows.map((r) => r.service_id));

      // Fetch watchlist items joined with title data
      const items = await db
        .select({
          id: watchlistTable.id,
          user_id: watchlistTable.user_id,
          title_id: watchlistTable.title_id,
          added_at: watchlistTable.added_at,
          watched: watchlistTable.watched,
          // Title fields
          tmdb_id: titlesTable.tmdb_id,
          t_title: titlesTable.title,
          poster_url: titlesTable.poster_url,
          type: titlesTable.type,
          year: titlesTable.year,
          imdb_rating: titlesTable.imdb_rating,
          genres: titlesTable.genres,
        })
        .from(watchlistTable)
        .leftJoin(titlesTable, eq(watchlistTable.title_id, titlesTable.tmdb_id))
        .where(eq(watchlistTable.user_id, userId));

      // For each item, fetch availability
      const result = await Promise.all(
        items.map(async (item) => {
          const availRows = await db
            .select()
            .from(availabilityTable)
            .where(
              and(
                eq(availabilityTable.title_tmdb_id, item.title_id),
                eq(availabilityTable.is_active, true)
              )
            );

          const availability = availRows.map((a) => ({
            service_id: a.service_id,
            service_name: a.service_id, // denormalized for simplicity
            region: a.region,
            link: a.link,
            type: a.availability_type as
              | "subscription"
              | "rent"
              | "buy"
              | "free"
              | null
              | undefined,
            quality: a.quality,
            last_updated: a.last_updated.toISOString(),
          }));

          // Check if available on any of user's services
          const available_on_user_services =
            userServiceIds.size === 0
              ? false
              : availability.some((a) => userServiceIds.has(a.service_id));

          return {
            id: item.id,
            user_id: item.user_id,
            title_id: item.title_id,
            added_at: item.added_at.toISOString(),
            watched: item.watched,
            title: item.tmdb_id
              ? {
                  tmdb_id: item.tmdb_id,
                  title: item.t_title ?? "",
                  poster_url: item.poster_url ?? null,
                  type: (item.type ?? "movie") as "movie" | "series",
                  year: item.year ?? null,
                  imdb_rating: item.imdb_rating ?? null,
                  genres: item.genres ?? [],
                }
              : undefined,
            availability,
            available_on_user_services,
          };
        })
      );

      return reply.send({
        success: true,
        data: result,
        meta: { total: result.length },
      });
    }
  );

  // POST /api/v1/users/me/watchlist
  fastify.post(
    "/me/watchlist",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parseResult = AddToWatchlistExtendedSchema.safeParse(request.body);
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

      const { tmdb_id, email_notifications } = parseResult.data;
      const userId = request.user!.id;
      const db = getDb();

      // Enforce max 100 items
      const existing = await db
        .select({ id: watchlistTable.id })
        .from(watchlistTable)
        .where(eq(watchlistTable.user_id, userId));

      if (existing.length >= MAX_WATCHLIST) {
        return reply.status(422).send({
          success: false,
          error: {
            code: "WATCHLIST_FULL",
            message: `Watchlist cannot exceed ${MAX_WATCHLIST} items`,
          },
        });
      }

      // Check if already in watchlist
      const [alreadyExists] = await db
        .select()
        .from(watchlistTable)
        .where(
          and(
            eq(watchlistTable.user_id, userId),
            eq(watchlistTable.title_id, tmdb_id)
          )
        );

      if (alreadyExists) {
        return reply.status(409).send({
          success: false,
          error: {
            code: "ALREADY_IN_WATCHLIST",
            message: "Title is already in your watchlist",
          },
        });
      }

      const [inserted] = await db
        .insert(watchlistTable)
        .values({ user_id: userId, title_id: tmdb_id, email_notifications })
        .returning();

      return reply.status(201).send({
        success: true,
        data: {
          ...inserted,
          added_at: inserted!.added_at.toISOString(),
        },
      });
    }
  );

  // DELETE /api/v1/users/me/watchlist — clear entire watchlist (AC-4.9)
  fastify.delete(
    "/me/watchlist",
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.user!.id;
      const db = getDb();

      const deleted = await db
        .delete(watchlistTable)
        .where(eq(watchlistTable.user_id, userId))
        .returning({ id: watchlistTable.id });

      return reply.send({
        success: true,
        data: { removed: deleted.length },
      });
    }
  );

  // DELETE /api/v1/users/me/watchlist/:tmdb_id
  fastify.delete(
    "/me/watchlist/:tmdb_id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { tmdb_id: rawId } = request.params as { tmdb_id: string };
      const tmdbId = parseInt(rawId, 10);

      if (isNaN(tmdbId) || tmdbId <= 0) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "tmdb_id must be a positive integer" },
        });
      }

      const userId = request.user!.id;
      const db = getDb();

      const deleted = await db
        .delete(watchlistTable)
        .where(
          and(
            eq(watchlistTable.user_id, userId),
            eq(watchlistTable.title_id, tmdbId)
          )
        )
        .returning();

      if (deleted.length === 0) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Watchlist item not found" },
        });
      }

      return reply.send({ success: true, data: { removed: true } });
    }
  );

  // PATCH /api/v1/users/me/watchlist/:tmdb_id
  fastify.patch(
    "/me/watchlist/:tmdb_id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { tmdb_id: rawId } = request.params as { tmdb_id: string };
      const tmdbId = parseInt(rawId, 10);

      if (isNaN(tmdbId) || tmdbId <= 0) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "tmdb_id must be a positive integer" },
        });
      }

      const parseResult = PatchWatchlistSchema.safeParse(request.body);
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

      const { watched } = parseResult.data;
      const userId = request.user!.id;
      const db = getDb();

      const [updated] = await db
        .update(watchlistTable)
        .set({ watched })
        .where(
          and(
            eq(watchlistTable.user_id, userId),
            eq(watchlistTable.title_id, tmdbId)
          )
        )
        .returning();

      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Watchlist item not found" },
        });
      }

      return reply.send({
        success: true,
        data: {
          ...updated,
          added_at: updated.added_at.toISOString(),
        },
      });
    }
  );
}
