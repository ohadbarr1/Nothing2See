import type { Title, TitleType } from "@nothing2see/types";
import * as tmdbClient from "../clients/tmdb";
import * as omdbClient from "../clients/omdb";
import * as saClient from "../clients/streamingAvailability";
import { cacheAside, TTL } from "../cache/redis";
import pino from "pino";

const logger = pino({ name: "titleService" });

// ────────────────────────────────────────────────────────────
// Search titles
// ────────────────────────────────────────────────────────────
export async function searchTitles(
  query: string,
  region: string,
  type?: TitleType,
  page = 1,
  limit = 20
): Promise<{ titles: Title[]; total: number; total_pages: number }> {
  const cacheKey = `search:${query}:${region}:${type ?? "all"}:${page}:${limit}`;

  return cacheAside(cacheKey, TTL.SEARCH, async () => {
    // 1. Search TMDB
    let tmdbResults: tmdbClient.TmdbNormalizedTitle[] = [];
    let total = 0;
    let total_pages = 1;

    try {
      const res = await tmdbClient.searchTitles(query, type, page);
      tmdbResults = res.results.slice(0, limit);
      total = res.total;
      total_pages = res.total_pages;
    } catch (err) {
      logger.error({ err }, "TMDB search failed");
      return { titles: [], total: 0, total_pages: 0 };
    }

    // 2. For each result, get streaming availability + IMDb rating concurrently
    const now = new Date().toISOString();
    const titles = await Promise.all(
      tmdbResults.map(async (tmdbTitle): Promise<Title> => {
        const availability =
          tmdbTitle.type === "movie" || tmdbTitle.type === "series"
            ? await fetchAvailability(tmdbTitle.tmdb_id, tmdbTitle.type, region)
            : [];
        const omdbResult = tmdbTitle.imdb_id
          ? await fetchRating(tmdbTitle.imdb_id)
          : null;

        let imdb_rating = omdbResult?.rating ?? null;
        let imdb_votes = omdbResult?.votes ?? null;
        let rating_source: "imdb" | "tmdb" | null = imdb_rating !== null ? "imdb" : null;

        if (imdb_rating === null && tmdbTitle.tmdb_rating !== null && tmdbTitle.tmdb_rating !== undefined) {
          logger.warn({ tmdb_id: tmdbTitle.tmdb_id }, "OMDb rating unavailable, falling back to TMDB rating");
          imdb_rating = tmdbTitle.tmdb_rating;
          rating_source = "tmdb";
        }

        // Cross-region hint: if no availability in requested region, check US/GB/DE
        let cross_region_hint: string | null = null;
        if (availability.length === 0 && (tmdbTitle.type === "movie" || tmdbTitle.type === "series")) {
          cross_region_hint = await fetchCrossRegionHint(
            tmdbTitle.tmdb_id,
            tmdbTitle.type,
            region
          );
        }

        return {
          tmdb_id: tmdbTitle.tmdb_id,
          imdb_id: tmdbTitle.imdb_id ?? null,
          title: tmdbTitle.title,
          original_title: tmdbTitle.original_title,
          overview: tmdbTitle.overview,
          poster_url: tmdbTitle.poster_url,
          backdrop_url: tmdbTitle.backdrop_url,
          type: tmdbTitle.type,
          year: tmdbTitle.year ?? null,
          genres: tmdbTitle.genres,
          imdb_rating,
          imdb_votes,
          rating_source,
          tmdb_rating: tmdbTitle.tmdb_rating,
          runtime: tmdbTitle.runtime ?? null,
          availability,
          cross_region_hint,
          last_updated: now,
        };
      })
    );

    return { titles, total, total_pages };
  });
}

