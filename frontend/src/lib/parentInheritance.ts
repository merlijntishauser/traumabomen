import type { DecryptedRelationship } from "../hooks/useTreeData";
import { RelationshipType } from "../types/domain";

/**
 * Return the ids of every biological parent recorded for `childId` in the
 * relationship map. Used when adding a biological sibling so the new sibling
 * can inherit the existing person's biological parents.
 *
 * Order is the iteration order of the relationship map, which is insertion
 * order in practice. Callers should not rely on a specific ordering.
 */
export function collectBiologicalParentIds(
  relationships: Map<string, DecryptedRelationship>,
  childId: string,
): string[] {
  const parentIds: string[] = [];
  for (const rel of relationships.values()) {
    if (rel.type === RelationshipType.BiologicalParent && rel.target_person_id === childId) {
      parentIds.push(rel.source_person_id);
    }
  }
  return parentIds;
}

export interface ParentInheritanceEdge {
  sourcePersonId: string;
  targetPersonId: string;
}

/**
 * When the user adds a freshly-created person as a biological sibling of an
 * existing person, return the biological-parent edges that should be created
 * so the new person inherits the existing sibling's parents. Returns an empty
 * list for half/step siblings (different semantics) and any non-sibling type.
 */
export function buildSiblingParentInheritance(
  type: RelationshipType,
  newPersonId: string,
  existingSiblingId: string,
  relationships: Map<string, DecryptedRelationship>,
): ParentInheritanceEdge[] {
  if (type !== RelationshipType.BiologicalSibling) return [];
  return collectBiologicalParentIds(relationships, existingSiblingId).map((parentId) => ({
    sourcePersonId: parentId,
    targetPersonId: newPersonId,
  }));
}
