import { z } from "zod";
import { AvailabilitySchema } from "./title";

export const WatchlistItemSchema = z.object({
  id: z.number(),
  user_id: z.string(),
  title_id: z.number(),
  added_at: z.string().datetime(),
  watched: z.boolean(),
  email_notifications: z.boolean().default(true), // AC-4.7: email opt-in per item
  // Populated when fetching watchlist
  title: z
    .object({
      tmdb_id: z.number(),
      title: z.string(),
      poster_url: z.string().nullable().optional(),
      type: z.enum(["movie", "series"]),
      year: z.number().nullable().optional(),
      imdb_rating: z.number().nullable().optional(),
      genres: z.array(z.string()).default([]),
    })
    .optional(),
  availability: z.array(AvailabilitySchema).default([]),
  available_on_user_services: z.boolean().optional(),
});

export type WatchlistItem = z.infer<typeof WatchlistItemSchema>;

export const AddToWatchlistSchema = z.object({
  tmdb_id: z.number().int().positive(),
  email_notifications: z.boolean().default(true), // AC-4.7: email opt-in per item
});

export type AddToWatchlist = z.infer<typeof AddToWatchlistSchema>;

export const PatchWatchlistSchema = z.object({
  watched: z.boolean(),
});

export type PatchWatchlist = z.infer<typeof PatchWatchlistSchema>;

export const AvailabilityReportSchema = z.object({
  region: z.string().min(2).max(10),
  service_slug: z.string().min(1),
  notes: z.string().max(1000).optional(),
});

export type AvailabilityReport = z.infer<typeof AvailabilityReportSchema>;
