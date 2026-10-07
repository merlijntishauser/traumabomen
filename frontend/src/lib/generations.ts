import type { DecryptedPerson, DecryptedRelationship } from "../hooks/useTreeData";
import { RelationshipType } from "../types/domain";

/**
 * Generations in a family: parents sit one generation above their children,
 * partners and co-parents share a generation. Used by the timeline and insights.
 */

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
      ...parents.flatMap((pid) => (persons.has(pid) ? [getGeneration(pid, visited)] : [])),
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

function equalizeExplicitPartners(
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

function equalizeCoParents(
  generations: Map<string, number>,
  childToParents: Map<string, string[]>,
): boolean {
  let changed = false;
  for (const parentIds of childToParents.values()) {
    if (parentIds.length < 2) continue;
    const parentGens = parentIds.flatMap((pid) => {
      const gen = generations.get(pid);
      return gen != null ? [gen] : [];
    });
    if (parentGens.length < 2) continue;
    const maxGen = Math.max(...parentGens);
    for (const pid of parentIds) {
      if (generations.has(pid) && generations.get(pid)! < maxGen) {
        generations.set(pid, maxGen);
        changed = true;
      }
    }
  }
  return changed;
}

function equalizePartners(
  generations: Map<string, number>,
  relationships: Map<string, DecryptedRelationship>,
  childToParents: Map<string, string[]>,
): boolean {
  const partnersChanged = equalizeExplicitPartners(generations, relationships);
  const coParentsChanged = equalizeCoParents(generations, childToParents);
  return partnersChanged || coParentsChanged;
}

function propagateToChildren(
  generations: Map<string, number>,
  childToParents: Map<string, string[]>,
): boolean {
  let changed = false;
  for (const [childId, parentIds] of childToParents) {
    const parentGens = parentIds.flatMap((pid) => {
      const gen = generations.get(pid);
      return gen != null ? [gen] : [];
    });
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
    const partnersChanged = equalizePartners(generations, relationships, childToParents);
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
