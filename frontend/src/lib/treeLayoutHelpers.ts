import type { Edge, Node } from "@xyflow/react";
import * as dagre from "dagre";
import type { EdgeStyle } from "../hooks/useCanvasSettings";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedTurningPoint,
} from "../hooks/useTreeData";
import { RelationshipType } from "../types/domain";
import type { InferredSibling } from "./inferSiblings";

// ---- Exported types (re-exported from useTreeLayout.ts) ----

export interface PersonNodeData extends Record<string, unknown> {
  person: DecryptedPerson;
  events: DecryptedEvent[];
  lifeEvents: DecryptedLifeEvent[];
  classifications: DecryptedClassification[];
  turningPoints: DecryptedTurningPoint[];
  isFriendOnly?: boolean;
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

// ---- Constants ----

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 80;

export const PARENT_TYPES = new Set([
  RelationshipType.BiologicalParent,
  RelationshipType.CoParent,
  RelationshipType.StepParent,
  RelationshipType.AdoptiveParent,
]);

export const SIBLING_TYPES = new Set([
  RelationshipType.BiologicalSibling,
  RelationshipType.StepSibling,
  RelationshipType.HalfSibling,
]);

const SOURCE_HANDLES = { top: "top-source", bottom: "bottom", left: "left-source", right: "right" };
const TARGET_HANDLES = { top: "top", bottom: "bottom-target", left: "left", right: "right-target" };

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

const HANDLE_SPREAD = 14;

const FRIEND_X_OFFSET = 200;
const FRIEND_Y_GAP = 20;

// ---- Helper return types ----

export interface BioParentData {
  bioParentsOf: Map<string, Set<string>>;
  coupleChildren: Map<string, string[]>;
}

export interface DagreResult {
  graph: dagre.graphlib.Graph;
  partnerPairs: [string, string][];
}

export interface EntityLookups {
  eventsByPerson: Map<string, DecryptedEvent[]>;
  lifeEventsByPerson: Map<string, DecryptedLifeEvent[]>;
  turningPointsByPerson: Map<string, DecryptedTurningPoint[]>;
  classificationsByPerson: Map<string, DecryptedClassification[]>;
}

export interface PersonNodesResult {
  nodes: PersonNodeType[];
  nodeCenter: Map<string, { x: number; y: number }>;
}

type ForkData = {
  parentIds: [string, string];
  childIds: string[];
  parentNames: [string, string];
  childNames: string[];
};

export interface JunctionForkResult {
  forkPrimaryIds: Set<string>;
  forkHiddenIds: Set<string>;
  forkDataByEdge: Map<string, ForkData>;
}

export interface CoupleColorResult {
  childCoupleColor: Map<string, string>;
  useCoupleColors: boolean;
}

export interface BuildEdgesParams {
  relationships: Map<string, DecryptedRelationship>;
  persons: Map<string, DecryptedPerson>;
  nodeCenter: Map<string, { x: number; y: number }>;
  childCoupleColor: Map<string, string>;
  useCoupleColors: boolean;
  forkDataByEdge: Map<string, ForkData>;
  forkHiddenIds: Set<string>;
  inferred: InferredSibling[];
  edgeStyle?: EdgeStyle;
}

type SideGroupEntry = { edgeIdx: number; end: "source" | "target" };

// ---- Pure helper functions ----

export function pickHandles(
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number },
  preferVertical: boolean,
): { sourceHandle: string; targetHandle: string } {
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

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

function defaultHandles(preferVertical: boolean): { sourceHandle: string; targetHandle: string } {
  return preferVertical
    ? { sourceHandle: SOURCE_HANDLES.bottom, targetHandle: TARGET_HANDLES.top }
    : { sourceHandle: SOURCE_HANDLES.right, targetHandle: TARGET_HANDLES.left };
}

/** Identify persons connected only via friend edges (no family/partner edges). */
export function findFriendOnlyIds(
  persons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
): Set<string> {
  const familyConnected = new Set<string>();
  for (const rel of relationships.values()) {
    if (rel.type !== RelationshipType.Friend) {
      familyConnected.add(rel.source_person_id);
      familyConnected.add(rel.target_person_id);
    }
  }

  const friendOnlyIds = new Set<string>();
  for (const id of persons.keys()) {
    if (!familyConnected.has(id)) {
      const hasFriendEdge = [...relationships.values()].some(
        (r) =>
          r.type === RelationshipType.Friend &&
          (r.source_person_id === id || r.target_person_id === id),
      );
      if (hasFriendEdge) friendOnlyIds.add(id);
    }
  }
  return friendOnlyIds;
}

/** Detect biological parent couples and group children by parent pair. */
export function buildBioParentData(
  relationships: Map<string, DecryptedRelationship>,
): BioParentData {
  const bioParentsOf = new Map<string, Set<string>>();
  for (const rel of relationships.values()) {
    if (rel.type === RelationshipType.BiologicalParent) {
      const parents = bioParentsOf.get(rel.target_person_id) ?? new Set();
      parents.add(rel.source_person_id);
      bioParentsOf.set(rel.target_person_id, parents);
    }
  }

  const coupleChildren = new Map<string, string[]>();
  for (const [childId, parentIds] of bioParentsOf) {
    if (parentIds.size === 2) {
      const key = Array.from(parentIds).sort().join("|");
      const existing = coupleChildren.get(key) ?? [];
      existing.push(childId);
      coupleChildren.set(key, existing);
    }
  }

  return { bioParentsOf, coupleChildren };
}

/** Build dagre graph, add nodes and edges, run layout, then align partners. */
export function layoutDagreGraph(
  persons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
  friendOnlyIds: Set<string>,
  inferredSiblings?: InferredSibling[],
): DagreResult {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 100 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const person of persons.values()) {
    if (!friendOnlyIds.has(person.id)) {
      g.setNode(person.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }
  }

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

  // Add inferred siblings so they share the same rank
  if (inferredSiblings) {
    for (const sib of inferredSiblings) {
      if (g.hasNode(sib.personAId) && g.hasNode(sib.personBId)) {
        g.setEdge(sib.personAId, sib.personBId, { minlen: 0 });
      }
    }
  }

  dagre.layout(g);

  for (const [aId, bId] of partnerPairs) {
    alignPartnerPair(g, aId, bId);
  }

  resolveOverlaps(g);

  return { graph: g, partnerPairs };
}

function alignPartnerPair(g: dagre.graphlib.Graph, aId: string, bId: string): void {
  const a = g.node(aId);
  const b = g.node(bId);
  if (!a || !b) return;
  const avgY = (a.y + b.y) / 2;
  a.y = avgY;
  b.y = avgY;
  if (Math.abs(a.x - b.x) < NODE_WIDTH + 20) {
    const mid = (a.x + b.x) / 2;
    a.x = mid - (NODE_WIDTH / 2 + 10);
    b.x = mid + (NODE_WIDTH / 2 + 10);
  }
}

/**
 * After partner alignment, some nodes may overlap. Group nodes by approximate
 * Y (same rank), sort by X, and push apart any that are too close.
 */
function resolveOverlaps(g: dagre.graphlib.Graph): void {
  const nodeIds = g.nodes();
  if (nodeIds.length === 0) return;

  const yTolerance = NODE_HEIGHT / 2;
  const minXGap = NODE_WIDTH + 20;

  // Group nodes by approximate Y rank
  const ranks: Map<number, string[]> = new Map();
  for (const id of nodeIds) {
    const node = g.node(id);
    if (!node) continue;
    let assigned = false;
    for (const [rankY, members] of ranks) {
      if (Math.abs(node.y - rankY) <= yTolerance) {
        members.push(id);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      ranks.set(node.y, [id]);
    }
  }

  // Within each rank, sort by X and push apart overlapping nodes
  for (const members of ranks.values()) {
    if (members.length < 2) continue;
    members.sort((a, b) => (g.node(a)?.x ?? 0) - (g.node(b)?.x ?? 0));
    for (let i = 1; i < members.length; i++) {
      const prev = g.node(members[i - 1]);
      const curr = g.node(members[i]);
      if (!prev || !curr) continue;
      const gap = curr.x - prev.x;
      if (gap < minXGap) {
        curr.x = prev.x + minXGap;
      }
    }
  }
}

/** Find the rightmost X coordinate of family (non-friend) nodes. */
export function findMaxFamilyX(
  persons: Map<string, DecryptedPerson>,
  friendOnlyIds: Set<string>,
  graph: dagre.graphlib.Graph,
): number {
  let maxX = 0;
  for (const person of persons.values()) {
    if (!friendOnlyIds.has(person.id)) {
      const n = graph.node(person.id);
      if (n) maxX = Math.max(maxX, n.x + NODE_WIDTH / 2);
    }
  }
  return maxX;
}

/** Compute ideal Y for a friend node based on connected family member positions. */
export function computeFriendY(
  friendId: string,
  relationships: Map<string, DecryptedRelationship>,
  graph: dagre.graphlib.Graph,
  usedYPositions: number[],
): number {
  const connectedYs: number[] = [];
  for (const rel of relationships.values()) {
    if (rel.type !== RelationshipType.Friend) continue;
    if (rel.source_person_id !== friendId && rel.target_person_id !== friendId) continue;
    const otherId = rel.source_person_id === friendId ? rel.target_person_id : rel.source_person_id;
    const otherNode = graph.node(otherId);
    if (otherNode) connectedYs.push(otherNode.y);
  }

  let targetY =
    connectedYs.length > 0 ? connectedYs.reduce((a, b) => a + b, 0) / connectedYs.length : 0;

  for (const usedY of usedYPositions) {
    if (Math.abs(targetY - usedY) < NODE_HEIGHT + FRIEND_Y_GAP) {
      targetY = usedY + NODE_HEIGHT + FRIEND_Y_GAP;
    }
  }
  return targetY;
}

/** Position friend-only persons to the right of the family tree. */
export function positionFriendNodes(
  persons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
  friendOnlyIds: Set<string>,
  graph: dagre.graphlib.Graph,
): Map<string, { x: number; y: number }> {
  const friendPositions = new Map<string, { x: number; y: number }>();
  if (friendOnlyIds.size === 0) return friendPositions;

  const maxFamilyX = findMaxFamilyX(persons, friendOnlyIds, graph);
  const usedYPositions: number[] = [];

  for (const friendId of friendOnlyIds) {
    const targetY = computeFriendY(friendId, relationships, graph, usedYPositions);
    usedYPositions.push(targetY);
    friendPositions.set(friendId, {
      x: maxFamilyX + FRIEND_X_OFFSET,
      y: targetY,
    });
  }

  return friendPositions;
}

/** Build per-person lookups for events, life events, turning points, and classifications. */
export function buildEntityLookups(
  events: Map<string, DecryptedEvent>,
  lifeEvents?: Map<string, DecryptedLifeEvent>,
  classifications?: Map<string, DecryptedClassification>,
  turningPoints?: Map<string, DecryptedTurningPoint>,
): EntityLookups {
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

  const turningPointsByPerson = new Map<string, DecryptedTurningPoint[]>();
  if (turningPoints) {
    for (const tp of turningPoints.values()) {
      for (const personId of tp.person_ids) {
        const existing = turningPointsByPerson.get(personId) ?? [];
        existing.push(tp);
        turningPointsByPerson.set(personId, existing);
      }
    }
  }

  const classificationsByPerson = new Map<string, DecryptedClassification[]>();
  if (classifications) {
    for (const cls of classifications.values()) {
      for (const personId of cls.person_ids) {
        const existing = classificationsByPerson.get(personId) ?? [];
        existing.push(cls);
        classificationsByPerson.set(personId, existing);
      }
    }
  }

  return { eventsByPerson, lifeEventsByPerson, turningPointsByPerson, classificationsByPerson };
}

/** Resolve the position of a single person node. */
export function resolveNodePosition(
  person: DecryptedPerson,
  graph: dagre.graphlib.Graph,
  isFriendOnly: boolean,
  friendPos: { x: number; y: number } | undefined,
): { x: number; y: number } {
  if (person.position) {
    return { x: person.position.x, y: person.position.y };
  }
  if (friendPos) {
    return { x: friendPos.x - NODE_WIDTH / 2, y: friendPos.y - NODE_HEIGHT / 2 };
  }
  if (!isFriendOnly) {
    const nodeWithPosition = graph.node(person.id);
    if (nodeWithPosition) {
      return {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      };
    }
  }
  return { x: 0, y: 0 };
}

/** Build React Flow person nodes with positions and entity data. */
export function buildPersonNodes(
  persons: Map<string, DecryptedPerson>,
  graph: dagre.graphlib.Graph,
  friendOnlyIds: Set<string>,
  friendPositions: Map<string, { x: number; y: number }>,
  lookups: EntityLookups,
  selectedPersonId: string | null,
): PersonNodesResult {
  const nodes: PersonNodeType[] = [];

  for (const person of persons.values()) {
    const isFriendOnly = friendOnlyIds.has(person.id);
    const position = resolveNodePosition(
      person,
      graph,
      isFriendOnly,
      friendPositions.get(person.id),
    );

    nodes.push({
      id: person.id,
      type: "person",
      position,
      data: {
        person,
        events: lookups.eventsByPerson.get(person.id) ?? [],
        lifeEvents: lookups.lifeEventsByPerson.get(person.id) ?? [],
        classifications: lookups.classificationsByPerson.get(person.id) ?? [],
        turningPoints: lookups.turningPointsByPerson.get(person.id) ?? [],
        isFriendOnly: isFriendOnly || undefined,
      },
      selected: person.id === selectedPersonId,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  }

  const nodeCenter = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    nodeCenter.set(node.id, {
      x: node.position.x + NODE_WIDTH / 2,
      y: node.position.y + NODE_HEIGHT / 2,
    });
  }

  return { nodes, nodeCenter };
}

/** Classify fork edges for a single couple into primary/hidden. */
function classifyCoupleForkEdges(
  relationships: Map<string, DecryptedRelationship>,
  parentAId: string,
  parentBId: string,
  childIds: string[],
  forkData: ForkData,
  result: JunctionForkResult,
): void {
  let primaryId: string | null = null;
  for (const rel of relationships.values()) {
    if (rel.type !== RelationshipType.BiologicalParent) continue;
    if (rel.source_person_id !== parentAId && rel.source_person_id !== parentBId) continue;
    if (!childIds.includes(rel.target_person_id)) continue;

    if (primaryId === null) {
      primaryId = rel.id;
      result.forkPrimaryIds.add(rel.id);
      result.forkDataByEdge.set(rel.id, forkData);
    } else {
      result.forkHiddenIds.add(rel.id);
    }
  }
}

/** Build junction fork assignments for biological parent couples. */
export function buildJunctionForks(
  coupleChildren: Map<string, string[]>,
  nodeCenter: Map<string, { x: number; y: number }>,
  relationships: Map<string, DecryptedRelationship>,
  persons: Map<string, DecryptedPerson>,
): JunctionForkResult {
  const result: JunctionForkResult = {
    forkPrimaryIds: new Set(),
    forkHiddenIds: new Set(),
    forkDataByEdge: new Map(),
  };

  for (const [coupleKey, childIds] of coupleChildren) {
    const [parentAId, parentBId] = coupleKey.split("|");
    if (!nodeCenter.has(parentAId) || !nodeCenter.has(parentBId)) continue;
    if (childIds.every((id) => !nodeCenter.has(id))) continue;

    const forkData: ForkData = {
      parentIds: [parentAId, parentBId],
      childIds,
      parentNames: [persons.get(parentAId)?.name ?? "?", persons.get(parentBId)?.name ?? "?"],
      childNames: childIds.map((id) => persons.get(id)?.name ?? "?"),
    };

    classifyCoupleForkEdges(relationships, parentAId, parentBId, childIds, forkData, result);
  }

  return result;
}

/** Compute couple colors for biological parent pairs. */
export function computeCoupleColors(bioParentsOf: Map<string, Set<string>>): CoupleColorResult {
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
  return { childCoupleColor, useCoupleColors };
}

/** Resolve handles for a relationship edge given node positions. */
function resolveEdgeHandles(
  srcPos: { x: number; y: number } | undefined,
  tgtPos: { x: number; y: number } | undefined,
  preferVertical: boolean,
): { sourceHandle: string; targetHandle: string } {
  if (srcPos && tgtPos) {
    return pickHandles(srcPos, tgtPos, preferVertical);
  }
  return defaultHandles(preferVertical);
}

/** Build React Flow edges for relationships and inferred siblings. */
export function buildRelationshipEdges(params: BuildEdgesParams): RelationshipEdgeType[] {
  const {
    relationships,
    persons,
    nodeCenter,
    childCoupleColor,
    useCoupleColors,
    forkDataByEdge,
    forkHiddenIds,
    inferred,
    edgeStyle,
  } = params;

  const edges: RelationshipEdgeType[] = [];

  for (const rel of relationships.values()) {
    const preferVertical = PARENT_TYPES.has(rel.type);
    const handles = resolveEdgeHandles(
      nodeCenter.get(rel.source_person_id),
      nodeCenter.get(rel.target_person_id),
      preferVertical,
    );
    const coupleColor =
      useCoupleColors && rel.type === RelationshipType.BiologicalParent
        ? childCoupleColor.get(rel.target_person_id)
        : undefined;

    edges.push({
      id: rel.id,
      type: "relationship",
      source: rel.source_person_id,
      target: rel.target_person_id,
      className: `edge-${edgeStyle ?? "curved"}`,
      ...handles,
      data: {
        relationship: rel,
        coupleColor,
        sourceName: persons.get(rel.source_person_id)?.name,
        targetName: persons.get(rel.target_person_id)?.name,
        edgeStyle,
        junctionFork: forkDataByEdge.get(rel.id),
        junctionHidden: forkHiddenIds.has(rel.id) || undefined,
      },
    });
  }

  for (const sib of inferred) {
    const handles = resolveEdgeHandles(
      nodeCenter.get(sib.personAId),
      nodeCenter.get(sib.personBId),
      false,
    );
    edges.push({
      id: `inferred-${sib.personAId}-${sib.personBId}`,
      type: "relationship",
      source: sib.personAId,
      target: sib.personBId,
      className: `edge-${edgeStyle ?? "curved"}`,
      ...handles,
      data: {
        inferredType: sib.type,
        sourceName: persons.get(sib.personAId)?.name,
        targetName: persons.get(sib.personBId)?.name,
        edgeStyle,
      },
    });
  }

  return edges;
}

/** Determine the side (top/bottom/left/right) from a handle ID. */
export function handleSide(handleId: string): string {
  if (handleId.startsWith("top")) return "top";
  if (handleId.startsWith("bottom")) return "bottom";
  if (handleId.startsWith("left")) return "left";
  return "right";
}

/** Group edges by shared node+side into a map for overlap detection. */
export function groupEdgesBySide(edges: RelationshipEdgeType[]): Map<string, SideGroupEntry[]> {
  const sideGroups = new Map<string, SideGroupEntry[]>();
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    if (e.data?.junctionFork || e.data?.junctionHidden) continue;
    const srcKey = `${e.source}:${handleSide(e.sourceHandle!)}`;
    const tgtKey = `${e.target}:${handleSide(e.targetHandle!)}`;
    if (!sideGroups.has(srcKey)) sideGroups.set(srcKey, []);
    sideGroups.get(srcKey)!.push({ edgeIdx: i, end: "source" });
    if (!sideGroups.has(tgtKey)) sideGroups.set(tgtKey, []);
    sideGroups.get(tgtKey)!.push({ edgeIdx: i, end: "target" });
  }
  return sideGroups;
}

/** Spread overlapping edge offsets for a single side group. */
function spreadSideGroup(
  entries: SideGroupEntry[],
  horizontal: boolean,
  edges: RelationshipEdgeType[],
  nodeCenter: Map<string, { x: number; y: number }>,
): void {
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
      data.sourceOffset = horizontal
        ? { x: prev.x + px, y: prev.y }
        : { x: prev.x, y: prev.y + px };
    } else {
      const prev = data.targetOffset ?? { x: 0, y: 0 };
      data.targetOffset = horizontal
        ? { x: prev.x + px, y: prev.y }
        : { x: prev.x, y: prev.y + px };
    }
  }
}

