import type { Title, TitleType } from "@nothing2see/types";
import * as tmdbClient from "../clients/tmdb";
import * as omdbClient from "../clients/omdb";
import * as saClient from "../clients/streamingAvailability";
import { cacheAside, TTL } from "../cache/redis";
import pino from "pino";

const logger = pino({ name: "discoverService" });

export interface DiscoverOptions {
  region: string;
  services: string[];
  type?: TitleType;
  genre?: string;
  min_rating?: number;
}

export async function discoverTop(
  options: DiscoverOptions
): Promise<Title[]> {
  const { region, services, type, genre, min_rating } = options;

  const cacheKey = `discover:${region}:${services.sort().join(",")}:${type ?? "all"}:${genre ?? ""}:${min_rating ?? ""}`;

  return cacheAside(cacheKey, TTL.DISCOVER, async () => {
    const now = new Date().toISOString();

    if (services.length === 0) {
      return getMockTopTitles(region, now);
    }

    // Fetch catalogs from each service in parallel
    const serviceResults = await Promise.allSettled(
      services.map((serviceId) =>
        saClient.getShowsByService(serviceId, region, type)
      )
    );

    // Collect all unique shows (deduplicate by tmdb_id)
    const showMap = new Map<
      number,
      { show: saClient.SANormalizedResult; serviceId: string }
    >();

    serviceResults.forEach((result, idx) => {
      if (result.status === "rejected") {
        logger.error(
          { err: result.reason, service: services[idx] },
          "Failed to fetch catalog for service"
        );
        return;
      }

      result.value.shows.forEach((show) => {
        if (show.tmdb_id && !showMap.has(show.tmdb_id)) {
          showMap.set(show.tmdb_id, {
            show,
            serviceId: services[idx] ?? "",
          });
        }
      });
    });

    if (showMap.size === 0) {
      logger.warn({ options }, "No shows found from Streaming Availability API, returning mock data");
      return getMockTopTitles(region, now);
    }

    // For each show, fetch TMDB metadata + IMDb rating
    const titlePromises = Array.from(showMap.entries()).map(
      async ([tmdbId, { show }]): Promise<Title | null> => {
        try {
          // Fetch TMDB detail to get full metadata
          let tmdbTitle: tmdbClient.TmdbNormalizedTitle | null = null;
          try {
            tmdbTitle = await tmdbClient.getMovieDetail(tmdbId);
          } catch {
            try {
              tmdbTitle = await tmdbClient.getTvDetail(tmdbId);
            } catch {
              // ignore
            }
          }

          // Get IMDb rating and vote count
          const imdbId = tmdbTitle?.imdb_id ?? show.imdb_id;
          let imdb_rating: number | null = null;
          let imdb_votes: number | null = null;
          let rating_source: "imdb" | "tmdb" | null = null;
          if (imdbId) {
            try {
              const omdbResult = await omdbClient.getRatingByImdbId(imdbId);
              imdb_rating = omdbResult.rating;
              imdb_votes = omdbResult.votes;
              if (imdb_rating !== null) rating_source = "imdb";
            } catch (err) {
              logger.error({ err, imdbId }, "OMDb rating failed");
            }
          }

          // If no IMDb rating from OMDb, fall back to TMDB rating
          if (imdb_rating === null && tmdbTitle?.tmdb_rating !== null && tmdbTitle?.tmdb_rating !== undefined) {
            logger.warn({ tmdb_id: tmdbId }, "OMDb rating unavailable in discover, falling back to TMDB rating");
            imdb_rating = tmdbTitle.tmdb_rating;
            rating_source = "tmdb";
          }

          // Last resort: use SA rating (0-100 → 0-10), no votes available
          if (imdb_rating === null && show.rating !== null) {
            imdb_rating = show.rating / 10;
          }

          return {
            tmdb_id: tmdbId,
            imdb_id: imdbId ?? null,
            title: tmdbTitle?.title ?? show.title,
            original_title: tmdbTitle?.original_title ?? show.title,
            overview: tmdbTitle?.overview ?? "",
            poster_url: tmdbTitle?.poster_url ?? null,
            backdrop_url: tmdbTitle?.backdrop_url ?? null,
            type: tmdbTitle?.type ?? (type ?? "movie"),
            year: tmdbTitle?.year ?? null,
            genres: tmdbTitle?.genres ?? [],
            imdb_rating,
            imdb_votes,
            rating_source,
            tmdb_rating: tmdbTitle?.tmdb_rating ?? null,
            runtime: tmdbTitle?.runtime ?? null,
            availability: show.availability,
            last_updated: now,
          };
        } catch (err) {
          logger.error({ err, tmdbId }, "Failed to build title");
          return null;
        }
      }
    );

    const titles = (await Promise.all(titlePromises)).filter(
      (t): t is Title => t !== null
    );

    // Filter out titles with fewer than 1,000 IMDb votes (Use Case 2 acceptance criterion)
    let filtered = titles.filter((t) => (t.imdb_votes ?? 0) >= 1000);

    // Filter by genre
    filtered = genre
      ? filtered.filter((t) =>
          t.genres.some((g) => g.toLowerCase() === genre.toLowerCase())
        )
      : filtered;

    // Filter by min rating
    if (min_rating !== undefined) {
      filtered = filtered.filter(
        (t) => t.imdb_rating !== null && t.imdb_rating !== undefined && t.imdb_rating >= min_rating
      );
    }

    // Sort by IMDb rating descending, take top 30
    return filtered
      .sort((a, b) => (b.imdb_rating ?? 0) - (a.imdb_rating ?? 0))
      .slice(0, 30);
  });
}

