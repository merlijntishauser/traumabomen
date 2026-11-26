import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useEncryption } from "../contexts/useEncryption";
import { ApiError, createShare, deleteShare, getPublicKey, getShares } from "../lib/api";
import { importSharePublicKey, wrapTreeKey } from "../lib/crypto";
import type { ShareResponse } from "../types/api";

const shareQueryKeys = {
  list: (treeId: string) => ["shares", treeId] as const,
};

/** `error` is a translation key, ready for t(). */
export type ShareOutcome = { ok: true } | { needsInvite: true } | { error: string };

const ERROR_BY_DETAIL: Record<string, string> = {
  cannot_share_with_self: "share.errorSelf",
  already_shared: "share.errorAlready",
  pending_share_limit: "share.errorPendingLimit",
  sharing_not_enabled: "share.errorDisabled",
};

const GENERIC_ERROR = "share.errorGeneric";

function errorKey(err: unknown): string {
  if (!(err instanceof ApiError)) return GENERIC_ERROR;
  if (err.status === 429) return "share.errorRateLimited";
  return ERROR_BY_DETAIL[err.detail] ?? GENERIC_ERROR;
}

export function useTreeShares(treeId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const { i18n } = useTranslation();
  const { keyRingBase64 } = useEncryption();
  const queryClient = useQueryClient();

  const query = useQuery<ShareResponse[]>({
    queryKey: shareQueryKeys.list(treeId),
    queryFn: () => getShares(treeId),
    enabled,
  });

  /** Wrap the owner's own tree key for a registered recipient; null when they have no key pair. */
  async function wrapForRecipient(email: string): Promise<string | null> {
    let publicKey: string;
    try {
      publicKey = (await getPublicKey(email)).public_key;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
    const treeKey = keyRingBase64.get(treeId);
    if (!treeKey) throw new Error("tree key unavailable");
    return wrapTreeKey(treeKey, await importSharePublicKey(publicKey));
  }

  /**
   * Share with a registered user, or ask the caller to confirm an invitation
   * when the address has no key pair. Call again with `invite: true` once the
   * owner has confirmed; the share is then created pending, without a key.
   */
  async function share(email: string, options: { invite?: boolean } = {}): Promise<ShareOutcome> {
    const recipient = email.trim().toLowerCase();
    try {
      let wrapped: string | null = null;
      if (!options.invite) {
        wrapped = await wrapForRecipient(recipient);
        if (wrapped === null) return { needsInvite: true };
      }
      await createShare(treeId, {
        recipient_email: recipient,
        ...(wrapped === null ? {} : { encrypted_tree_key: wrapped }),
        language: i18n.language,
      });
      await queryClient.invalidateQueries({ queryKey: shareQueryKeys.list(treeId) });
      return { ok: true };
    } catch (err) {
      return { error: errorKey(err) };
    }
  }

  async function remove(shareId: string): Promise<ShareOutcome> {
    try {
      await deleteShare(treeId, shareId);
      await queryClient.invalidateQueries({ queryKey: shareQueryKeys.list(treeId) });
      return { ok: true };
    } catch (err) {
      return { error: errorKey(err) };
    }
  }

  return {
    shares: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    share,
    remove,
  };
}
