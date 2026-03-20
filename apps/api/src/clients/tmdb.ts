import type { TitleType } from "@nothing2see/types";

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

function apiKey(): string {
  const key = process.env["TMDB_API_KEY"];
  if (!key) throw new Error("TMDB_API_KEY is not set");
  return key;
}

export interface TmdbSearchResult {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  genre_ids: number[];
  vote_average: number;
}

export interface TmdbMovieDetail {
  id: number;
  imdb_id: string | null;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number | null;
  genres: Array<{ id: number; name: string }>;
  vote_average: number;
}

export interface TmdbTvDetail {
  id: number;
  external_ids?: { imdb_id?: string | null };
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  episode_run_time: number[];
  genres: Array<{ id: number; name: string }>;
  vote_average: number;
}

export interface TmdbNormalizedTitle {
  tmdb_id: number;
  imdb_id: string | null;
  title: string;
  original_title: string;
  overview: string;
  poster_url: string | null;
  backdrop_url: string | null;
  type: TitleType;
  year: number | null;
  genres: string[];
  tmdb_rating: number | null;
  runtime: number | null;
}

function posterUrl(path: string | null, size = "w500"): string | null {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}

function parseYear(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const year = parseInt(dateStr.slice(0, 4), 10);
  return isNaN(year) ? null : year;
}

async function tmdbFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("api_key", apiKey());
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`TMDB API error: ${res.status} ${res.statusText} for ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function searchTitles(
  query: string,
  type?: TitleType,
  page = 1
): Promise<{ results: TmdbNormalizedTitle[]; total: number; total_pages: number }> {
  if (type === "movie") {
    const data = await tmdbFetch<{
      results: TmdbSearchResult[];
      total_results: number;
      total_pages: number;
    }>("/search/movie", { query, page: String(page) });

    return {
      results: data.results.map((r) => normalizeMovie(r as unknown as TmdbMovieDetail)),
      total: data.total_results,
      total_pages: data.total_pages,
    };
  }

  if (type === "series") {
    const data = await tmdbFetch<{
      results: TmdbSearchResult[];
      total_results: number;
      total_pages: number;
    }>("/search/tv", { query, page: String(page) });

    return {
      results: data.results.map((r) => normalizeTv(r as unknown as TmdbTvDetail)),
      total: data.total_results,
      total_pages: data.total_pages,
    };
  }

  // Multi-search
  const data = await tmdbFetch<{
    results: TmdbSearchResult[];
    total_results: number;
    total_pages: number;
  }>("/search/multi", { query, page: String(page) });

  const results = data.results
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .map((r) => {
      if (r.media_type === "movie") {
        return normalizeMovie(r as unknown as TmdbMovieDetail);
      }
      return normalizeTv(r as unknown as TmdbTvDetail);
    });

  return {
    results,
    total: data.total_results,
    total_pages: data.total_pages,
  };
}

export async function getMovieDetail(tmdbId: number): Promise<TmdbNormalizedTitle> {
  const data = await tmdbFetch<TmdbMovieDetail>(`/movie/${tmdbId}`);
  return normalizeMovie(data);
}

export async function getTvDetail(tmdbId: number): Promise<TmdbNormalizedTitle> {
  const data = await tmdbFetch<TmdbTvDetail>(`/tv/${tmdbId}`, {
    append_to_response: "external_ids",
  });
  return normalizeTv(data);
}

function normalizeMovie(d: TmdbMovieDetail): TmdbNormalizedTitle {
  return {
    tmdb_id: d.id,
    imdb_id: d.imdb_id ?? null,
    title: d.title ?? "",
    original_title: d.original_title ?? d.title ?? "",
    overview: d.overview ?? "",
    poster_url: posterUrl(d.poster_path),
    backdrop_url: posterUrl(d.backdrop_path, "original"),
    type: "movie",
    year: parseYear(d.release_date),
    genres: (d.genres ?? []).map((g) => g.name),
    tmdb_rating: d.vote_average ?? null,
    runtime: d.runtime ?? null,
  };
}

function normalizeTv(d: TmdbTvDetail): TmdbNormalizedTitle {
  const imdbId = d.external_ids?.imdb_id ?? null;
  const runtime =
    d.episode_run_time && d.episode_run_time.length > 0
      ? d.episode_run_time[0] ?? null
      : null;

  return {
    tmdb_id: d.id,
    imdb_id: imdbId ?? null,
    title: d.name ?? "",
    original_title: d.original_name ?? d.name ?? "",
    overview: d.overview ?? "",
    poster_url: posterUrl(d.poster_path),
    backdrop_url: posterUrl(d.backdrop_path, "original"),
    type: "series",
    year: parseYear(d.first_air_date),
    genres: (d.genres ?? []).map((g) => g.name),
    tmdb_rating: d.vote_average ?? null,
    runtime: runtime ?? null,
  };
}
