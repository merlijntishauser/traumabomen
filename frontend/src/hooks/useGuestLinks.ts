import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useEncryption } from "../contexts/useEncryption";
import {
  ApiError,
  createGuestLink,
  deleteGuestLink,
  extendGuestLink,
  isCopyTooLarge,
  listGuestLinks,
  republishGuestLink,
  unlockGuestLink,
} from "../lib/api";
import { decryptFromApi, encryptForApi } from "../lib/crypto";
import { GuestCopyError } from "../lib/guestCopy";
import { generateLinkSecret } from "../lib/guestCrypto";
import { guestLanguageOf } from "../lib/guestLinkFormat";
import { generatePassphrase } from "../lib/passphraseWords";
import {
  fetchGuestCopyInput,
  GuestCopyLoadError,
  GuestCopyTooLargeError,
  publishGuestCopy,
} from "../lib/publishGuestCopy";
import type { GuestLink } from "../types/api";

const guestLinkQueryKeys = {
  list: (treeId: string) => ["guestLinks", treeId] as const,
  secrets: (treeId: string, ids: string[]) => ["guestLinks", treeId, "secrets", ids] as const,
};

/** What the owner's browser keeps per link, encrypted under the tree key as owner_blob. */
export interface GuestLinkSecret {
  linkSecret: string;
  passphrase: string;
  label: string;
}

export interface OwnedGuestLink extends GuestLink {
  /** Null when the owner blob could not be decrypted with this tree key. */
  secret: GuestLinkSecret | null;
}

/** `error` is a translation key, ready for t(). */
export type GuestLinkOutcome = { ok: true } | { error: string };

const ERROR_BY_DETAIL: Record<string, string> = {
  guest_links_not_enabled: "guestLinks.errorDisabled",
  too_many_links: "guestLinks.errorTooMany",
};

export function guestLinkErrorKey(err: unknown): string {
  if (err instanceof GuestCopyTooLargeError || isCopyTooLarge(err)) {
    return "guestLinks.errorTooLarge";
  }
  if (err instanceof GuestCopyLoadError) return "guestLinks.errorLoad";
  if (err instanceof GuestCopyError) return "guestLinks.errorInvalid";
  if (err instanceof ApiError) {
    if (err.status === 429) return "guestLinks.errorRateLimited";
    return ERROR_BY_DETAIL[err.detail] ?? "guestLinks.errorGeneric";
  }
  return "guestLinks.errorGeneric";
}

async function readSecrets(
  links: GuestLink[],
  treeKey: CryptoKey,
): Promise<Map<string, GuestLinkSecret | null>> {
  const entries = await Promise.all(
    links.map(async (link) => {
      try {
        return [link.id, await decryptFromApi<GuestLinkSecret>(link.owner_blob, treeKey)] as const;
      } catch {
        return [link.id, null] as const;
      }
    }),
  );
  return new Map(entries);
}

const EMPTY_LINKS: GuestLink[] = [];

async function outcome(run: () => Promise<unknown>): Promise<GuestLinkOutcome> {
  try {
    await run();
    return { ok: true };
  } catch (err) {
    return { error: guestLinkErrorKey(err) };
  }
}

/**
 * The owner's guest links for one tree. Publishing (create and update) always
 * fetches the tree fresh; nothing republishes on its own.
 */
export function useGuestLinks(treeId: string) {
  const { i18n } = useTranslation();
  const { treeKeys } = useEncryption();
  const treeKey = treeKeys.get(treeId);
  const queryClient = useQueryClient();
  const language = guestLanguageOf(i18n.language);

  const listQuery = useQuery({
    queryKey: guestLinkQueryKeys.list(treeId),
    queryFn: () => listGuestLinks(treeId),
  });
  const links = listQuery.data ?? EMPTY_LINKS;
  const ids = links.map((l) => l.id);

  const secretsQuery = useQuery({
    queryKey: guestLinkQueryKeys.secrets(treeId, ids),
    queryFn: () => readSecrets(links, treeKey as CryptoKey),
    enabled: treeKey !== undefined && links.length > 0,
    // The link secrets and passphrases leave memory with the dialog.
    gcTime: 0,
  });

  function requireKey(): CryptoKey {
    if (!treeKey) throw new Error("tree key unavailable");
    return treeKey;
  }

  const createMutation = useMutation({
    mutationFn: async ({ label, days }: { label: string; days: number }) => {
      const key = requireKey();
      const linkSecret = generateLinkSecret();
      const passphrase = await generatePassphrase(language);
      const [{ linkId, token, ciphertext }, ownerBlob] = await Promise.all([
        publishGuestCopy({
          treeId,
          treeKey: key,
          linkSecret,
          passphrase,
          language,
          fetchAll: fetchGuestCopyInput,
        }),
        encryptForApi({ linkSecret, passphrase, label }, key),
      ]);
      return createGuestLink(treeId, {
        link_id: linkId,
        token,
        ciphertext,
        owner_blob: ownerBlob,
        expires_in_days: days,
      });
    },
    // The tree list's has_guest_links changes with these too.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: guestLinkQueryKeys.list(treeId) }),
        queryClient.invalidateQueries({ queryKey: ["trees"], exact: true }),
      ]),
  });

  const republishMutation = useMutation({
    mutationFn: async (link: OwnedGuestLink) => {
      if (!link.secret) throw new Error("link secret unavailable");
      const { ciphertext } = await publishGuestCopy({
        treeId,
        treeKey: requireKey(),
        linkSecret: link.secret.linkSecret,
        passphrase: link.secret.passphrase,
        language,
        fetchAll: fetchGuestCopyInput,
      });
      return republishGuestLink(treeId, link.id, ciphertext);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: guestLinkQueryKeys.list(treeId) }),
  });

  const extendMutation = useMutation({
    mutationFn: ({ id, days }: { id: string; days: number }) => extendGuestLink(treeId, id, days),
    // The tree list's has_guest_links changes with these too.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: guestLinkQueryKeys.list(treeId) }),
        queryClient.invalidateQueries({ queryKey: ["trees"], exact: true }),
      ]),
  });
  const unlockMutation = useMutation({
    mutationFn: (id: string) => unlockGuestLink(treeId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: guestLinkQueryKeys.list(treeId) }),
  });
  const endMutation = useMutation({
    mutationFn: (id: string) => deleteGuestLink(treeId, id),
    // The tree list's has_guest_links changes with these too.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: guestLinkQueryKeys.list(treeId) }),
        queryClient.invalidateQueries({ queryKey: ["trees"], exact: true }),
      ]),
  });

  const secrets = secretsQuery.data;
  const owned: OwnedGuestLink[] = links.map((link) => ({
    ...link,
    secret: secrets?.get(link.id) ?? null,
  }));

  return {
    links: owned,
    isLoading:
      listQuery.isLoading || (links.length > 0 && treeKey !== undefined && secretsQuery.isPending),
    isError: listQuery.isError,
    busy: [createMutation, republishMutation, extendMutation, unlockMutation, endMutation].some(
      (m) => m.isPending,
    ),
    create: (input: { label: string; days: number }) =>
      outcome(() => createMutation.mutateAsync(input)),
    republish: (link: OwnedGuestLink) => outcome(() => republishMutation.mutateAsync(link)),
    extend: (id: string, days: number) => outcome(() => extendMutation.mutateAsync({ id, days })),
    unlock: (id: string) => outcome(() => unlockMutation.mutateAsync(id)),
    end: (id: string) => outcome(() => endMutation.mutateAsync(id)),
  };
}

export type GuestLinks = ReturnType<typeof useGuestLinks>;
