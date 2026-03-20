import { z } from "zod";

export const StreamingServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  logo_url: z.string().url().nullable().optional(),
  supported_regions: z.array(z.string()),
});

export type StreamingService = z.infer<typeof StreamingServiceSchema>;

export const AvailabilitySchema = z.object({
  service_id: z.string(),
  service_name: z.string(),
  region: z.string(),
  link: z.string().url().nullable().optional(),
  type: z.enum(["subscription", "rent", "buy", "free"]).nullable().optional(),
  quality: z.string().nullable().optional(),
  last_updated: z.string().datetime(),
});

export type Availability = z.infer<typeof AvailabilitySchema>;

export const TitleTypeSchema = z.enum(["movie", "series"]);
export type TitleType = z.infer<typeof TitleTypeSchema>;

export const TitleSchema = z.object({
  tmdb_id: z.number(),
  imdb_id: z.string().nullable().optional(),
  title: z.string(),
  original_title: z.string().nullable().optional(),
  overview: z.string().nullable().optional(),
  poster_url: z.string().nullable().optional(),
  backdrop_url: z.string().nullable().optional(),
  type: TitleTypeSchema,
  year: z.number().nullable().optional(),
  genres: z.array(z.string()).default([]),
  imdb_rating: z.number().nullable().optional(),
  imdb_votes: z.number().nullable().optional(),
  rating_source: z.enum(["imdb", "tmdb"]).nullable().optional(),
  tmdb_rating: z.number().nullable().optional(),
  runtime: z.number().nullable().optional(),
  availability: z.array(AvailabilitySchema).default([]),
  cross_region_hint: z.string().nullable().optional(),
  last_updated: z.string().datetime(),
});

export type Title = z.infer<typeof TitleSchema>;

export const SearchParamsSchema = z.object({
  q: z.string().min(1),
  region: z.string().default("US"),
  type: TitleTypeSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export type SearchParams = z.infer<typeof SearchParamsSchema>;

export const DiscoverParamsSchema = z.object({
  region: z.string().min(1, "region is required"),
  services: z
    .string()
    .transform((val) => val.split(",").filter(Boolean))
    .or(z.array(z.string()))
    .refine((val) => val.length > 0, { message: "at least one service is required" }),
  type: TitleTypeSchema.optional(),
  genre: z.string().optional(),
  min_rating: z.coerce.number().min(0).max(10).optional(),
});

export type DiscoverParams = z.infer<typeof DiscoverParamsSchema>;

export const SUPPORTED_REGIONS = [
  "US",
  "GB",
  "CA",
  "AU",
  "DE",
  "FR",
  "IL",
  "JP",
  "BR",
  "IN",
] as const;

export type SupportedRegion = (typeof SUPPORTED_REGIONS)[number];

export const STREAMING_SERVICES = [
  { id: "netflix", name: "Netflix" },
  { id: "amazon-prime-video", name: "Prime Video" },
  { id: "disney-plus", name: "Disney+" },
  { id: "hbo-max", name: "Max" },
  { id: "apple-tv-plus", name: "Apple TV+" },
  { id: "hulu", name: "Hulu" },
  { id: "paramount-plus", name: "Paramount+" },
  { id: "peacock", name: "Peacock" },
] as const;

export type StreamingServiceId =
  (typeof STREAMING_SERVICES)[number]["id"];
