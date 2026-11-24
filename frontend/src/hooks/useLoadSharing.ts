import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useEncryption } from "../contexts/useEncryption";
import { loadSharing } from "../lib/sharingLoader";

/**
 * Returns a function that loads sharing state in the background after an
 * unlock. It is deliberately not awaited by callers, so unlocking takes no
 * longer than before; the shared trees appear once their keys are unwrapped.
 * loadSharing never rejects, so there is nothing to catch.
 */
export function useLoadSharing(): (masterKey: CryptoKey, ownKeyRing: Map<string, string>) => void {
  const { setSharing } = useEncryption();
  const queryClient = useQueryClient();

  return useCallback(
    (masterKey: CryptoKey, ownKeyRing: Map<string, string>) => {
      void loadSharing(masterKey, ownKeyRing).then(({ sharedKeys, sharedTrees }) => {
        setSharing(masterKey, sharedKeys, sharedTrees);
        void queryClient.invalidateQueries({ queryKey: ["shares", "received"] });
      });
    },
    [setSharing, queryClient],
  );
}
