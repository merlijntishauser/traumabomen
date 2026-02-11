import { useMemo } from "react";
import dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";
import { RelationshipType } from "../types/domain";
import type {
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedEvent,
} from "./useTreeData";

export interface PersonNodeData extends Record<string, unknown> {
  person: DecryptedPerson;
  events: DecryptedEvent[];
}

export interface RelationshipEdgeData extends Record<string, unknown> {
  relationship: DecryptedRelationship;
}

export type PersonNodeType = Node<PersonNodeData, "person">;
export type RelationshipEdgeType = Edge<RelationshipEdgeData>;

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;

const PARENT_TYPES = new Set([
  RelationshipType.BiologicalParent,
  RelationshipType.StepParent,
  RelationshipType.AdoptiveParent,
]);

const SIBLING_TYPES = new Set([
  RelationshipType.BiologicalSibling,
  RelationshipType.StepSibling,
]);

export function useTreeLayout(
  persons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
  events: Map<string, DecryptedEvent>,
  selectedPersonId: string | null,
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

    for (const rel of relationships.values()) {
      if (PARENT_TYPES.has(rel.type)) {
        g.setEdge(rel.source_person_id, rel.target_person_id);
      } else if (SIBLING_TYPES.has(rel.type)) {
        g.setEdge(rel.source_person_id, rel.target_person_id, { minlen: 0 });
      } else if (rel.type === RelationshipType.Partner) {
        g.setEdge(rel.source_person_id, rel.target_person_id, {
          minlen: 0,
          weight: 2,
        });
      }
    }

    dagre.layout(g);

    const eventsByPerson = new Map<string, DecryptedEvent[]>();
    for (const event of events.values()) {
      for (const personId of event.person_ids) {
        const existing = eventsByPerson.get(personId) ?? [];
        existing.push(event);
        eventsByPerson.set(personId, existing);
      }
    }

    const nodes: PersonNodeType[] = [];
    for (const person of persons.values()) {
      const nodeWithPosition = g.node(person.id);
      nodes.push({
        id: person.id,
        type: "person",
        position: {
          x: nodeWithPosition.x - NODE_WIDTH / 2,
          y: nodeWithPosition.y - NODE_HEIGHT / 2,
        },
        data: {
          person,
          events: eventsByPerson.get(person.id) ?? [],
        },
        selected: person.id === selectedPersonId,
      });
    }

    const edges: RelationshipEdgeType[] = [];
    for (const rel of relationships.values()) {
      const isPartner = rel.type === RelationshipType.Partner;
      edges.push({
        id: rel.id,
        type: "relationship",
        source: rel.source_person_id,
        target: rel.target_person_id,
        sourceHandle: isPartner ? "right" : "bottom",
        targetHandle: isPartner ? "left" : "top",
        data: { relationship: rel },
      });
    }

    return { nodes, edges };
  }, [persons, relationships, events, selectedPersonId]);
}
