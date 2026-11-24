import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useEncryption } from "../contexts/useEncryption";
import { getTree } from "../lib/api";

export interface SharedTreeListItem {
  id: string;
  name: string;
  ownerLabel: string;
  /** Decryption failed; `name` holds a placeholder, not the tree's name. */
  unreadable?: boolean;
}

/**
 * The trees other people shared with you, decrypted with the tree keys the
 * context unwrapped on unlock. Revoked or unreachable trees drop out quietly,
 * and one that cannot be decrypted shows as unreadable instead of failing the
 * list. The key is invalidated by useLoadSharing when the background load ends.
 */
export function useSharedTrees() {
  const { t } = useTranslation();
  const { sharedTrees, decrypt, masterKey } = useEncryption();

  return useQuery<SharedTreeListItem[]>({
    queryKey: ["shares", "received"],
    enabled: masterKey !== null && sharedTrees.size > 0,
    queryFn: async () => {
      const items = await Promise.all(
        [...sharedTrees.values()].map(async (info): Promise<SharedTreeListItem | null> => {
          let response: Awaited<ReturnType<typeof getTree>>;
          try {
            response = await getTree(info.treeId);
          } catch {
            // Revoked access (404) is not an error to the viewer; any other
            // failure drops the one entry rather than the whole section.
            return null;
          }
          try {
            const data = await decrypt<{ name: string }>(response.encrypted_data, info.treeId);
            return { id: info.treeId, name: data.name, ownerLabel: info.ownerLabel };
          } catch {
            return {
              id: info.treeId,
              name: t("tree.unreadableName"),
              ownerLabel: info.ownerLabel,
              unreadable: true,
            };
          }
        }),
      );
      return items.filter((item): item is SharedTreeListItem => item !== null);
    },
  });
}
