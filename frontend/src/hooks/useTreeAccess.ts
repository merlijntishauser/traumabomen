import { useMemo } from "react";
import { useEncryption } from "../contexts/useEncryption";

/**
 * Whether a tree can be shown yet. "pending": it is not among the user's own
 * trees and the shared trees have not loaded, so it may still turn out to be
 * shared. "unavailable": sharing has loaded and the tree is in neither.
 */
export type TreeAvailability = "own" | "shared" | "pending" | "unavailable";

export interface TreeAccess {
  /** True for a tree someone else shared with this user: it can be read, never changed. */
  readOnly: boolean;
  /** Who shared the tree (display name, or email when they set none); null for an own tree. */
  ownerLabel: string | null;
  availability: TreeAvailability;
}

/** How the current user may use a tree: their own, or shared with them read-only. */
export function useTreeAccess(treeId: string): TreeAccess {
  const { sharedTrees, treeKeys, sharingStatus } = useEncryption();
  const shared = sharedTrees.get(treeId);
  const isOwn = !shared && treeKeys.has(treeId);
  let availability: TreeAvailability;
  if (shared) availability = "shared";
  else if (isOwn) availability = "own";
  else availability = sharingStatus === "loaded" ? "unavailable" : "pending";
  return useMemo(
    () => ({
      readOnly: shared !== undefined,
      ownerLabel: shared?.ownerLabel ?? null,
      availability,
    }),
    [shared, availability],
  );
}
