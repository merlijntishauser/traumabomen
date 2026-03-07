import { useMemo } from "react";
import type { InferredSibling } from "../lib/inferSiblings";
import { inferSiblings } from "../lib/inferSiblings";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedRelationship,
  DecryptedTurningPoint,
} from "./useTreeData";
import { filterByPerson } from "./useTreeData";

export interface SelectedPersonEntities {
  selectedRelationships: DecryptedRelationship[];
  selectedEvents: DecryptedEvent[];
  selectedLifeEvents: DecryptedLifeEvent[];
  selectedTurningPoints: DecryptedTurningPoint[];
  selectedClassifications: DecryptedClassification[];
  inferredSiblings: InferredSibling[];
  selectedInferredSiblings: InferredSibling[];
}

export function useSelectedPersonEntities(
  selectedPersonId: string | null,
  relationships: Map<string, DecryptedRelationship>,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  turningPoints: Map<string, DecryptedTurningPoint>,
  classifications: Map<string, DecryptedClassification>,
): SelectedPersonEntities {
  const selectedRelationships = useMemo(
    () =>
      selectedPersonId
        ? Array.from(relationships.values()).filter(
            (r) =>
              r.source_person_id === selectedPersonId || r.target_person_id === selectedPersonId,
          )
        : [],
    [selectedPersonId, relationships],
  );

  const selectedEvents = useMemo(
    () => filterByPerson(events, selectedPersonId),
    [selectedPersonId, events],
  );
  const selectedLifeEvents = useMemo(
    () => filterByPerson(lifeEvents, selectedPersonId),
    [selectedPersonId, lifeEvents],
  );
  const selectedTurningPoints = useMemo(
    () => filterByPerson(turningPoints, selectedPersonId),
    [selectedPersonId, turningPoints],
  );
  const selectedClassifications = useMemo(
    () => filterByPerson(classifications, selectedPersonId),
    [selectedPersonId, classifications],
  );

  const allInferredSiblings = useMemo(() => inferSiblings(relationships), [relationships]);

  const selectedInferredSiblings = useMemo(
    () =>
      selectedPersonId
        ? allInferredSiblings.filter(
            (s) => s.personAId === selectedPersonId || s.personBId === selectedPersonId,
          )
        : [],
    [selectedPersonId, allInferredSiblings],
  );

  return {
    selectedRelationships,
    selectedEvents,
    selectedLifeEvents,
    selectedTurningPoints,
    selectedClassifications,
    inferredSiblings: allInferredSiblings,
    selectedInferredSiblings,
  };
}
