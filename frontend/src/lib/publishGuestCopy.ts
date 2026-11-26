import {
  getClassifications,
  getEvents,
  getLifeEvents,
  getPatterns,
  getPersons,
  getRelationships,
  getSiblingGroups,
  getTree,
  getTurningPoints,
} from "./api";
import { decryptFromApi } from "./crypto";
import {
  buildGuestCopy,
  type GuestCopyInput,
  type GuestCopyLanguage,
  parseGuestCopy,
} from "./guestCopy";
import { deriveGuestKeys, encryptGuestCopy } from "./guestCrypto";

/*
 * Publishing a guest copy: fetch the tree fresh, project it into a copy,
 * check that a guest could open it, and encrypt it for one link. Nothing here
 * reads the query cache, so what the guest sees is what the server holds at
 * the moment of the click. The journal is never fetched.
 */

/** The server's cap on the stored copy: base64 of 5 MB of ciphertext plus framing. */
export const MAX_GUEST_COPY_CHARS = 7_000_000;

export class GuestCopyTooLargeError extends Error {
  constructor() {
    super("Guest copy is over the size limit.");
    this.name = "GuestCopyTooLargeError";
  }
}

/** Some part of the tree could not be fetched or decrypted; nothing was published. */
export class GuestCopyLoadError extends Error {
  constructor(options?: { cause?: unknown }) {
    super("Guest copy could not be loaded.", options);
    this.name = "GuestCopyLoadError";
  }
}

export type FetchGuestCopyInput = (treeId: string, treeKey: CryptoKey) => Promise<GuestCopyInput>;

type Linked = { id: string; person_ids: string[]; encrypted_data: string };

async function decryptLinked<M extends Map<string, { id: string; person_ids: string[] }>>(
  items: Linked[],
  treeKey: CryptoKey,
): Promise<M> {
  const entries = await Promise.all(
    items.map(async (r) => {
      const data = await decryptFromApi<object>(r.encrypted_data, treeKey);
      return [r.id, { ...data, id: r.id, person_ids: r.person_ids }] as const;
    }),
  );
  return new Map(entries) as unknown as M;
}

/**
 * Every entity type of the tree except the journal, fetched and decrypted
 * fresh. Throws GuestCopyLoadError if any request or any single item fails,
 * so a copy is never published with part of the tree missing.
 */
export const fetchGuestCopyInput: FetchGuestCopyInput = async (treeId, treeKey) => {
  try {
    const [
      tree,
      persons,
      relationships,
      events,
      lifeEvents,
      turningPoints,
      classifications,
      patterns,
      siblingGroups,
    ] = await Promise.all([
      getTree(treeId),
      getPersons(treeId),
      getRelationships(treeId),
      getEvents(treeId),
      getLifeEvents(treeId),
      getTurningPoints(treeId),
      getClassifications(treeId),
      getPatterns(treeId),
      getSiblingGroups(treeId),
    ]);
    const [
      treeData,
      personEntries,
      relationshipEntries,
      eventMap,
      lifeEventMap,
      turningPointMap,
      classificationMap,
      patternMap,
      siblingGroupMap,
    ] = await Promise.all([
      decryptFromApi<{ name: string }>(tree.encrypted_data, treeKey),
      Promise.all(
        persons.map(async (r) => {
          const data = await decryptFromApi<object>(r.encrypted_data, treeKey);
          return [r.id, { ...data, id: r.id }] as const;
        }),
      ),
      Promise.all(
        relationships.map(async (r) => {
          const data = await decryptFromApi<object>(r.encrypted_data, treeKey);
          return [
            r.id,
            {
              ...data,
              id: r.id,
              source_person_id: r.source_person_id,
              target_person_id: r.target_person_id,
            },
          ] as const;
        }),
      ),
      decryptLinked<GuestCopyInput["events"]>(events, treeKey),
      decryptLinked<GuestCopyInput["lifeEvents"]>(lifeEvents, treeKey),
      decryptLinked<GuestCopyInput["turningPoints"]>(turningPoints, treeKey),
      decryptLinked<GuestCopyInput["classifications"]>(classifications, treeKey),
      decryptLinked<GuestCopyInput["patterns"]>(patterns, treeKey),
      decryptLinked<GuestCopyInput["siblingGroups"]>(siblingGroups, treeKey),
    ]);
    return {
      treeName: treeData.name,
      persons: new Map(personEntries) as GuestCopyInput["persons"],
      relationships: new Map(relationshipEntries) as GuestCopyInput["relationships"],
      events: eventMap,
      lifeEvents: lifeEventMap,
      turningPoints: turningPointMap,
      classifications: classificationMap,
      patterns: patternMap,
      siblingGroups: siblingGroupMap,
    };
  } catch (err) {
    throw new GuestCopyLoadError({ cause: err });
  }
};

export interface PublishGuestCopyInput {
  treeId: string;
  treeKey: CryptoKey;
  linkSecret: string;
  passphrase: string;
  language: GuestCopyLanguage;
  fetchAll: FetchGuestCopyInput;
  now?: Date;
}

/**
 * Build and encrypt the copy for one link. Throws GuestCopyLoadError when the
 * tree cannot be loaded whole, GuestCopyError when the guest page would refuse
 * the copy, and GuestCopyTooLargeError above the server's size cap.
 */
export async function publishGuestCopy({
  treeId,
  treeKey,
  linkSecret,
  passphrase,
  language,
  fetchAll,
  now = new Date(),
}: PublishGuestCopyInput): Promise<{ linkId: string; token: string; ciphertext: string }> {
  const input = await fetchAll(treeId, treeKey);
  const json = JSON.stringify(buildGuestCopy(input, now, language));
  // Exactly what the guest page will do with it after decrypting.
  parseGuestCopy(JSON.parse(json));
  const { linkId, token, encKey } = await deriveGuestKeys(linkSecret, passphrase);
  const ciphertext = await encryptGuestCopy(json, encKey, linkId);
  if (ciphertext.length > MAX_GUEST_COPY_CHARS) throw new GuestCopyTooLargeError();
  return { linkId, token, ciphertext };
}
