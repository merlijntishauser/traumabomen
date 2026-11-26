import { useFeatureFlags } from "./useFeatureFlags";
import { useTreesWithGuestLinks } from "./useGuestLinks";

/**
 * What the share dialog may offer, and for which of these trees it opens.
 * With both sharing flags off, Share still opens for a tree that has guest
 * links, so the owner can see and end them.
 */
export function useShareOptions(treeIds: string[]) {
  const { data: flags } = useFeatureFlags();
  const accountSharing = flags?.tree_sharing === true;
  const guestLinks = flags?.guest_links === true;
  const treesWithLinks = useTreesWithGuestLinks(
    treeIds,
    flags !== undefined && !accountSharing && !guestLinks,
  );
  return {
    accountSharing,
    guestLinks,
    canShareTree: (treeId: string) => accountSharing || guestLinks || treesWithLinks.has(treeId),
  };
}
