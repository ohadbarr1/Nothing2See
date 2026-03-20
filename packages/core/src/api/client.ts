import type {
  ApiResponse,
  Title,
  StreamingService,
  User,
  WatchlistItem,
  AuthTokens,
  AvailabilityReport,
} from "@nothing2see/types";

const DEFAULT_BASE_URL = "http://localhost:3001";

function getBaseUrl(): string {
  // When running in a Vite-bundled browser context, import.meta.env is available.
  // Use a try/catch + typeof guard so the package also compiles cleanly for
  // Node-based tools (e.g. tsup, jest) where import.meta may not be defined.
  try {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const env = (import.meta as any).env as Record<string, string> | undefined;
      return env?.["VITE_API_BASE_URL"] ?? DEFAULT_BASE_URL;
    }
  } catch {
    // import.meta not available (e.g. CommonJS build)
  }
  return DEFAULT_BASE_URL;
}

// Token getter — can be swapped by the app at runtime
let _getToken: (() => string | null) | null = null;

export function setTokenGetter(getter: () => string | null) {
  _getToken = getter;
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit & { auth?: boolean }
): Promise<ApiResponse<T>> {
  const url = `${getBaseUrl()}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) ?? {}),
  };

  if (options?.auth && _getToken) {
    const token = _getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const { auth: _auth, ...restOptions } = options ?? {};
  void _auth;

  const res = await fetch(url, {
    credentials: "include", // send httpOnly cookies (refresh token)
    headers,
    ...restOptions,
  });

  const json = (await res.json()) as ApiResponse<T>;
  return json;
}

function buildQuery(params: Record<string, unknown>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return qs ? `?${qs}` : "";
}

export interface SearchQueryParams {
  q: string;
  region?: string;
  type?: "movie" | "series";
  page?: number;
  limit?: number;
}

export interface DiscoverQueryParams {
  region?: string;
  services?: string[];
  type?: "movie" | "series";
  genre?: string;
  min_rating?: number;
}

export interface NewReleasesQueryParams {
  region: string;
  services: string[];
  type?: "movie" | "series";
  genre?: string;
}

export const apiClient = {
  // ── Titles ──────────────────────────────────────────────
  searchTitles(params: SearchQueryParams): Promise<ApiResponse<Title[]>> {
    return apiFetch<Title[]>(
      `/api/v1/titles/search${buildQuery(params as Record<string, unknown>)}`
    );
  },

  getTitleById(tmdbId: number, region?: string): Promise<ApiResponse<Title>> {
    const qs = region ? `?region=${region}` : "";
    return apiFetch<Title>(`/api/v1/titles/${tmdbId}${qs}`);
  },

  reportAvailability(
    tmdbId: number,
    body: AvailabilityReport
  ): Promise<ApiResponse<{ id: number }>> {
    return apiFetch<{ id: number }>(`/api/v1/titles/${tmdbId}/report`, {
      method: "POST",
      body: JSON.stringify(body),
      auth: true,
    });
  },

  // ── Discover ─────────────────────────────────────────────
  discoverTop(params: DiscoverQueryParams): Promise<ApiResponse<Title[]>> {
    const { services, ...rest } = params;
    const queryParams: Record<string, unknown> = { ...rest };
    if (services && services.length > 0) {
      queryParams["services"] = services.join(",");
    }
    return apiFetch<Title[]>(`/api/v1/discover/top${buildQuery(queryParams)}`);
  },

  discoverNew(params: NewReleasesQueryParams): Promise<ApiResponse<Title[]>> {
    const { services, ...rest } = params;
    const queryParams: Record<string, unknown> = { ...rest };
    if (services && services.length > 0) {
      queryParams["services"] = services.join(",");
    }
    return apiFetch<Title[]>(`/api/v1/discover/new${buildQuery(queryParams)}`);
  },

  // ── Services ─────────────────────────────────────────────
  getServices(): Promise<ApiResponse<StreamingService[]>> {
    return apiFetch<StreamingService[]>("/api/v1/services");
  },

  // ── Auth ─────────────────────────────────────────────────
  refreshToken(): Promise<ApiResponse<AuthTokens>> {
    return apiFetch<AuthTokens>("/api/v1/auth/refresh", { method: "POST" });
  },

  logout(): Promise<ApiResponse<{ message: string }>> {
    return apiFetch<{ message: string }>("/api/v1/auth/logout", {
      method: "POST",
      auth: true,
    });
  },

  // ── Users ────────────────────────────────────────────────
  getMe(): Promise<ApiResponse<User>> {
    return apiFetch<User>("/api/v1/users/me", { auth: true });
  },

  updateMe(body: { display_name?: string; region?: string }): Promise<ApiResponse<User>> {
    return apiFetch<User>("/api/v1/users/me", {
      method: "PATCH",
      body: JSON.stringify(body),
      auth: true,
    });
  },

  getMyServices(): Promise<ApiResponse<string[]>> {
    return apiFetch<string[]>("/api/v1/users/me/services", { auth: true });
  },

  updateMyServices(service_slugs: string[]): Promise<ApiResponse<string[]>> {
    return apiFetch<string[]>("/api/v1/users/me/services", {
      method: "PUT",
      body: JSON.stringify({ service_slugs }),
      auth: true,
    });
  },

  // ── Watchlist ────────────────────────────────────────────
  getWatchlist(): Promise<ApiResponse<WatchlistItem[]>> {
    return apiFetch<WatchlistItem[]>("/api/v1/users/me/watchlist", {
      auth: true,
    });
  },

  addToWatchlist(tmdb_id: number): Promise<ApiResponse<WatchlistItem>> {
    return apiFetch<WatchlistItem>("/api/v1/users/me/watchlist", {
      method: "POST",
      body: JSON.stringify({ tmdb_id }),
      auth: true,
    });
  },

  removeFromWatchlist(tmdb_id: number): Promise<ApiResponse<{ removed: boolean }>> {
    return apiFetch<{ removed: boolean }>(
      `/api/v1/users/me/watchlist/${tmdb_id}`,
      { method: "DELETE", auth: true }
    );
  },

  markWatched(
    tmdb_id: number,
    watched: boolean
  ): Promise<ApiResponse<WatchlistItem>> {
    return apiFetch<WatchlistItem>(`/api/v1/users/me/watchlist/${tmdb_id}`, {
      method: "PATCH",
      body: JSON.stringify({ watched }),
      auth: true,
    });
  },

  // ── Misc ─────────────────────────────────────────────────
  health(): Promise<ApiResponse<{ status: string; version: string }>> {
    return apiFetch<{ status: string; version: string }>("/api/v1/health");
  },
};

export type ApiClient = typeof apiClient;
