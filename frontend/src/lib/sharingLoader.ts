import * as Sentry from "@sentry/react";
import type { KeyPairResponse, PendingShareResponse, SharedKeyResponse } from "../types/api";
import {
  ApiError,
  completeShare,
  getKeyPair,
  getPendingShares,
  getSharedKeys,
  putKeyPair,
} from "./api";
import {
  decryptFromApi,
  encryptForApi,
  generateShareKeyPair,
  importSharePrivateKey,
  importSharePublicKey,
  unwrapTreeKey,
  wrapTreeKey,
} from "./crypto";

export interface SharedTreeInfo {
  shareId: string;
  treeId: string;
  ownerLabel: string;
}

export interface SharingResult {
  sharedKeys: Map<string, CryptoKey>;
  sharedTrees: Map<string, SharedTreeInfo>;
}

function isApiError(err: unknown, status: number): boolean {
  return err instanceof ApiError && err.status === status;
}

/**
 * Report a sharing failure without the original error. Its message can come
 * from WebCrypto or the API, and nothing in a sharing failure needs more than
 * the stage and the error's name to diagnose; a fresh Error guarantees no
 * key material or payload ends up in Sentry.
 */
function reportFailure(stage: string, err: unknown): void {
  const name = err instanceof Error ? err.name : typeof err;
  const status = err instanceof ApiError ? ` (${err.status})` : "";
  Sentry.captureException(new Error(`Sharing: ${stage} failed: ${name}${status}`));
}

async function ensureKeyPair(masterKey: CryptoKey): Promise<KeyPairResponse> {
  try {
    return await getKeyPair();
  } catch (err) {
    if (!isApiError(err, 404)) throw err;
  }
  const { publicJwk, privateJwk } = await generateShareKeyPair();
  const pair: KeyPairResponse = {
    public_key: publicJwk,
    encrypted_private_key: await encryptForApi(privateJwk, masterKey),
  };
  try {
    await putKeyPair(pair);
    return pair;
  } catch (err) {
    // Another session uploaded a key pair first: use that one.
    if (isApiError(err, 409)) return getKeyPair();
    throw err;
  }
}

async function unwrapGrants(
  grants: SharedKeyResponse[],
  privateKey: CryptoKey,
): Promise<SharingResult> {
  const sharedKeys = new Map<string, CryptoKey>();
  const sharedTrees = new Map<string, SharedTreeInfo>();
  const results = await Promise.allSettled(
    grants.map((grant) => unwrapTreeKey(grant.encrypted_tree_key, privateKey)),
  );
  results.forEach((result, i) => {
    const grant = grants[i];
    if (result.status === "rejected") {
      reportFailure("unwrapping a shared tree key", result.reason);
      return;
    }
    sharedKeys.set(grant.tree_id, result.value);
    sharedTrees.set(grant.tree_id, {
      shareId: grant.share_id,
      treeId: grant.tree_id,
      ownerLabel: grant.owner_display_name ?? grant.owner_email,
    });
  });
  return { sharedKeys, sharedTrees };
}

async function completePendingShare(
  pending: PendingShareResponse,
  treeKeyBase64: string,
): Promise<void> {
  try {
    const publicKey = await importSharePublicKey(pending.recipient_public_key);
    const wrapped = await wrapTreeKey(treeKeyBase64, publicKey);
    await completeShare(pending.tree_id, pending.share_id, wrapped);
  } catch (err) {
    // Completed by another session in the meantime: nothing left to do.
    if (isApiError(err, 409)) return;
    reportFailure("completing a pending share", err);
  }
}

async function completePendingShares(ownKeyRing: Map<string, string>): Promise<void> {
  try {
    const pending = await getPendingShares();
    await Promise.all(
      pending.flatMap((share) => {
        const treeKeyBase64 = ownKeyRing.get(share.tree_id);
        return treeKeyBase64 === undefined ? [] : [completePendingShare(share, treeKeyBase64)];
      }),
    );
  } catch (err) {
    reportFailure("loading pending shares", err);
  }
}

async function loadSharingOrThrow(
  masterKey: CryptoKey,
  ownKeyRing: Map<string, string>,
): Promise<SharingResult> {
  const pair = await ensureKeyPair(masterKey);
  const privateJwk = await decryptFromApi<string>(pair.encrypted_private_key, masterKey);
  const privateKey = await importSharePrivateKey(privateJwk);
  const [received] = await Promise.all([
    getSharedKeys().then((grants) => unwrapGrants(grants, privateKey)),
    completePendingShares(ownKeyRing),
  ]);
  return received;
}

/**
 * Set up everything sharing needs after an unlock: make sure the user has a
 * key pair, unwrap the tree keys shared with them, and finish the shares they
 * started for recipients who have since created a key pair.
 *
 * Never rejects. Sharing must not stand in the way of unlocking the user's
 * own trees, so any failure yields empty maps (and a report without key
 * material). Shared keys are returned separately and must never be added to
 * the user's own key ring.
 */
export async function loadSharing(
  masterKey: CryptoKey,
  ownKeyRing: Map<string, string>,
): Promise<SharingResult> {
  try {
    return await loadSharingOrThrow(masterKey, ownKeyRing);
  } catch (err) {
    reportFailure("loading", err);
    return { sharedKeys: new Map(), sharedTrees: new Map() };
  }
}
