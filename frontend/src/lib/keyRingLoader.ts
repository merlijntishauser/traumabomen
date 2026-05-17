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
  generateTreeKey,
  importTreeKey,
} from "./crypto";

interface KeyRingResult {
  keys: Map<string, CryptoKey>;
  base64Map: Map<string, string>;
}

async function decryptAndImportKeyRing(
  encryptedKeyRing: string,
  masterKey: CryptoKey,
): Promise<KeyRingResult> {
  const keyRingData = await decryptKeyRing(encryptedKeyRing, masterKey);
  const keys = new Map<string, CryptoKey>();
  const base64Map = new Map<string, string>();
  const entries = await Promise.all(
    Object.entries(keyRingData).map(async ([treeId, base64Key]) => {
      const key = await importTreeKey(base64Key);
      return [treeId, key, base64Key] as const;
    }),
  );
  for (const [treeId, key, base64Key] of entries) {
    keys.set(treeId, key);
    base64Map.set(treeId, base64Key);
  }
  return { keys, base64Map };
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

async function performMigration(masterKey: CryptoKey): Promise<KeyRingResult> {
  const trees = await getTrees();
  const keyRingData: Record<string, string> = {};
  const keys = new Map<string, CryptoKey>();
  const base64Map = new Map<string, string>();
  const migrationTrees: MigrateKeysTree[] = [];

  const perTree = await Promise.all(
    trees.map(async (tree) => {
      const [
        { key: treeKey, base64: rawKeyBase64 },
        treeData,
        persons,
        relationships,
        events,
        lifeEvents,
        turningPoints,
        classifications,
        patterns,
        journalEntries,
      ] = await Promise.all([
        generateTreeKey(),
        decryptFromApi(tree.encrypted_data, masterKey),
        getPersons(tree.id),
        getRelationships(tree.id),
        getEvents(tree.id),
        getLifeEvents(tree.id),
        getTurningPoints(tree.id),
        getClassifications(tree.id),
        getPatterns(tree.id),
        getJournalEntries(tree.id),
      ]);

      const [newTreeEncrypted, mp, mr, me, ml, mt, mc, mpa, mj] = await Promise.all([
        encryptForApi(treeData, treeKey),
        reencryptEntities(persons, masterKey, treeKey),
        reencryptEntities(relationships, masterKey, treeKey),
        reencryptEntities(events, masterKey, treeKey),
        reencryptEntities(lifeEvents, masterKey, treeKey),
        reencryptEntities(turningPoints, masterKey, treeKey),
        reencryptEntities(classifications, masterKey, treeKey),
        reencryptEntities(patterns, masterKey, treeKey),
        reencryptEntities(journalEntries, masterKey, treeKey),
      ]);

      return {
        treeId: tree.id,
        treeKey,
        rawKeyBase64,
        migrationTree: {
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
        },
      };
    }),
  );
  for (const { treeId, treeKey, rawKeyBase64, migrationTree } of perTree) {
    keyRingData[treeId] = rawKeyBase64;
    keys.set(treeId, treeKey);
    base64Map.set(treeId, rawKeyBase64);
    migrationTrees.push(migrationTree);
  }

  const encryptedKeyRing = await encryptKeyRing(keyRingData, masterKey);
  await migrateKeys({ encrypted_key_ring: encryptedKeyRing, trees: migrationTrees });

  return { keys, base64Map };
}

export async function loadOrMigrateKeyRing(masterKey: CryptoKey): Promise<KeyRingResult> {
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
