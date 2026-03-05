import { useQuery } from "@tanstack/react-query";
import { getFeatureFlags } from "../lib/api";

export function useFeatureFlags() {
  return useQuery({
    queryKey: ["features"],
    queryFn: getFeatureFlags,
    staleTime: 5 * 60 * 1000,
  });
}
