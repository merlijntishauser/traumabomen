import { useCallback } from "react";
import { useEncryption } from "../contexts/EncryptionContext";
import {
  getClassifications,
  getEvents,
  getJournalEntries,
  getLifeEvents,
  getPatterns,
  getPersons,
  getRelationships,
  getTree,
  getTurningPoints,
} from "../lib/api";
import { encryptForApi } from "../lib/crypto";
import type { useTreeData } from "./useTreeData";

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useExportTree(treeId: string, treeData: ReturnType<typeof useTreeData>) {
  const { treeKeys, keyRingBase64, masterKey } = useEncryption();

  const exportEncrypted = useCallback(async () => {
    const treeKey = treeKeys.get(treeId);
    const rawKeyBase64 = keyRingBase64.get(treeId);
    if (!treeKey || !rawKeyBase64 || !masterKey) throw new Error("Missing encryption keys");
    const encryptedTreeKey = await encryptForApi(rawKeyBase64, masterKey);

    const [
      tree,
      persons,
      relationships,
      events,
      lifeEvents,
      turningPoints,
      classifications,
      patterns,
      journalEntries,
    ] = await Promise.all([
      getTree(treeId),
      getPersons(treeId),
      getRelationships(treeId),
      getEvents(treeId),
      getLifeEvents(treeId),
      getTurningPoints(treeId),
      getClassifications(treeId),
      getPatterns(treeId),
      getJournalEntries(treeId),
    ]);

    const exportData = {
      version: 1,
      format: "encrypted" as const,
      exported_at: new Date().toISOString(),
      encrypted_tree_key: encryptedTreeKey,
      tree: { id: tree.id, encrypted_data: tree.encrypted_data },
      persons: persons.map((p) => ({ id: p.id, encrypted_data: p.encrypted_data })),
      relationships: relationships.map((r) => ({
        id: r.id,
        source_person_id: r.source_person_id,
        target_person_id: r.target_person_id,
        encrypted_data: r.encrypted_data,
      })),
      events: events.map((e) => ({
        id: e.id,
        person_ids: e.person_ids,
        encrypted_data: e.encrypted_data,
      })),
      life_events: lifeEvents.map((le) => ({
        id: le.id,
        person_ids: le.person_ids,
        encrypted_data: le.encrypted_data,
      })),
      turning_points: turningPoints.map((tp) => ({
        id: tp.id,
        person_ids: tp.person_ids,
        encrypted_data: tp.encrypted_data,
      })),
      classifications: classifications.map((c) => ({
        id: c.id,
        person_ids: c.person_ids,
        encrypted_data: c.encrypted_data,
      })),
      patterns: patterns.map((p) => ({
        id: p.id,
        person_ids: p.person_ids,
        encrypted_data: p.encrypted_data,
      })),
      journal_entries: journalEntries.map((j) => ({ id: j.id, encrypted_data: j.encrypted_data })),
    };

    const name = treeData.treeName ? slugify(treeData.treeName) : "tree";
    downloadJson(exportData, `traumatrees-backup-${name}-${dateStamp()}.json`);
  }, [treeId, treeKeys, keyRingBase64, masterKey, treeData.treeName]);

  const exportPlaintext = useCallback(async () => {
    const exportData = {
      version: 1,
      format: "plaintext" as const,
      exported_at: new Date().toISOString(),
      tree: { name: treeData.treeName },
      persons: Array.from(treeData.persons.values()),
      relationships: Array.from(treeData.relationships.values()),
      events: Array.from(treeData.events.values()),
      life_events: Array.from(treeData.lifeEvents.values()),
      turning_points: Array.from(treeData.turningPoints.values()),
      classifications: Array.from(treeData.classifications.values()),
      patterns: Array.from(treeData.patterns.values()),
      journal_entries: Array.from(treeData.journalEntries.values()),
    };

    const name = treeData.treeName ? slugify(treeData.treeName) : "tree";
    downloadJson(exportData, `traumatrees-export-${name}-${dateStamp()}.json`);
  }, [treeData]);

  return { exportEncrypted, exportPlaintext };
}