// ────────────────────────────────────────────────────────────
// Mock data for when API is unavailable / services not selected
// ────────────────────────────────────────────────────────────
function getMockTopTitles(region: string, now: string): Title[] {
  const mockTitles = [
    {
      tmdb_id: 278,
      imdb_id: "tt0111161",
      title: "The Shawshank Redemption",
      type: "movie" as TitleType,
      year: 1994,
      genres: ["Drama"],
      imdb_rating: 9.3,
      tmdb_rating: 8.7,
    },
    {
      tmdb_id: 238,
      imdb_id: "tt0068646",
      title: "The Godfather",
      type: "movie" as TitleType,
      year: 1972,
      genres: ["Crime", "Drama"],
      imdb_rating: 9.2,
      tmdb_rating: 8.7,
    },
    {
      tmdb_id: 240,
      imdb_id: "tt0071562",
      title: "The Godfather Part II",
      type: "movie" as TitleType,
      year: 1974,
      genres: ["Crime", "Drama"],
      imdb_rating: 9.0,
      tmdb_rating: 8.6,
    },
    {
      tmdb_id: 424,
      imdb_id: "tt0108052",
      title: "Schindler's List",
      type: "movie" as TitleType,
      year: 1993,
      genres: ["Drama", "History", "War"],
      imdb_rating: 9.0,
      tmdb_rating: 8.6,
    },
    {
      tmdb_id: 389,
      imdb_id: "tt0050083",
      title: "12 Angry Men",
      type: "movie" as TitleType,
      year: 1957,
      genres: ["Drama"],
      imdb_rating: 9.0,
      tmdb_rating: 8.5,
    },
    {
      tmdb_id: 129,
      imdb_id: "tt0245429",
      title: "Spirited Away",
      type: "movie" as TitleType,
      year: 2001,
      genres: ["Animation", "Family", "Fantasy"],
      imdb_rating: 8.6,
      tmdb_rating: 8.5,
    },
    {
      tmdb_id: 497,
      imdb_id: "tt0114369",
      title: "Se7en",
      type: "movie" as TitleType,
      year: 1995,
      genres: ["Crime", "Drama", "Mystery"],
      imdb_rating: 8.6,
      tmdb_rating: 8.4,
    },
    {
      tmdb_id: 680,
      imdb_id: "tt0110912",
      title: "Pulp Fiction",
      type: "movie" as TitleType,
      year: 1994,
      genres: ["Thriller", "Crime"],
      imdb_rating: 8.9,
      tmdb_rating: 8.5,
    },
    {
      tmdb_id: 13,
      imdb_id: "tt0109830",
      title: "Forrest Gump",
      type: "movie" as TitleType,
      year: 1994,
      genres: ["Comedy", "Drama"],
      imdb_rating: 8.8,
      tmdb_rating: 8.5,
    },
    {
      tmdb_id: 155,
      imdb_id: "tt0468569",
      title: "The Dark Knight",
      type: "movie" as TitleType,
      year: 2008,
      genres: ["Action", "Crime", "Drama"],
      imdb_rating: 9.0,
      tmdb_rating: 8.5,
    },
  ];

  return mockTitles.map((m) => ({
    ...m,
    original_title: m.title,
    overview: "",
    poster_url: `https://image.tmdb.org/t/p/w500/placeholder.jpg`,
    backdrop_url: null,
    runtime: null,
    availability: [
      {
        service_id: "netflix",
        service_name: "Netflix",
        region,
        link: null,
        type: "subscription" as const,
        quality: "HD",
        last_updated: now,
      },
    ],
    last_updated: now,
  }));
}