// ────────────────────────────────────────────────────────────
// Get title by TMDB ID
// ────────────────────────────────────────────────────────────
export async function getTitleById(
  tmdbId: number,
  region: string,
  type?: TitleType
): Promise<Title | null> {
  const cacheKey = `title:${tmdbId}:${region}`;

  return cacheAside(cacheKey, TTL.AVAILABILITY, async () => {
    const now = new Date().toISOString();

    // Try movie first, then TV
    let tmdbTitle: tmdbClient.TmdbNormalizedTitle | null = null;

    if (!type || type === "movie") {
      try {
        tmdbTitle = await tmdbClient.getMovieDetail(tmdbId);
      } catch (_) {
        // not a movie
      }
    }

    if (!tmdbTitle && (!type || type === "series")) {
      try {
        tmdbTitle = await tmdbClient.getTvDetail(tmdbId);
      } catch (_) {
        // not a TV show either
      }
    }

    if (!tmdbTitle) return null;

    const [availability, omdbResult] = await Promise.all([
      fetchAvailability(tmdbId, tmdbTitle.type, region),
      tmdbTitle.imdb_id ? fetchRating(tmdbTitle.imdb_id) : Promise.resolve(null),
    ]);

    let imdb_rating = omdbResult?.rating ?? null;
    const imdb_votes = omdbResult?.votes ?? null;
    let rating_source: "imdb" | "tmdb" | null = imdb_rating !== null ? "imdb" : null;

    if (imdb_rating === null && tmdbTitle.tmdb_rating !== null && tmdbTitle.tmdb_rating !== undefined) {
      logger.warn({ tmdb_id: tmdbId }, "OMDb rating unavailable, falling back to TMDB rating");
      imdb_rating = tmdbTitle.tmdb_rating;
      rating_source = "tmdb";
    }

    // Cross-region hint: if no availability in requested region, check US/GB/DE
    let cross_region_hint: string | null = null;
    if (availability.length === 0) {
      cross_region_hint = await fetchCrossRegionHint(tmdbId, tmdbTitle.type, region);
    }

    return {
      tmdb_id: tmdbTitle.tmdb_id,
      imdb_id: tmdbTitle.imdb_id ?? null,
      title: tmdbTitle.title,
      original_title: tmdbTitle.original_title,
      overview: tmdbTitle.overview,
      poster_url: tmdbTitle.poster_url,
      backdrop_url: tmdbTitle.backdrop_url,
      type: tmdbTitle.type,
      year: tmdbTitle.year ?? null,
      genres: tmdbTitle.genres,
      imdb_rating,
      imdb_votes,
      rating_source,
      tmdb_rating: tmdbTitle.tmdb_rating,
      runtime: tmdbTitle.runtime ?? null,
      availability,
      cross_region_hint,
      last_updated: now,
    };
  });
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
async function fetchAvailability(
  tmdbId: number,
  mediaType: TitleType,
  region: string
) {
  const cacheKey = `availability:${tmdbId}:${region}`;
  return cacheAside(cacheKey, TTL.AVAILABILITY, async () => {
    try {
      const result = await saClient.getShowById(tmdbId, mediaType, region);
      return result?.availability ?? [];
    } catch (err) {
      logger.error({ err, tmdbId, region }, "Streaming availability fetch failed");
      return [];
    }
  });
}

// Lightweight fallback: check up to 3 major regions for availability hints
const CROSS_REGION_FALLBACKS = ["US", "GB", "DE"];

async function fetchCrossRegionHint(
  tmdbId: number,
  mediaType: TitleType,
  excludeRegion: string
): Promise<string | null> {
  const fallbacks = CROSS_REGION_FALLBACKS.filter(
    (r) => r.toUpperCase() !== excludeRegion.toUpperCase()
  );

  for (const fallbackRegion of fallbacks) {
    try {
      const result = await saClient.getShowById(tmdbId, mediaType, fallbackRegion);
      if (result && result.availability.length > 0) {
        const serviceNames = [
          ...new Set(result.availability.map((a) => a.service_name)),
        ]
          .slice(0, 2)
          .join(", ");
        return `Available on ${serviceNames} in ${fallbackRegion}`;
      }
    } catch {
      // ignore errors in cross-region lookup
    }
  }
  return null;
}

async function fetchRating(imdbId: string): Promise<omdbClient.OmdbRatingResult | null> {
  const cacheKey = `rating:${imdbId}`;
  return cacheAside(cacheKey, TTL.RATINGS, async () => {
    try {
      return await omdbClient.getRatingByImdbId(imdbId);
    } catch (err) {
      logger.error({ err, imdbId }, "OMDb rating fetch failed");
      return null;
    }
  });
}
