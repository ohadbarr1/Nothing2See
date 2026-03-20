import { useQuery } from "@tanstack/react-query";
import { apiClient, type DiscoverQueryParams } from "../api/client";
import type { Title, ApiResponse } from "@nothing2see/types";

export function useDiscover(params: DiscoverQueryParams, enabled = true) {
  return useQuery<ApiResponse<Title[]>, Error>({
    queryKey: ["discover", params],
    queryFn: () => apiClient.discoverTop(params),
    enabled,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}
