import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
} from "../../hooks/useTreeData";
import { RelationshipType } from "../../types/domain";

// ---- Constants ----

export const LABEL_WIDTH = 180;
export const ROW_HEIGHT = 36;
export const BAR_HEIGHT = 12;
export const GEN_HEADER_HEIGHT = 20;
export const MARKER_RADIUS = 7;

// ---- Types ----

export interface PersonRow {
  person: DecryptedPerson;
  generation: number;
  y: number;
}

export interface TooltipLine {
  text: string;
  bold?: boolean;
}

export interface RowLayout {
  rows: PersonRow[];
  sortedGens: number[];
  personsByGen: Map<number, DecryptedPerson[]>;
  totalHeight: number;
}

export interface PersonDataMaps {
  eventsByPerson: Map<string, DecryptedEvent[]>;
  lifeEventsByPerson: Map<string, DecryptedLifeEvent[]>;
  classificationsByPerson: Map<string, DecryptedClassification[]>;
}

// ---- Generation computation ----

export function buildChildToParentsMap(
  relationships: Map<string, DecryptedRelationship>,
): Map<string, string[]> {
  const childToParents = new Map<string, string[]>();
  for (const rel of relationships.values()) {
    if (
      rel.type === RelationshipType.BiologicalParent ||
      rel.type === RelationshipType.StepParent ||
      rel.type === RelationshipType.AdoptiveParent
    ) {
      const parents = childToParents.get(rel.target_person_id) ?? [];
      parents.push(rel.source_person_id);
      childToParents.set(rel.target_person_id, parents);
    }
  }
  return childToParents;
}

export function assignBaseGenerations(
  persons: Map<string, DecryptedPerson>,
  childToParents: Map<string, string[]>,
): Map<string, number> {
  const generations = new Map<string, number>();

  function getGeneration(personId: string, visited: Set<string>): number {
    if (generations.has(personId)) return generations.get(personId)!;
    if (visited.has(personId)) return 0;
    visited.add(personId);

    const parents = childToParents.get(personId);
    if (!parents || parents.length === 0) {
      generations.set(personId, 0);
      return 0;
    }

    const maxParentGen = Math.max(
      ...parents.filter((pid) => persons.has(pid)).map((pid) => getGeneration(pid, visited)),
    );
    const gen = maxParentGen + 1;
    generations.set(personId, gen);
    return gen;
  }

  for (const personId of persons.keys()) {
    getGeneration(personId, new Set());
  }

  return generations;
}

function equalizePartners(
  generations: Map<string, number>,
  relationships: Map<string, DecryptedRelationship>,
): boolean {
  let changed = false;
  for (const rel of relationships.values()) {
    if (rel.type !== RelationshipType.Partner) continue;
    const genA = generations.get(rel.source_person_id);
    const genB = generations.get(rel.target_person_id);
    if (genA == null || genB == null) continue;
    if (genA !== genB) {
      const maxGen = Math.max(genA, genB);
      generations.set(rel.source_person_id, maxGen);
      generations.set(rel.target_person_id, maxGen);
      changed = true;
    }
  }
  return changed;
}

function propagateToChildren(
  generations: Map<string, number>,
  childToParents: Map<string, string[]>,
): boolean {
  let changed = false;
  for (const [childId, parentIds] of childToParents) {
    const parentGens = parentIds
      .filter((pid) => generations.has(pid))
      .map((pid) => generations.get(pid)!);
    if (parentGens.length === 0) continue;
    const expectedGen = Math.max(...parentGens) + 1;
    const currentGen = generations.get(childId) ?? 0;
    if (expectedGen > currentGen) {
      generations.set(childId, expectedGen);
      changed = true;
    }
  }
  return changed;
}

export function equalizePartnerGenerations(
  generations: Map<string, number>,
  relationships: Map<string, DecryptedRelationship>,
  childToParents: Map<string, string[]>,
): void {
  let changed = true;
  while (changed) {
    const partnersChanged = equalizePartners(generations, relationships);
    const childrenChanged = propagateToChildren(generations, childToParents);
    changed = partnersChanged || childrenChanged;
  }
}

export function computeGenerations(
  persons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
): Map<string, number> {
  const childToParents = buildChildToParentsMap(relationships);
  const generations = assignBaseGenerations(persons, childToParents);
  equalizePartnerGenerations(generations, relationships, childToParents);
  return generations;
}

