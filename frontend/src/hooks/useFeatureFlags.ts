import { useQuery } from "@tanstack/react-query";
import { getFeatureFlags } from "../lib/api";

export const featureQueryKeys = {
  flags: () => ["features"] as const,
};

export function useFeatureFlags() {
  return useQuery({
    queryKey: featureQueryKeys.flags(),
    queryFn: getFeatureFlags,
    staleTime: 5 * 60 * 1000,
  });
}
