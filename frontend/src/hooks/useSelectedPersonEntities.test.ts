import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSelectedPersonEntities } from "./useSelectedPersonEntities";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedRelationship,
  DecryptedTurningPoint,
} from "./useTreeData";

function makeRelationship(
  id: string,
  source: string,
  target: string,
  type = "biological_parent",
): DecryptedRelationship {
  return {
    id,
    source_person_id: source,
    target_person_id: target,
    type,
    periods: [],
    active_period: null,
  } as DecryptedRelationship;
}

function makeEvent(id: string, personIds: string[]): DecryptedEvent {
  return {
    id,
    person_ids: personIds,
    title: `Event ${id}`,
    description: "",
    category: "loss",
    approximate_date: "2020",
    severity: 3,
    tags: [],
  } as DecryptedEvent;
}

function makeLifeEvent(id: string, personIds: string[]): DecryptedLifeEvent {
  return {
    id,
    person_ids: personIds,
    title: `LifeEvent ${id}`,
    description: "",
    category: "family",
    approximate_date: "2020",
    impact: 3,
    tags: [],
  } as DecryptedLifeEvent;
}

function makeTurningPoint(id: string, personIds: string[]): DecryptedTurningPoint {
  return {
    id,
    person_ids: personIds,
    title: `TP ${id}`,
    description: "",
    approximate_date: "2020",
  } as DecryptedTurningPoint;
}

function makeClassification(id: string, personIds: string[]): DecryptedClassification {
  return {
    id,
    person_ids: personIds,
    dsm_category: "depressive",
    dsm_subcategory: null,
    status: "diagnosed",
    diagnosis_year: null,
    periods: [],
    notes: null,
  } as DecryptedClassification;
}

describe("useSelectedPersonEntities", () => {
  const relationships = new Map([
    ["r1", makeRelationship("r1", "p1", "p2")],
    ["r2", makeRelationship("r2", "p1", "p3")],
    ["r3", makeRelationship("r3", "p4", "p5")],
  ]);
  const events = new Map([
    ["e1", makeEvent("e1", ["p1"])],
    ["e2", makeEvent("e2", ["p2", "p3"])],
  ]);
  const lifeEvents = new Map([["le1", makeLifeEvent("le1", ["p1", "p2"])]]);
  const turningPoints = new Map([
    ["tp1", makeTurningPoint("tp1", ["p1"])],
    ["tp2", makeTurningPoint("tp2", ["p3"])],
  ]);
  const classifications = new Map([
    ["c1", makeClassification("c1", ["p2"])],
    ["c2", makeClassification("c2", ["p1", "p2"])],
  ]);

  it("returns empty arrays when selectedPersonId is null", () => {
    const { result } = renderHook(() =>
      useSelectedPersonEntities(
        null,
        relationships,
        events,
        lifeEvents,
        turningPoints,
        classifications,
      ),
    );
    expect(result.current.selectedRelationships).toEqual([]);
    expect(result.current.selectedEvents).toEqual([]);
    expect(result.current.selectedLifeEvents).toEqual([]);
    expect(result.current.selectedTurningPoints).toEqual([]);
    expect(result.current.selectedClassifications).toEqual([]);
    expect(result.current.selectedInferredSiblings).toEqual([]);
  });

  it("filters relationships for the selected person", () => {
    const { result } = renderHook(() =>
      useSelectedPersonEntities(
        "p1",
        relationships,
        events,
        lifeEvents,
        turningPoints,
        classifications,
      ),
    );
    expect(result.current.selectedRelationships).toHaveLength(2);
    expect(result.current.selectedRelationships.map((r) => r.id).sort()).toEqual(["r1", "r2"]);
  });

  it("filters events for the selected person", () => {
    const { result } = renderHook(() =>
      useSelectedPersonEntities(
        "p1",
        relationships,
        events,
        lifeEvents,
        turningPoints,
        classifications,
      ),
    );
    expect(result.current.selectedEvents).toHaveLength(1);
    expect(result.current.selectedEvents[0].id).toBe("e1");
  });

  it("filters life events for the selected person", () => {
    const { result } = renderHook(() =>
      useSelectedPersonEntities(
        "p2",
        relationships,
        events,
        lifeEvents,
        turningPoints,
        classifications,
      ),
    );
    expect(result.current.selectedLifeEvents).toHaveLength(1);
    expect(result.current.selectedLifeEvents[0].id).toBe("le1");
  });

  it("filters turning points for the selected person", () => {
    const { result } = renderHook(() =>
      useSelectedPersonEntities(
        "p1",
        relationships,
        events,
        lifeEvents,
        turningPoints,
        classifications,
      ),
    );
    expect(result.current.selectedTurningPoints).toHaveLength(1);
    expect(result.current.selectedTurningPoints[0].id).toBe("tp1");
  });

  it("filters classifications for the selected person", () => {
    const { result } = renderHook(() =>
      useSelectedPersonEntities(
        "p1",
        relationships,
        events,
        lifeEvents,
        turningPoints,
        classifications,
      ),
    );
    expect(result.current.selectedClassifications).toHaveLength(1);
    expect(result.current.selectedClassifications[0].id).toBe("c2");
  });

  it("computes inferred siblings from relationships", () => {
    // p2 and p3 share parent p1 via biological_parent
    const { result } = renderHook(() =>
      useSelectedPersonEntities(
        "p2",
        relationships,
        events,
        lifeEvents,
        turningPoints,
        classifications,
      ),
    );
    expect(result.current.inferredSiblings.length).toBeGreaterThan(0);
    expect(result.current.selectedInferredSiblings.length).toBeGreaterThan(0);
  });

  it("returns stable references on re-render with same inputs", () => {
    const { result, rerender } = renderHook(() =>
      useSelectedPersonEntities(
        "p1",
        relationships,
        events,
        lifeEvents,
        turningPoints,
        classifications,
      ),
    );
    const first = result.current;
    rerender();
    expect(result.current.selectedRelationships).toBe(first.selectedRelationships);
    expect(result.current.selectedEvents).toBe(first.selectedEvents);
    expect(result.current.inferredSiblings).toBe(first.inferredSiblings);
  });
});
