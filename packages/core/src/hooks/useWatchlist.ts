import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { WatchlistItem, ApiResponse } from "@nothing2see/types";

const WATCHLIST_KEY = ["watchlist"];

export function useWatchlist(enabled = true) {
  return useQuery<ApiResponse<WatchlistItem[]>, Error>({
    queryKey: WATCHLIST_KEY,
    queryFn: () => apiClient.getWatchlist(),
    enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useAddToWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tmdbId: number) => apiClient.addToWatchlist(tmdbId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: WATCHLIST_KEY });
    },
  });
}

export function useRemoveFromWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tmdbId: number) => apiClient.removeFromWatchlist(tmdbId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: WATCHLIST_KEY });
    },
  });
}

export function useMarkWatched() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tmdbId, watched }: { tmdbId: number; watched: boolean }) =>
      apiClient.markWatched(tmdbId, watched),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: WATCHLIST_KEY });
    },
  });
}
