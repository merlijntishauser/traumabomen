import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RelationshipType, TraumaCategory } from "../types/domain";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
} from "./useTreeData";
import { NODE_HEIGHT, NODE_WIDTH, useTreeLayout } from "./useTreeLayout";

vi.mock("@xyflow/react", () => ({
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

function makePerson(id: string, name: string): DecryptedPerson {
  return {
    id,
    name,
    birth_year: 1980,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    gender: "female",
    is_adopted: false,
    notes: null,
  };
}

function makeRel(
  id: string,
  type: RelationshipType,
  source: string,
  target: string,
): DecryptedRelationship {
  return {
    id,
    type,
    source_person_id: source,
    target_person_id: target,
    periods: [],
    active_period: null,
  };
}

const emptyEvents = new Map<string, DecryptedEvent>();
const emptyLifeEvents = new Map<string, DecryptedLifeEvent>();
const emptyClassifications = new Map<string, DecryptedClassification>();

describe("useTreeLayout", () => {
  it("returns empty arrays when no persons exist", () => {
    const { result } = renderHook(() =>
      useTreeLayout(
        new Map(),
        new Map(),
        emptyEvents,
        null,
        emptyLifeEvents,
        { edgeStyle: "curved", showMarkers: false },
        emptyClassifications,
      ),
    );
    expect(result.current.nodes).toEqual([]);
    expect(result.current.edges).toEqual([]);
  });

  it("creates nodes for persons", () => {
    const persons = new Map([
      ["p1", makePerson("p1", "Alice")],
      ["p2", makePerson("p2", "Bob")],
    ]);
    const { result } = renderHook(() =>
      useTreeLayout(
        persons,
        new Map(),
        emptyEvents,
        null,
        emptyLifeEvents,
        { edgeStyle: "curved", showMarkers: false },
        emptyClassifications,
      ),
    );
    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.nodes.map((n) => n.id).sort()).toEqual(["p1", "p2"]);
  });

  it("nodes have correct dimensions", () => {
    const persons = new Map([["p1", makePerson("p1", "Alice")]]);
    const { result } = renderHook(() =>
      useTreeLayout(
        persons,
        new Map(),
        emptyEvents,
        null,
        emptyLifeEvents,
        { edgeStyle: "curved", showMarkers: false },
        emptyClassifications,
      ),
    );
    expect(result.current.nodes[0].width).toBe(NODE_WIDTH);
    expect(result.current.nodes[0].height).toBe(NODE_HEIGHT);
  });

  it("creates edges for relationships", () => {
    const persons = new Map([
      ["p1", makePerson("p1", "Parent")],
      ["p2", makePerson("p2", "Child")],
    ]);
    const rels = new Map([["r1", makeRel("r1", RelationshipType.BiologicalParent, "p1", "p2")]]);
    const { result } = renderHook(() =>
      useTreeLayout(
        persons,
        rels,
        emptyEvents,
        null,
        emptyLifeEvents,
        { edgeStyle: "curved", showMarkers: false },
        emptyClassifications,
      ),
    );
    expect(result.current.edges.length).toBeGreaterThan(0);
  });

  it("marks selected person node", () => {
    const persons = new Map([["p1", makePerson("p1", "Alice")]]);
    const { result } = renderHook(() =>
      useTreeLayout(
        persons,
        new Map(),
        emptyEvents,
        "p1",
        emptyLifeEvents,
        { edgeStyle: "curved", showMarkers: false },
        emptyClassifications,
      ),
    );
    expect(result.current.nodes[0].selected).toBe(true);
  });

  it("attaches events to person node data", () => {
    const persons = new Map([["p1", makePerson("p1", "Alice")]]);
    const events = new Map([
      [
        "e1",
        {
          id: "e1",
          title: "Event",
          description: "",
          category: TraumaCategory.Loss,
          approximate_date: "1990",
          severity: 3,
          tags: [],
          person_ids: ["p1"],
        },
      ],
    ]);
    const { result } = renderHook(() =>
      useTreeLayout(
        persons,
        new Map(),
        events,
        null,
        emptyLifeEvents,
        { edgeStyle: "curved", showMarkers: false },
        emptyClassifications,
      ),
    );
    expect(result.current.nodes[0].data.events).toHaveLength(1);
  });

  it("handles partner relationships", () => {
    const persons = new Map([
      ["p1", makePerson("p1", "Alice")],
      ["p2", makePerson("p2", "Bob")],
    ]);
    const rels = new Map([["r1", makeRel("r1", RelationshipType.Partner, "p1", "p2")]]);
    const { result } = renderHook(() =>
      useTreeLayout(
        persons,
        rels,
        emptyEvents,
        null,
        emptyLifeEvents,
        { edgeStyle: "curved", showMarkers: false },
        emptyClassifications,
      ),
    );
    const partnerEdge = result.current.edges.find(
      (e) => e.data?.relationship?.type === RelationshipType.Partner,
    );
    expect(partnerEdge).toBeDefined();
  });

  it("identifies friend-only persons", () => {
    const persons = new Map([
      ["p1", makePerson("p1", "Alice")],
      ["p2", makePerson("p2", "Friend")],
    ]);
    const rels = new Map([["r1", makeRel("r1", RelationshipType.Friend, "p1", "p2")]]);
    const { result } = renderHook(() =>
      useTreeLayout(
        persons,
        rels,
        emptyEvents,
        null,
        emptyLifeEvents,
        { edgeStyle: "curved", showMarkers: false },
        emptyClassifications,
      ),
    );
    const friendNode = result.current.nodes.find((n) => n.id === "p2");
    expect(friendNode?.data.isFriendOnly).toBe(true);
  });

  it("exports NODE_WIDTH and NODE_HEIGHT constants", () => {
    expect(NODE_WIDTH).toBe(180);
    expect(NODE_HEIGHT).toBe(80);
  });
});
