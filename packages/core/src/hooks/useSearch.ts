import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiClient, type SearchQueryParams } from "../api/client";
import type { Title, ApiResponse } from "@nothing2see/types";

export function useSearch(params: SearchQueryParams, enabled = true) {
  return useQuery<ApiResponse<Title[]>, Error>({
    queryKey: ["search", params],
    queryFn: () => apiClient.searchTitles(params),
    enabled: enabled && params.q.trim().length > 0,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
