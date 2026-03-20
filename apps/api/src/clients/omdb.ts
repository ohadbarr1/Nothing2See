const BASE_URL = "https://www.omdbapi.com";

function apiKey(): string {
  const key = process.env["OMDB_API_KEY"];
  if (!key) throw new Error("OMDB_API_KEY is not set");
  return key;
}

export interface OmdbRating {
  Source: string;
  Value: string;
}

export interface OmdbResult {
  Title: string;
  Year: string;
  imdbID: string;
  imdbRating: string;
  imdbVotes: string;
  Ratings: OmdbRating[];
  Response: string;
  Error?: string;
}

export interface OmdbRatingResult {
  rating: number | null;
  votes: number | null;
}

export async function getRatingByImdbId(imdbId: string): Promise<OmdbRatingResult> {
  if (!imdbId) return { rating: null, votes: null };

  const url = new URL(BASE_URL);
  url.searchParams.set("apikey", apiKey());
  url.searchParams.set("i", imdbId);
  url.searchParams.set("type", "movie");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`OMDb API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as OmdbResult;

  if (data.Response === "False" || data.Error) {
    // Try as series
    url.searchParams.set("type", "series");
    const res2 = await fetch(url.toString());
    if (!res2.ok) return { rating: null, votes: null };
    const data2 = (await res2.json()) as OmdbResult;
    if (data2.Response === "False" || !data2.imdbRating || data2.imdbRating === "N/A") {
      return { rating: null, votes: null };
    }
    const rating2 = parseFloat(data2.imdbRating);
    const votes2 = data2.imdbVotes
      ? parseInt(data2.imdbVotes.replace(/,/g, ""), 10)
      : null;
    return {
      rating: isNaN(rating2) ? null : rating2,
      votes: votes2 !== null && isNaN(votes2) ? null : votes2,
    };
  }

  if (!data.imdbRating || data.imdbRating === "N/A") return { rating: null, votes: null };
  const rating = parseFloat(data.imdbRating);
  const votes = data.imdbVotes
    ? parseInt(data.imdbVotes.replace(/,/g, ""), 10)
    : null;
  return {
    rating: isNaN(rating) ? null : rating,
    votes: votes !== null && isNaN(votes) ? null : votes,
  };
}

export async function getRatingByTitle(
  title: string,
  year?: number
): Promise<number | null> {
  const url = new URL(BASE_URL);
  url.searchParams.set("apikey", apiKey());
  url.searchParams.set("t", title);
  if (year) url.searchParams.set("y", String(year));

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const data = (await res.json()) as OmdbResult;
  if (data.Response === "False" || !data.imdbRating || data.imdbRating === "N/A") {
    return null;
  }

  const rating = parseFloat(data.imdbRating);
  return isNaN(rating) ? null : rating;
}
