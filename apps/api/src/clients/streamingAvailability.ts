import type { Availability } from "@nothing2see/types";
import pino from "pino";

// NOTE: The free tier of the Streaming Availability API is limited to 100 req/day.
// Upgrade to a paid plan before serving production traffic.

const logger = pino({ name: "streamingAvailabilityClient" });
const BASE_URL = "https://streaming-availability.p.rapidapi.com";

function apiKey(): string {
  const key = process.env["RAPIDAPI_KEY"];
  if (!key) throw new Error("RAPIDAPI_KEY is not set");
  return key;
}

function rapidapiHeaders(): HeadersInit {
  return {
    "x-rapidapi-host": "streaming-availability.p.rapidapi.com",
    "x-rapidapi-key": apiKey(),
  };
}

// Streaming Availability API v4 types
export interface SAStreamingOption {
  service: {
    id: string;
    name: string;
    imageSet?: {
      lightThemeImage?: string;
      darkThemeImage?: string;
    };
  };
  type: string; // "subscription" | "rent" | "buy" | "free"
  quality?: string;
  link: string;
  availableSince?: number;
  leavingDate?: string;
}

export interface SAShow {
  itemType: string;
  showType: "movie" | "series";
  id: string; // tmdb id prefixed like "tmdb_movie_12345"
  imdbId?: string;
  title: string;
  overview?: string;
  releaseYear?: number;
  firstAirYear?: number;
  lastAirYear?: number;
  rating?: number; // 0-100
  genres?: Array<{ id: string; name: string }>;
  imageSet?: {
    verticalPoster?: { w240?: string; w360?: string; w480?: string; w600?: string; w720?: string };
    horizontalPoster?: { w360?: string; w480?: string; w720?: string; w1080?: string; w1440?: string };
  };
  streamingOptions?: Record<string, SAStreamingOption[]>;
  runtime?: number;
  episodeCount?: number;
}

export interface SASearchResponse {
  shows: SAShow[];
  hasMore: boolean;
  nextCursor?: string;
}

function normalizeStreamingOptions(
  streamingOptions: Record<string, SAStreamingOption[]> | undefined,
  targetRegion: string
): Availability[] {
  if (!streamingOptions) return [];

  const regionKey = targetRegion.toLowerCase();
  const options = streamingOptions[regionKey];
  if (!options || options.length === 0) return [];

  const now = new Date().toISOString();

  return options.map((opt) => ({
    service_id: opt.service.id,
    service_name: opt.service.name,
    region: targetRegion.toUpperCase(),
    link: opt.link || null,
    type: normalizeType(opt.type),
    quality: opt.quality ?? null,
    last_updated: now,
  }));
}

function normalizeType(
  t: string
): "subscription" | "rent" | "buy" | "free" | null {
  switch (t) {
    case "subscription":
      return "subscription";
    case "rent":
      return "rent";
    case "buy":
      return "buy";
    case "free":
      return "free";
    default:
      return null;
  }
}

export interface SANormalizedResult {
  tmdb_id: number | null;
  imdb_id: string | null;
  title: string;
  availability: Availability[];
  rating: number | null; // 0-100 scale from SA
}

export async function searchByTitle(
  title: string,
  region: string,
  showType?: "movie" | "series"
): Promise<SANormalizedResult[]> {
  const url = new URL(`${BASE_URL}/shows/search/title`);
  url.searchParams.set("title", title);
  url.searchParams.set("country", region.toLowerCase());
  url.searchParams.set("output_language", "en");
  if (showType) url.searchParams.set("show_type", showType);

  const res = await fetch(url.toString(), {
    headers: rapidapiHeaders(),
  });

  if (!res.ok) {
    throw new Error(
      `Streaming Availability API error: ${res.status} ${res.statusText}`
    );
  }

  // This endpoint returns an array directly
  const data = (await res.json()) as SAShow[];

  return data.map((show) => normalizeShow(show, region));
}

export async function getShowById(
  tmdbId: number,
  mediaType: "movie" | "series",
  region: string
): Promise<SANormalizedResult | null> {
  const saId = mediaType === "movie" ? `tmdb_movie_${tmdbId}` : `tmdb_series_${tmdbId}`;

  const url = new URL(`${BASE_URL}/shows/${saId}`);
  url.searchParams.set("output_language", "en");
  url.searchParams.set("country", region.toLowerCase());

  const res = await fetch(url.toString(), {
    headers: rapidapiHeaders(),
  });

  if (res.status === 404) return null;
  if (res.status === 429) {
    logger.warn("Streaming Availability API rate limit reached");
    return null;
  }
  if (!res.ok) {
    throw new Error(
      `Streaming Availability API error: ${res.status} ${res.statusText}`
    );
  }

  const show = (await res.json()) as SAShow;
  return normalizeShow(show, region);
}

export async function getShowsByService(
  serviceId: string,
  region: string,
  showType?: "movie" | "series",
  cursor?: string
): Promise<{ shows: SANormalizedResult[]; hasMore: boolean; nextCursor?: string }> {
  const url = new URL(`${BASE_URL}/shows/search/filters`);
  url.searchParams.set("country", region.toLowerCase());
  url.searchParams.set("catalogs", `${serviceId}`);
  url.searchParams.set("output_language", "en");
  url.searchParams.set("order_by", "rating");
  url.searchParams.set("order_direction", "desc");
  if (showType) url.searchParams.set("show_type", showType);
  if (cursor) url.searchParams.set("cursor", cursor);

  const res = await fetch(url.toString(), {
    headers: rapidapiHeaders(),
  });

  if (res.status === 429) {
    logger.warn("Streaming Availability API rate limit reached");
    return { shows: [], hasMore: false };
  }
  if (!res.ok) {
    throw new Error(
      `Streaming Availability API error: ${res.status} ${res.statusText}`
    );
  }

  const data = (await res.json()) as SASearchResponse;
  return {
    shows: data.shows.map((s) => normalizeShow(s, region)),
    hasMore: data.hasMore,
    nextCursor: data.nextCursor,
  };
}

function normalizeShow(show: SAShow, region: string): SANormalizedResult {
  // Parse TMDB ID from the id field like "tmdb_movie_12345" or "tmdb_series_12345"
  let tmdbId: number | null = null;
  if (show.id) {
    const match = show.id.match(/\d+$/);
    if (match) {
      tmdbId = parseInt(match[0], 10);
    }
  }

  return {
    tmdb_id: tmdbId,
    imdb_id: show.imdbId ?? null,
    title: show.title,
    availability: normalizeStreamingOptions(show.streamingOptions, region),
    rating: show.rating ?? null,
  };
}
