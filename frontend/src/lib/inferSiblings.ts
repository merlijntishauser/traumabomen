import type { DecryptedRelationship } from "../hooks/useTreeData";
import { RelationshipType } from "../types/domain";

export interface InferredSibling {
  personAId: string;
  personBId: string;
  type: "full_sibling" | "half_sibling";
  sharedParentIds: string[];
}

const SIBLING_TYPES = new Set([
  RelationshipType.BiologicalSibling,
  RelationshipType.StepSibling,
  RelationshipType.HalfSibling,
]);

/** Build map: childId -> set of biological parent ids */
export function buildParentMap(
  relationships: Map<string, DecryptedRelationship>,
): Map<string, Set<string>> {
  const parentMap = new Map<string, Set<string>>();
  for (const rel of relationships.values()) {
    if (rel.type === RelationshipType.BiologicalParent) {
      const childId = rel.target_person_id;
      const parentId = rel.source_person_id;
      if (!parentMap.has(childId)) parentMap.set(childId, new Set());
      parentMap.get(childId)!.add(parentId);
    }
  }
  return parentMap;
}

/** Build set of sorted "idA:idB" keys for existing explicit sibling edges */
export function buildExplicitSiblingKeys(
  relationships: Map<string, DecryptedRelationship>,
): Set<string> {
  const keys = new Set<string>();
  for (const rel of relationships.values()) {
    if (SIBLING_TYPES.has(rel.type)) {
      const key = [rel.source_person_id, rel.target_person_id].sort().join(":");
      keys.add(key);
    }
  }
  return keys;
}

export function inferSiblings(
  relationships: Map<string, DecryptedRelationship>,
): InferredSibling[] {
  const parentMap = buildParentMap(relationships);
  const explicitSiblings = buildExplicitSiblingKeys(relationships);
  const entries = Array.from(parentMap.entries());
  const result: InferredSibling[] = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [personAId, parentsA] = entries[i];
      const [personBId, parentsB] = entries[j];

      const shared = [...parentsA].filter((p) => parentsB.has(p));
      if (shared.length === 0) continue;

      const key = [personAId, personBId].sort().join(":");
      if (explicitSiblings.has(key)) continue;

      result.push({
        personAId,
        personBId,
        type: shared.length >= 2 ? "full_sibling" : "half_sibling",
        sharedParentIds: shared,
      });
    }
  }

  return result;
}
