import type { ApiResponse, Title, StreamingService } from "@nothing2see/types";

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

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
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

export const apiClient = {
  searchTitles(params: SearchQueryParams): Promise<ApiResponse<Title[]>> {
    return apiFetch<Title[]>(
      `/api/v1/titles/search${buildQuery(params as Record<string, unknown>)}`
    );
  },

  getTitleById(
    tmdbId: number,
    region?: string
  ): Promise<ApiResponse<Title>> {
    const qs = region ? `?region=${region}` : "";
    return apiFetch<Title>(`/api/v1/titles/${tmdbId}${qs}`);
  },

  discoverTop(params: DiscoverQueryParams): Promise<ApiResponse<Title[]>> {
    const { services, ...rest } = params;
    const queryParams: Record<string, unknown> = { ...rest };
    if (services && services.length > 0) {
      queryParams["services"] = services.join(",");
    }
    return apiFetch<Title[]>(
      `/api/v1/discover/top${buildQuery(queryParams)}`
    );
  },

  getServices(): Promise<ApiResponse<StreamingService[]>> {
    return apiFetch<StreamingService[]>("/api/v1/services");
  },

  health(): Promise<ApiResponse<{ status: string; version: string }>> {
    return apiFetch<{ status: string; version: string }>("/api/v1/health");
  },
};

export type ApiClient = typeof apiClient;
