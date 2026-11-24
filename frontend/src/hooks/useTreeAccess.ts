import { useMemo } from "react";
import { useEncryption } from "../contexts/useEncryption";

export interface TreeAccess {
  /** True for a tree someone else shared with this user: it can be read, never changed. */
  readOnly: boolean;
  /** Who shared the tree (display name, or email when they set none); null for an own tree. */
  ownerLabel: string | null;
}

/** How the current user may use a tree: their own, or shared with them read-only. */
export function useTreeAccess(treeId: string): TreeAccess {
  const { sharedTrees } = useEncryption();
  const shared = sharedTrees.get(treeId);
  return useMemo(
    () => ({ readOnly: shared !== undefined, ownerLabel: shared?.ownerLabel ?? null }),
    [shared],
  );
}
