import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useEncryption } from "../contexts/useEncryption";
import { ApiError, removeSharedTree } from "../lib/api";
import type { SharedTreeListItem } from "./useSharedTrees";

const RECEIVED_KEY = ["shares", "received"] as const;

interface RemoveState {
  busy: boolean;
  /** A translation key, ready for t(). */
  error: string | null;
}

function errorKey(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) return "share.errorRateLimited";
  return "share.errorGeneric";
}

/**
 * Lets the recipient take a tree someone shared with them off their list.
 * The share is deleted on the server, then the tree and its key are dropped
 * from this session. A 404 means the share is already gone (the owner
 * revoked it), which is the outcome the user asked for.
 */
export function useRemoveSharedTree() {
  const { sharedTrees, dropSharedTree } = useEncryption();
  const queryClient = useQueryClient();
  const [state, setState] = useState<RemoveState>({ busy: false, error: null });

  const remove = useCallback(
    async (treeId: string, options: { beforeDrop?: () => void } = {}): Promise<boolean> => {
      const info = sharedTrees.get(treeId);
      if (!info) return false;
      setState({ busy: true, error: null });
      try {
        await removeSharedTree(info.shareId);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) {
          setState({ busy: false, error: errorKey(err) });
          return false;
        }
      }
      // The received list stops querying once no shared tree is left, so a
      // refetch alone would leave the last one showing.
      queryClient.setQueryData<SharedTreeListItem[]>(RECEIVED_KEY, (items) =>
        items?.filter((item) => item.id !== treeId),
      );
      // Lets a caller leave the tree's view first, in the same update as the
      // drop, so nothing still showing the tree renders it as unavailable.
      options.beforeDrop?.();
      dropSharedTree(treeId);
      void queryClient.invalidateQueries({ queryKey: RECEIVED_KEY });
      setState({ busy: false, error: null });
      return true;
    },
    [sharedTrees, dropSharedTree, queryClient],
  );

  const reset = useCallback(() => setState({ busy: false, error: null }), []);

  return { remove, reset, busy: state.busy, error: state.error };
}
