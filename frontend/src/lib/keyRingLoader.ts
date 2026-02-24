import type { MigrateKeysEntity, MigrateKeysTree } from "../types/api";
import {
  ApiError,
  getClassifications,
  getEvents,
  getJournalEntries,
  getKeyRing,
  getLifeEvents,
  getPatterns,
  getPersons,
  getRelationships,
  getTrees,
  getTurningPoints,
  migrateKeys,
} from "./api";
import {
  decryptFromApi,
  decryptKeyRing,
  encryptForApi,
  encryptKeyRing,
  exportKeyToBase64,
  generateTreeKey,
  importTreeKey,
} from "./crypto";

async function decryptAndImportKeyRing(
  encryptedKeyRing: string,
  masterKey: CryptoKey,
): Promise<Map<string, CryptoKey>> {
  const keyRingData = await decryptKeyRing(encryptedKeyRing, masterKey);
  const keys = new Map<string, CryptoKey>();
  for (const [treeId, base64Key] of Object.entries(keyRingData)) {
    keys.set(treeId, await importTreeKey(base64Key));
  }
  return keys;
}

async function reencryptEntities(
  entities: { id: string; encrypted_data: string }[],
  oldKey: CryptoKey,
  newKey: CryptoKey,
): Promise<MigrateKeysEntity[]> {
  return Promise.all(
    entities.map(async (e) => {
      const data = await decryptFromApi(e.encrypted_data, oldKey);
      const enc = await encryptForApi(data, newKey);
      return { id: e.id, encrypted_data: enc };
    }),
  );
}

async function performMigration(masterKey: CryptoKey): Promise<Map<string, CryptoKey>> {
  const trees = await getTrees();
  const keyRingData: Record<string, string> = {};
  const treeKeys = new Map<string, CryptoKey>();
  const migrationTrees: MigrateKeysTree[] = [];

  for (const tree of trees) {
    const treeKey = await generateTreeKey();
    const rawKeyBase64 = await exportKeyToBase64(treeKey);
    keyRingData[tree.id] = rawKeyBase64;
    treeKeys.set(tree.id, treeKey);

    const treeData = await decryptFromApi(tree.encrypted_data, masterKey);
    const newTreeEncrypted = await encryptForApi(treeData, treeKey);

    const [
      persons,
      relationships,
      events,
      lifeEvents,
      turningPoints,
      classifications,
      patterns,
      journalEntries,
    ] = await Promise.all([
      getPersons(tree.id),
      getRelationships(tree.id),
      getEvents(tree.id),
      getLifeEvents(tree.id),
      getTurningPoints(tree.id),
      getClassifications(tree.id),
      getPatterns(tree.id),
      getJournalEntries(tree.id),
    ]);

    const [mp, mr, me, ml, mt, mc, mpa, mj] = await Promise.all([
      reencryptEntities(persons, masterKey, treeKey),
      reencryptEntities(relationships, masterKey, treeKey),
      reencryptEntities(events, masterKey, treeKey),
      reencryptEntities(lifeEvents, masterKey, treeKey),
      reencryptEntities(turningPoints, masterKey, treeKey),
      reencryptEntities(classifications, masterKey, treeKey),
      reencryptEntities(patterns, masterKey, treeKey),
      reencryptEntities(journalEntries, masterKey, treeKey),
    ]);

    migrationTrees.push({
      tree_id: tree.id,
      encrypted_data: newTreeEncrypted,
      persons: mp,
      relationships: mr,
      events: me,
      life_events: ml,
      turning_points: mt,
      classifications: mc,
      patterns: mpa,
      journal_entries: mj,
    });
  }

  const encryptedKeyRing = await encryptKeyRing(keyRingData, masterKey);
  await migrateKeys({ encrypted_key_ring: encryptedKeyRing, trees: migrationTrees });

  return treeKeys;
}

export async function loadOrMigrateKeyRing(masterKey: CryptoKey): Promise<Map<string, CryptoKey>> {
  try {
    const { encrypted_key_ring } = await getKeyRing();
    return await decryptAndImportKeyRing(encrypted_key_ring, masterKey);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return await performMigration(masterKey);
    }
    throw err;
  }
}
