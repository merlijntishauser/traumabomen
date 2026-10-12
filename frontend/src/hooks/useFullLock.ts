import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useEncryption } from "../contexts/useEncryption";

/**
 * The full lock: forget the key and every decrypted query, no navigation.
 * The query cache holds plaintext, so keeping it would leave the tree
 * readable in memory (and on screen) while the app claims to be locked.
 */
export function useFullLock() {
  const { clearKey } = useEncryption();
  const queryClient = useQueryClient();
  return useCallback(() => {
    clearKey();
    queryClient.clear();
  }, [clearKey, queryClient]);
}