// ---- Person filtering ----

export function filterTimelinePersons(
  persons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
): Map<string, DecryptedPerson> {
  const familyConnected = new Set<string>();
  for (const rel of relationships.values()) {
    if (rel.type !== RelationshipType.Friend) {
      familyConnected.add(rel.source_person_id);
      familyConnected.add(rel.target_person_id);
    }
  }

  const result = new Map<string, DecryptedPerson>();
  for (const [id, person] of persons) {
    if (familyConnected.has(id) || !relationships.size) {
      result.set(id, person);
    } else {
      const hasAnyRel = [...relationships.values()].some(
        (r) => r.source_person_id === id || r.target_person_id === id,
      );
      if (!hasAnyRel) result.set(id, person);
    }
  }
  return result;
}

// ---- Row layout ----

export function buildRowLayout(
  timelinePersons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
  availableHeight: number,
): RowLayout {
  const generations = computeGenerations(timelinePersons, relationships);
  const personsByGen = new Map<number, DecryptedPerson[]>();

  for (const person of timelinePersons.values()) {
    const gen = generations.get(person.id) ?? 0;
    const list = personsByGen.get(gen) ?? [];
    list.push(person);
    personsByGen.set(gen, list);
  }

  const sortedGens = Array.from(personsByGen.keys()).sort((a, b) => a - b);

  for (const list of personsByGen.values()) {
    list.sort(
      (a, b) =>
        (a.birth_year ?? Number.POSITIVE_INFINITY) - (b.birth_year ?? Number.POSITIVE_INFINITY),
    );
  }

  const rows: PersonRow[] = [];
  let currentY = 0;

  for (const gen of sortedGens) {
    currentY += GEN_HEADER_HEIGHT;
    const genPersons = personsByGen.get(gen)!;
    for (const person of genPersons) {
      rows.push({ person, generation: gen, y: currentY });
      currentY += ROW_HEIGHT;
    }
  }

  const totalHeight = Math.max(currentY + 20, availableHeight);
  return { rows, sortedGens, personsByGen, totalHeight };
}

// ---- Time domain ----

export function computeTimeDomain(
  persons: Map<string, DecryptedPerson>,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
): { minYear: number; maxYear: number } {
  const currentYear = new Date().getFullYear();
  let minYear = currentYear;
  let maxYear = 0;

  for (const person of persons.values()) {
    if (person.birth_year != null) {
      minYear = Math.min(minYear, person.birth_year);
    }
    maxYear = Math.max(maxYear, person.death_year ?? currentYear);
  }

  for (const event of events.values()) {
    const year = parseInt(event.approximate_date, 10);
    if (!Number.isNaN(year)) {
      minYear = Math.min(minYear, year);
      maxYear = Math.max(maxYear, year);
    }
  }

  for (const le of lifeEvents.values()) {
    const year = parseInt(le.approximate_date, 10);
    if (!Number.isNaN(year)) {
      minYear = Math.min(minYear, year);
      maxYear = Math.max(maxYear, year);
    }
  }

  return { minYear: minYear - 5, maxYear: maxYear + 5 };
}

// ---- Person data grouping ----

export function buildPersonDataMaps(
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  classifications: Map<string, DecryptedClassification>,
): PersonDataMaps {
  const eventsByPerson = new Map<string, DecryptedEvent[]>();
  for (const event of events.values()) {
    for (const pid of event.person_ids) {
      const existing = eventsByPerson.get(pid) ?? [];
      existing.push(event);
      eventsByPerson.set(pid, existing);
    }
  }

  const lifeEventsByPerson = new Map<string, DecryptedLifeEvent[]>();
  for (const le of lifeEvents.values()) {
    for (const pid of le.person_ids) {
      const existing = lifeEventsByPerson.get(pid) ?? [];
      existing.push(le);
      lifeEventsByPerson.set(pid, existing);
    }
  }

  const classificationsByPerson = new Map<string, DecryptedClassification[]>();
  for (const cls of classifications.values()) {
    for (const pid of cls.person_ids) {
      const existing = classificationsByPerson.get(pid) ?? [];
      existing.push(cls);
      classificationsByPerson.set(pid, existing);
    }
  }

  return { eventsByPerson, lifeEventsByPerson, classificationsByPerson };
}
