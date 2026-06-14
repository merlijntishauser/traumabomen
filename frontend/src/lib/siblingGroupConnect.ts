/**
 * Helpers for connecting a sibling-group pill on the canvas. Dragging an edge
 * to or from the pill bulk-creates the relationship for every in-tree sibling
 * in the group at once (lightweight members have no node, so they are skipped).
 */

const SIBLING_GROUP_NODE_PREFIX = "sibling-group-";

/** The group id if the node id is a sibling-group pill, otherwise null. */
export function siblingGroupIdFromNodeId(nodeId: string | null | undefined): string | null {
  if (!nodeId) return null;
  return nodeId.startsWith(SIBLING_GROUP_NODE_PREFIX)
    ? nodeId.slice(SIBLING_GROUP_NODE_PREFIX.length)
    : null;
}

export interface RelationshipPair {
  sourcePersonId: string;
  targetPersonId: string;
}

interface SiblingGroupRef {
  id: string;
  person_ids: string[];
}

interface RelationshipEndpoints {
  source_person_id: string;
  target_person_id: string;
}

/**
 * Expand a connection where one endpoint is a sibling-group pill into one
 * relationship per in-tree sibling. Each sibling takes the role (source or
 * target) the pill was dragged as, so the relationship type and direction the
 * user picks apply uniformly. Skips the sibling that is the other endpoint (no
 * self-edge) and any pair that already has a relationship in either direction.
 */
export function expandSiblingGroupConnection(
  source: string,
  target: string,
  group: SiblingGroupRef,
  relationships: Map<string, RelationshipEndpoints>,
): RelationshipPair[] {
  const groupNodeId = `${SIBLING_GROUP_NODE_PREFIX}${group.id}`;
  const pillIsSource = source === groupNodeId;
  const other = pillIsSource ? target : source;

  const existing = new Set<string>();
  for (const rel of relationships.values()) {
    existing.add(`${rel.source_person_id}>${rel.target_person_id}`);
    existing.add(`${rel.target_person_id}>${rel.source_person_id}`);
  }

  const pairs: RelationshipPair[] = [];
  for (const siblingId of group.person_ids) {
    if (siblingId === other) continue;
    const pair = pillIsSource
      ? { sourcePersonId: siblingId, targetPersonId: other }
      : { sourcePersonId: other, targetPersonId: siblingId };
    if (existing.has(`${pair.sourcePersonId}>${pair.targetPersonId}`)) continue;
    pairs.push(pair);
  }
  return pairs;
}
