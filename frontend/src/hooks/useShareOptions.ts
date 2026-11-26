import { useFeatureFlags } from "./useFeatureFlags";

/**
 * What the share dialog may offer, and for which trees it opens. With both
 * sharing flags off, Share still opens for a tree that has live guest links
 * (from the tree list's has_guest_links), so the owner can see and end them.
 */
export function useShareOptions() {
  const { data: flags } = useFeatureFlags();
  const accountSharing = flags?.tree_sharing === true;
  const guestLinks = flags?.guest_links === true;
  return {
    accountSharing,
    guestLinks,
    canShareTree: (tree: { has_guest_links?: boolean }) =>
      accountSharing || guestLinks || tree.has_guest_links === true,
  };
}
