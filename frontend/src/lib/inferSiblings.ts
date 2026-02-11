import { RelationshipType } from "../types/domain";
import type { DecryptedRelationship } from "../hooks/useTreeData";

export interface InferredSibling {
  personAId: string;
  personBId: string;
  type: "full_sibling" | "half_sibling";
  sharedParentIds: string[];
}

export function inferSiblings(
  relationships: Map<string, DecryptedRelationship>,
): InferredSibling[] {
  // Build map: childId -> set of biological parent ids
  const parentMap = new Map<string, Set<string>>();
  for (const rel of relationships.values()) {
    if (rel.type === RelationshipType.BiologicalParent) {
      const childId = rel.target_person_id;
      const parentId = rel.source_person_id;
      if (!parentMap.has(childId)) parentMap.set(childId, new Set());
      parentMap.get(childId)!.add(parentId);
    }
  }

  // Build set of existing explicit sibling edges for deduplication
  const explicitSiblings = new Set<string>();
  for (const rel of relationships.values()) {
    if (
      rel.type === RelationshipType.BiologicalSibling ||
      rel.type === RelationshipType.StepSibling
    ) {
      const key = [rel.source_person_id, rel.target_person_id].sort().join(":");
      explicitSiblings.add(key);
    }
  }

  // Compare all pairs of persons who have at least one parent
  const entries = Array.from(parentMap.entries());
  const result: InferredSibling[] = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [personAId, parentsA] = entries[i];
      const [personBId, parentsB] = entries[j];

      const shared = [...parentsA].filter((p) => parentsB.has(p));
      if (shared.length === 0) continue;

      // Skip if there's already an explicit sibling edge
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
