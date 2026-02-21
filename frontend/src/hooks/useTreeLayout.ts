import { useMemo } from "react";
import { inferSiblings } from "../lib/inferSiblings";
import {
  adjustEdgeOverlaps,
  buildBioParentData,
  buildEntityLookups,
  buildJunctionForks,
  buildPersonNodes,
  buildRelationshipEdges,
  computeCoupleColors,
  findFriendOnlyIds,
  layoutDagreGraph,
  positionFriendNodes,
} from "../lib/treeLayoutHelpers";
import { RelationshipType } from "../types/domain";
import type { CanvasSettings } from "./useCanvasSettings";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
} from "./useTreeData";

// Re-export types and constants so existing consumers don't break
export type {
  MarkerShape,
  PersonNodeData,
  PersonNodeType,
  RelationshipEdgeData,
  RelationshipEdgeType,
} from "../lib/treeLayoutHelpers";
export { MARKER_SHAPES, NODE_HEIGHT, NODE_WIDTH } from "../lib/treeLayoutHelpers";

export function useTreeLayout(
  persons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
  events: Map<string, DecryptedEvent>,
  selectedPersonId: string | null,
  lifeEvents?: Map<string, DecryptedLifeEvent>,
  canvasSettings?: Pick<CanvasSettings, "edgeStyle" | "showMarkers">,
  classifications?: Map<string, DecryptedClassification>,
): ReturnType<typeof _computeLayout> {
  return useMemo(
    () =>
      _computeLayout(
        persons,
        relationships,
        events,
        selectedPersonId,
        lifeEvents,
        canvasSettings,
        classifications,
      ),
    [persons, relationships, events, selectedPersonId, lifeEvents, canvasSettings, classifications],
  );
}

function _computeLayout(
  persons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
  events: Map<string, DecryptedEvent>,
  selectedPersonId: string | null,
  lifeEvents?: Map<string, DecryptedLifeEvent>,
  canvasSettings?: Pick<CanvasSettings, "edgeStyle" | "showMarkers">,
  classifications?: Map<string, DecryptedClassification>,
) {
  if (persons.size === 0) {
    return { nodes: [], edges: [] };
  }

  const friendOnlyIds = findFriendOnlyIds(persons, relationships);
  const { bioParentsOf, coupleChildren } = buildBioParentData(relationships);
  const { graph } = layoutDagreGraph(persons, relationships, friendOnlyIds);
  const friendPositions = positionFriendNodes(persons, relationships, friendOnlyIds, graph);
  const lookups = buildEntityLookups(events, lifeEvents, classifications);
  const { nodes, nodeCenter } = buildPersonNodes(
    persons,
    graph,
    friendOnlyIds,
    friendPositions,
    lookups,
    selectedPersonId,
  );
  const { forkHiddenIds, forkDataByEdge } = buildJunctionForks(
    coupleChildren,
    nodeCenter,
    relationships,
    persons,
  );
  const { childCoupleColor, useCoupleColors } = computeCoupleColors(bioParentsOf);
  const inferred = inferSiblings(relationships);
  const edges = buildRelationshipEdges({
    relationships,
    persons,
    nodeCenter,
    childCoupleColor,
    useCoupleColors,
    forkDataByEdge,
    forkHiddenIds,
    inferred,
    edgeStyle: canvasSettings?.edgeStyle,
  });
  adjustEdgeOverlaps(edges, nodeCenter, canvasSettings?.showMarkers !== false);

  return { nodes, edges };
}

const EDGE_VISIBILITY_MAP: Record<
  string,
  keyof Pick<
    CanvasSettings,
    "showParentEdges" | "showPartnerEdges" | "showSiblingEdges" | "showFriendEdges"
  >
> = {
  [RelationshipType.BiologicalParent]: "showParentEdges",
  [RelationshipType.CoParent]: "showParentEdges",
  [RelationshipType.StepParent]: "showParentEdges",
  [RelationshipType.AdoptiveParent]: "showParentEdges",
  [RelationshipType.Partner]: "showPartnerEdges",
  [RelationshipType.BiologicalSibling]: "showSiblingEdges",
  [RelationshipType.StepSibling]: "showSiblingEdges",
  [RelationshipType.HalfSibling]: "showSiblingEdges",
  [RelationshipType.Friend]: "showFriendEdges",
};

export function filterEdgesByVisibility(
  edges: ReturnType<typeof buildRelationshipEdges>,
  settings?: Pick<
    CanvasSettings,
    "showParentEdges" | "showPartnerEdges" | "showSiblingEdges" | "showFriendEdges"
  >,
): ReturnType<typeof buildRelationshipEdges> {
  if (!settings) return edges;

  return edges.filter((edge) => {
    const rel = edge.data?.relationship;
    if (rel) {
      const settingKey = EDGE_VISIBILITY_MAP[rel.type];
      return settingKey ? settings[settingKey] !== false : true;
    }
    // Inferred sibling edges
    if (edge.data?.inferredType) {
      return settings.showSiblingEdges !== false;
    }
    return true;
  });
}