/** Find the lowest marker index not already used by sibling edges in the group. */
function findAvailableMarker(entries: SideGroupEntry[], edgeMarker: (number | null)[]): number {
  const usedInGroup = new Set<number>();
  for (const { edgeIdx: otherIdx } of entries) {
    if (edgeMarker[otherIdx] !== null) usedInGroup.add(edgeMarker[otherIdx]!);
  }
  let m = 0;
  while (usedInGroup.has(m)) m++;
  return m;
}

/** Assign unique marker shapes to edges within overlapping groups. */
export function assignMarkerShapes(
  edges: RelationshipEdgeType[],
  sideGroups: Map<string, SideGroupEntry[]>,
): void {
  const edgeMarker = new Array<number | null>(edges.length).fill(null);
  for (const entries of sideGroups.values()) {
    if (entries.length <= 1) continue;
    for (const { edgeIdx } of entries) {
      if (edgeMarker[edgeIdx] !== null) continue;
      edgeMarker[edgeIdx] = findAvailableMarker(entries, edgeMarker);
    }
  }
  for (let i = 0; i < edges.length; i++) {
    if (edgeMarker[i] !== null) {
      edges[i].data!.markerShape = MARKER_SHAPES[edgeMarker[i]! % MARKER_SHAPES.length];
    }
  }
}

/** Spread overlapping edges and optionally assign marker shapes. */
export function adjustEdgeOverlaps(
  edges: RelationshipEdgeType[],
  nodeCenter: Map<string, { x: number; y: number }>,
  showMarkers: boolean,
): void {
  const sideGroups = groupEdgesBySide(edges);

  for (const [key, entries] of sideGroups) {
    if (entries.length <= 1) continue;
    const side = key.split(":")[1];
    const horizontal = side === "top" || side === "bottom";
    spreadSideGroup(entries, horizontal, edges, nodeCenter);
  }

  if (showMarkers) {
    assignMarkerShapes(edges, sideGroups);
  }
}
