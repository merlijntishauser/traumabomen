import { useMemo } from "react";
import * as dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";
import { RelationshipType } from "../types/domain";
import { inferSiblings } from "../lib/inferSiblings";
import type {
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedEvent,
  DecryptedLifeEvent,
} from "./useTreeData";
import type { EdgeStyle } from "./useCanvasSettings";

export interface PersonNodeData extends Record<string, unknown> {
  person: DecryptedPerson;
  events: DecryptedEvent[];
  lifeEvents: DecryptedLifeEvent[];
}

export type MarkerShape = "circle" | "square" | "diamond" | "triangle";
export const MARKER_SHAPES: MarkerShape[] = ["circle", "square", "diamond", "triangle"];

export interface RelationshipEdgeData extends Record<string, unknown> {
  relationship?: DecryptedRelationship;
  inferredType?: "full_sibling" | "half_sibling";
  coupleColor?: string;
  sourceName?: string;
  targetName?: string;
  sourceOffset?: { x: number; y: number };
  targetOffset?: { x: number; y: number };
  markerShape?: MarkerShape;
  edgeStyle?: EdgeStyle;
  junctionFork?: {
    parentIds: [string, string];
    childIds: string[];
    parentNames: [string, string];
    childNames: string[];
  };
  junctionHidden?: boolean;
}

export type PersonNodeType = Node<PersonNodeData, "person">;
export type RelationshipEdgeType = Edge<RelationshipEdgeData>;

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 80;

const PARENT_TYPES = new Set([
  RelationshipType.BiologicalParent,
  RelationshipType.StepParent,
  RelationshipType.AdoptiveParent,
]);

const SIBLING_TYPES = new Set([
  RelationshipType.BiologicalSibling,
  RelationshipType.StepSibling,
  RelationshipType.HalfSibling,
]);

// Handle IDs: source handles connect outward, target handles receive inward
const SOURCE_HANDLES = { top: "top-source", bottom: "bottom", left: "left-source", right: "right" };
const TARGET_HANDLES = { top: "top", bottom: "bottom-target", left: "left", right: "right-target" };

function pickHandles(
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number },
  preferVertical: boolean,
): { sourceHandle: string; targetHandle: string } {
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Bias: reduce the non-preferred axis by 30% so the preferred direction wins when close
  const biasedDx = preferVertical ? absDx * 0.7 : absDx;
  const biasedDy = preferVertical ? absDy : absDy * 0.7;

  if (biasedDy >= biasedDx) {
    if (dy >= 0) {
      return { sourceHandle: SOURCE_HANDLES.bottom, targetHandle: TARGET_HANDLES.top };
    }
    return { sourceHandle: SOURCE_HANDLES.top, targetHandle: TARGET_HANDLES.bottom };
  }
  if (dx >= 0) {
    return { sourceHandle: SOURCE_HANDLES.right, targetHandle: TARGET_HANDLES.left };
  }
  return { sourceHandle: SOURCE_HANDLES.left, targetHandle: TARGET_HANDLES.right };
}

const COUPLE_PALETTE = [
  "hsl(210, 60%, 55%)",
  "hsl(28, 70%, 52%)",
  "hsl(280, 45%, 55%)",
  "hsl(145, 55%, 42%)",
  "hsl(340, 60%, 55%)",
  "hsl(170, 55%, 42%)",
  "hsl(45, 65%, 48%)",
  "hsl(230, 50%, 58%)",
];

