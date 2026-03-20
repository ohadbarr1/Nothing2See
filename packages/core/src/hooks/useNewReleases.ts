import { useQuery } from "@tanstack/react-query";
import { apiClient, type NewReleasesQueryParams } from "../api/client";
import type { Title, ApiResponse } from "@nothing2see/types";

export function useNewReleases(params: NewReleasesQueryParams, enabled = true) {
  return useQuery<ApiResponse<Title[]>, Error>({
    queryKey: ["new-releases", params],
    queryFn: () => apiClient.discoverNew(params),
    enabled: enabled && params.services.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
