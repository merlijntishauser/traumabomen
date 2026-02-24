import { useCallback } from "react";
import { useEncryption } from "../contexts/EncryptionContext";
import { createTree, syncTree, updateKeyRing } from "../lib/api";
import { decryptFromApi, encryptKeyRing, importTreeKey } from "../lib/crypto";

interface ImportedEntity {
  id?: string;
  encrypted_data: string;
  person_ids?: string[];
  source_person_id?: string;
  target_person_id?: string;
}

interface EncryptedExport {
  version: number;
  format: string;
  encrypted_tree_key: string;
  tree: { id: string; encrypted_data: string };
  persons: ImportedEntity[];
  relationships: ImportedEntity[];
  events: ImportedEntity[];
  life_events?: ImportedEntity[];
  turning_points?: ImportedEntity[];
  classifications?: ImportedEntity[];
  patterns?: ImportedEntity[];
  journal_entries?: ImportedEntity[];
}

export function useImportTree() {
  const { masterKey, keyRingBase64, addTreeKey } = useEncryption();

  const importTree = useCallback(
    async (file: File): Promise<string> => {
      if (!masterKey) throw new Error("Not unlocked");

      const text = await file.text();
      const data: EncryptedExport = JSON.parse(text);

      if (data.version !== 1 || data.format !== "encrypted") {
        throw new Error("Invalid backup file");
      }

      // Decrypt tree key using master key
      const rawKeyBase64 = await decryptFromApi<string>(data.encrypted_tree_key, masterKey);
      const treeKey = await importTreeKey(rawKeyBase64);

      // Verify by decrypting tree data
      await decryptFromApi(data.tree.encrypted_data, treeKey);

      // Create tree via API
      const newTree = await createTree({ encrypted_data: data.tree.encrypted_data });
      addTreeKey(newTree.id, treeKey, rawKeyBase64);

      // Build ID mapping: export IDs -> new server IDs will be handled by the sync endpoint
      // We pass the original IDs so the server can maintain referential integrity
      await syncTree(newTree.id, {
        persons_create: data.persons.map((p) => ({
          id: p.id,
          encrypted_data: p.encrypted_data,
        })),
        relationships_create: data.relationships.map((r) => ({
          id: r.id,
          source_person_id: r.source_person_id!,
          target_person_id: r.target_person_id!,
          encrypted_data: r.encrypted_data,
        })),
        events_create: data.events.map((e) => ({
          id: e.id,
          person_ids: e.person_ids ?? [],
          encrypted_data: e.encrypted_data,
        })),
        life_events_create: (data.life_events ?? []).map((le) => ({
          id: le.id,
          person_ids: le.person_ids ?? [],
          encrypted_data: le.encrypted_data,
        })),
        classifications_create: (data.classifications ?? []).map((c) => ({
          id: c.id,
          person_ids: c.person_ids ?? [],
          encrypted_data: c.encrypted_data,
        })),
        turning_points_create: (data.turning_points ?? []).map((tp) => ({
          id: tp.id,
          person_ids: tp.person_ids ?? [],
          encrypted_data: tp.encrypted_data,
        })),
        patterns_create: (data.patterns ?? []).map((p) => ({
          id: p.id,
          person_ids: p.person_ids ?? [],
          encrypted_data: p.encrypted_data,
        })),
        journal_entries_create: (data.journal_entries ?? []).map((je) => ({
          id: je.id,
          encrypted_data: je.encrypted_data,
        })),
      });

      // Update key ring on server
      const ringEntries: Record<string, string> = Object.fromEntries(keyRingBase64);
      ringEntries[newTree.id] = rawKeyBase64;
      const encryptedRing = await encryptKeyRing(ringEntries, masterKey);
      await updateKeyRing(encryptedRing);

      return newTree.id;
    },
    [masterKey, keyRingBase64, addTreeKey],
  );

  return { importTree };
}