export function useTreeLayout(
  persons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
  events: Map<string, DecryptedEvent>,
  selectedPersonId: string | null,
  lifeEvents?: Map<string, DecryptedLifeEvent>,
  canvasSettings?: { edgeStyle: EdgeStyle; showMarkers: boolean },
): { nodes: PersonNodeType[]; edges: RelationshipEdgeType[] } {
  return useMemo(() => {
    if (persons.size === 0) {
      return { nodes: [], edges: [] };
    }

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 100 });
    g.setDefaultEdgeLabel(() => ({}));

    for (const person of persons.values()) {
      g.setNode(person.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }

    // ---- Detect biological parent couples for junction routing ----
    const bioParentsOf = new Map<string, Set<string>>();
    for (const rel of relationships.values()) {
      if (rel.type === RelationshipType.BiologicalParent) {
        const parents = bioParentsOf.get(rel.target_person_id) ?? new Set();
        parents.add(rel.source_person_id);
        bioParentsOf.set(rel.target_person_id, parents);
      }
    }

    // Group children by their biological parent pair
    const coupleChildren = new Map<string, string[]>();
    for (const [childId, parentIds] of bioParentsOf) {
      if (parentIds.size === 2) {
        const key = Array.from(parentIds).sort().join("|");
        const existing = coupleChildren.get(key) ?? [];
        existing.push(childId);
        coupleChildren.set(key, existing);
      }
    }

    // ---- Add all edges to dagre ----
    const partnerPairs: [string, string][] = [];

    for (const rel of relationships.values()) {
      if (PARENT_TYPES.has(rel.type)) {
        g.setEdge(rel.source_person_id, rel.target_person_id);
      } else if (SIBLING_TYPES.has(rel.type)) {
        g.setEdge(rel.source_person_id, rel.target_person_id, { minlen: 0 });
      } else if (rel.type === RelationshipType.Partner) {
        partnerPairs.push([rel.source_person_id, rel.target_person_id]);
      }
    }

    dagre.layout(g);

    // Post-process: place partners side-by-side at the same Y level
    for (const [aId, bId] of partnerPairs) {
      const a = g.node(aId);
      const b = g.node(bId);
      if (!a || !b) continue;
      const avgY = (a.y + b.y) / 2;
      a.y = avgY;
      b.y = avgY;
      if (Math.abs(a.x - b.x) < NODE_WIDTH + 20) {
        const mid = (a.x + b.x) / 2;
        a.x = mid - (NODE_WIDTH / 2 + 10);
        b.x = mid + (NODE_WIDTH / 2 + 10);
      }
    }

    // ---- Build event lookups ----
    const eventsByPerson = new Map<string, DecryptedEvent[]>();
    for (const event of events.values()) {
      for (const personId of event.person_ids) {
        const existing = eventsByPerson.get(personId) ?? [];
        existing.push(event);
        eventsByPerson.set(personId, existing);
      }
    }

    const lifeEventsByPerson = new Map<string, DecryptedLifeEvent[]>();
    if (lifeEvents) {
      for (const le of lifeEvents.values()) {
        for (const personId of le.person_ids) {
          const existing = lifeEventsByPerson.get(personId) ?? [];
          existing.push(le);
          lifeEventsByPerson.set(personId, existing);
        }
      }
    }

    // ---- Build React Flow nodes (person nodes only, no junction nodes) ----
    const nodes: PersonNodeType[] = [];

    for (const person of persons.values()) {
      const nodeWithPosition = g.node(person.id);
      const pinned = person.position;
      nodes.push({
        id: person.id,
        type: "person",
        position: pinned
          ? { x: pinned.x, y: pinned.y }
          : {
              x: nodeWithPosition.x - NODE_WIDTH / 2,
              y: nodeWithPosition.y - NODE_HEIGHT / 2,
            },
        data: {
          person,
          events: eventsByPerson.get(person.id) ?? [],
          lifeEvents: lifeEventsByPerson.get(person.id) ?? [],
        },
        selected: person.id === selectedPersonId,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });
    }

    // Build node center positions for handle selection
    const nodeCenter = new Map<string, { x: number; y: number }>();
    for (const node of nodes) {
      nodeCenter.set(node.id, {
        x: node.position.x + NODE_WIDTH / 2,
        y: node.position.y + NODE_HEIGHT / 2,
      });
    }

    // ---- Build junction fork assignments for biological parent couples ----
    const forkPrimaryIds = new Set<string>();
    const forkHiddenIds = new Set<string>();
    const forkDataByEdge = new Map<string, { parentIds: [string, string]; childIds: string[] }>();

    for (const [coupleKey, childIds] of coupleChildren) {
      const [parentAId, parentBId] = coupleKey.split("|");
      if (!nodeCenter.has(parentAId) || !nodeCenter.has(parentBId)) continue;
      if (childIds.every(id => !nodeCenter.has(id))) continue;

      const forkData = {
        parentIds: [parentAId, parentBId] as [string, string],
        childIds,
        parentNames: [
          persons.get(parentAId)?.name ?? "?",
          persons.get(parentBId)?.name ?? "?",
        ] as [string, string],
        childNames: childIds.map(id => persons.get(id)?.name ?? "?"),
      };
      let primaryId: string | null = null;

      for (const rel of relationships.values()) {
        if (rel.type !== RelationshipType.BiologicalParent) continue;
        if (rel.source_person_id !== parentAId && rel.source_person_id !== parentBId) continue;
        if (!childIds.includes(rel.target_person_id)) continue;

        if (primaryId === null) {
          primaryId = rel.id;
          forkPrimaryIds.add(rel.id);
          forkDataByEdge.set(rel.id, forkData);
        } else {
          forkHiddenIds.add(rel.id);
        }
      }
    }

    // ---- Compute couple colors ----
    const coupleKeyToColor = new Map<string, string>();
    const childCoupleColor = new Map<string, string>();
    let coupleIdx = 0;
    for (const [childId, parentIds] of bioParentsOf) {
      const key = Array.from(parentIds).sort().join("|");
      if (!coupleKeyToColor.has(key)) {
        coupleKeyToColor.set(key, COUPLE_PALETTE[coupleIdx % COUPLE_PALETTE.length]);
        coupleIdx++;
      }
      childCoupleColor.set(childId, coupleKeyToColor.get(key)!);
    }
    const useCoupleColors = coupleKeyToColor.size >= 2;

    // ---- Build React Flow edges ----
    const edges: RelationshipEdgeType[] = [];

    for (const rel of relationships.values()) {
      const preferVertical = PARENT_TYPES.has(rel.type);
      const srcPos = nodeCenter.get(rel.source_person_id);
      const tgtPos = nodeCenter.get(rel.target_person_id);
      const handles = srcPos && tgtPos
        ? pickHandles(srcPos, tgtPos, preferVertical)
        : { sourceHandle: preferVertical ? SOURCE_HANDLES.bottom : SOURCE_HANDLES.right,
            targetHandle: preferVertical ? TARGET_HANDLES.top : TARGET_HANDLES.left };
      const coupleColor = useCoupleColors && rel.type === RelationshipType.BiologicalParent
        ? childCoupleColor.get(rel.target_person_id)
        : undefined;

      edges.push({
        id: rel.id,
        type: "relationship",
        source: rel.source_person_id,
        target: rel.target_person_id,
        ...handles,
        data: {
          relationship: rel,
          coupleColor,
          sourceName: persons.get(rel.source_person_id)?.name,
          targetName: persons.get(rel.target_person_id)?.name,
          edgeStyle: canvasSettings?.edgeStyle,
          junctionFork: forkDataByEdge.get(rel.id),
          junctionHidden: forkHiddenIds.has(rel.id) || undefined,
        },
      });
    }

    // Inferred sibling edges
    const inferred = inferSiblings(relationships);
    for (const sib of inferred) {
      const srcPos = nodeCenter.get(sib.personAId);
      const tgtPos = nodeCenter.get(sib.personBId);
      const handles = srcPos && tgtPos
        ? pickHandles(srcPos, tgtPos, false)
        : { sourceHandle: SOURCE_HANDLES.right, targetHandle: TARGET_HANDLES.left };
      edges.push({
        id: `inferred-${sib.personAId}-${sib.personBId}`,
        type: "relationship",
        source: sib.personAId,
        target: sib.personBId,
        ...handles,
        data: {
          inferredType: sib.type,
          sourceName: persons.get(sib.personAId)?.name,
          targetName: persons.get(sib.personBId)?.name,
          edgeStyle: canvasSettings?.edgeStyle,
        },
      });
    }

    // ---- Spread overlapping edges ----
    const HANDLE_SPREAD = 14;
    function handleSide(handleId: string): string {
      if (handleId.startsWith("top")) return "top";
      if (handleId.startsWith("bottom")) return "bottom";
      if (handleId.startsWith("left")) return "left";
      return "right";
    }
    const sideGroups = new Map<string, { edgeIdx: number; end: "source" | "target" }[]>();
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      if (e.data?.junctionFork || e.data?.junctionHidden) continue; // fork edges have their own routing
      const srcKey = `${e.source}:${handleSide(e.sourceHandle!)}`;
      const tgtKey = `${e.target}:${handleSide(e.targetHandle!)}`;
      if (!sideGroups.has(srcKey)) sideGroups.set(srcKey, []);
      sideGroups.get(srcKey)!.push({ edgeIdx: i, end: "source" });
      if (!sideGroups.has(tgtKey)) sideGroups.set(tgtKey, []);
      sideGroups.get(tgtKey)!.push({ edgeIdx: i, end: "target" });
    }
    for (const [key, entries] of sideGroups) {
      if (entries.length <= 1) continue;
      const side = key.split(":")[1];
      const horizontal = side === "top" || side === "bottom";

      entries.sort((a, b) => {
        const eA = edges[a.edgeIdx];
        const eB = edges[b.edgeIdx];
        const otherA = nodeCenter.get(a.end === "source" ? eA.target : eA.source);
        const otherB = nodeCenter.get(b.end === "source" ? eB.target : eB.source);
        if (!otherA || !otherB) return 0;
        return horizontal ? otherA.x - otherB.x : otherA.y - otherB.y;
      });

      for (let j = 0; j < entries.length; j++) {
        const px = (j - (entries.length - 1) / 2) * HANDLE_SPREAD;
        const { edgeIdx, end } = entries[j];
        const data = edges[edgeIdx].data!;
        if (end === "source") {
          const prev = data.sourceOffset ?? { x: 0, y: 0 };
          data.sourceOffset = horizontal ? { x: prev.x + px, y: prev.y } : { x: prev.x, y: prev.y + px };
        } else {
          const prev = data.targetOffset ?? { x: 0, y: 0 };
          data.targetOffset = horizontal ? { x: prev.x + px, y: prev.y } : { x: prev.x, y: prev.y + px };
        }
      }
    }

    // ---- Assign marker shapes ----
    if (canvasSettings?.showMarkers !== false) {
      const edgeMarker = new Array<number | null>(edges.length).fill(null);
      for (const entries of sideGroups.values()) {
        if (entries.length <= 1) continue;
        for (const { edgeIdx } of entries) {
          if (edgeMarker[edgeIdx] !== null) continue;
          const usedInGroup = new Set<number>();
          for (const { edgeIdx: otherIdx } of entries) {
            if (edgeMarker[otherIdx] !== null) usedInGroup.add(edgeMarker[otherIdx]!);
          }
          let m = 0;
          while (usedInGroup.has(m)) m++;
          edgeMarker[edgeIdx] = m;
        }
      }
      for (let i = 0; i < edges.length; i++) {
        if (edgeMarker[i] !== null) {
          edges[i].data!.markerShape = MARKER_SHAPES[edgeMarker[i]! % MARKER_SHAPES.length];
        }
      }
    }

    return { nodes, edges };
  }, [persons, relationships, events, selectedPersonId, lifeEvents, canvasSettings]);
}
