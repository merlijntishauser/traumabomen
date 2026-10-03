import { useQuery } from "@tanstack/react-query";
import { getRegistrationStatus } from "../lib/api";

/**
 * Whether new accounts can be created right now (the private beta has a cap).
 * `undefined` while unknown or when the check fails: callers should then
 * behave as if registration is open, and the register endpoint still has
 * the final say.
 */
export function useRegistrationOpen(): boolean | undefined {
  const { data } = useQuery({
    queryKey: ["registration-status"],
    queryFn: getRegistrationStatus,
    staleTime: 60_000,
    retry: false,
  });
  return data?.open;
}
