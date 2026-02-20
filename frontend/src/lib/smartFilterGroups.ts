import type { DecryptedPerson, DecryptedRelationship } from "../hooks/useTreeData";
import { RelationshipType } from "../types/domain";
import { inferSiblings } from "./inferSiblings";

export interface FilterGroup {
  key: string;
  labelKey: string;
  personIds: Set<string>;
}

export interface SmartFilterGroups {
  demographic: FilterGroup[];
  roles: FilterGroup[];
  generations: FilterGroup[];
}

const PARENT_TYPES = new Set([
  RelationshipType.BiologicalParent,
  RelationshipType.CoParent,
  RelationshipType.StepParent,
  RelationshipType.AdoptiveParent,
]);

const SIBLING_TYPES = new Set([
  RelationshipType.BiologicalSibling,
  RelationshipType.StepSibling,
  RelationshipType.HalfSibling,
]);

function filterToPersons(ids: Set<string>, persons: Map<string, DecryptedPerson>): Set<string> {
  const result = new Set<string>();
  for (const id of ids) {
    if (persons.has(id)) result.add(id);
  }
  return result;
}

function pushIfNonEmpty(groups: FilterGroup[], key: string, labelKey: string, ids: Set<string>) {
  if (ids.size > 0) groups.push({ key, labelKey, personIds: ids });
}

function computeDemographicGroups(persons: Map<string, DecryptedPerson>): FilterGroup[] {
  const women = new Set<string>();
  const men = new Set<string>();
  const adopted = new Set<string>();

  for (const [id, person] of persons) {
    if (person.gender === "female") women.add(id);
    if (person.gender === "male") men.add(id);
    if (person.is_adopted) adopted.add(id);
  }

  const groups: FilterGroup[] = [];
  pushIfNonEmpty(groups, "gender:female", "timeline.group.women", women);
  pushIfNonEmpty(groups, "gender:male", "timeline.group.men", men);
  pushIfNonEmpty(groups, "demographic:adopted", "timeline.group.adopted", adopted);
  return groups;
}

function findGrandparents(
  parentIds: Set<string>,
  childrenOfParent: Map<string, Set<string>>,
): Set<string> {
  const grandparentIds = new Set<string>();
  for (const pid of parentIds) {
    const children = childrenOfParent.get(pid);
    if (!children) continue;
    for (const childId of children) {
      if (parentIds.has(childId)) {
        grandparentIds.add(pid);
        break;
      }
    }
  }
  return grandparentIds;
}

function computeRoleGroups(
  persons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
): FilterGroup[] {
  const parentIds = new Set<string>();
  const childrenOfParent = new Map<string, Set<string>>();
  const partnerIds = new Set<string>();
  const siblingIds = new Set<string>();

  for (const rel of relationships.values()) {
    if (PARENT_TYPES.has(rel.type)) {
      parentIds.add(rel.source_person_id);
      const children = childrenOfParent.get(rel.source_person_id) ?? new Set();
      children.add(rel.target_person_id);
      childrenOfParent.set(rel.source_person_id, children);
    }
    if (rel.type === RelationshipType.Partner) {
      partnerIds.add(rel.source_person_id);
      partnerIds.add(rel.target_person_id);
    }
    if (SIBLING_TYPES.has(rel.type)) {
      siblingIds.add(rel.source_person_id);
      siblingIds.add(rel.target_person_id);
    }
  }

  for (const sib of inferSiblings(relationships)) {
    siblingIds.add(sib.personAId);
    siblingIds.add(sib.personBId);
  }

  const grandparentIds = findGrandparents(parentIds, childrenOfParent);

  const groups: FilterGroup[] = [];
  pushIfNonEmpty(
    groups,
    "role:parents",
    "timeline.group.parents",
    filterToPersons(parentIds, persons),
  );
  pushIfNonEmpty(
    groups,
    "role:grandparents",
    "timeline.group.grandparents",
    filterToPersons(grandparentIds, persons),
  );
  pushIfNonEmpty(
    groups,
    "role:partners",
    "timeline.group.partners",
    filterToPersons(partnerIds, persons),
  );
  pushIfNonEmpty(
    groups,
    "role:siblings",
    "timeline.group.siblings",
    filterToPersons(siblingIds, persons),
  );
  return groups;
}

function computeGenerationGroups(
  persons: Map<string, DecryptedPerson>,
  generations: Map<string, number>,
): FilterGroup[] {
  const genBuckets = new Map<number, Set<string>>();
  for (const [personId, gen] of generations) {
    if (!persons.has(personId)) continue;
    const bucket = genBuckets.get(gen) ?? new Set();
    bucket.add(personId);
    genBuckets.set(gen, bucket);
  }

  const sortedGens = Array.from(genBuckets.keys()).sort((a, b) => a - b);
  const groups: FilterGroup[] = [];
  for (const gen of sortedGens) {
    const bucket = genBuckets.get(gen)!;
    pushIfNonEmpty(groups, `gen:${gen}`, `Gen ${gen + 1}`, bucket);
  }
  return groups;
}

export function computeSmartFilterGroups(
  persons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
  generations: Map<string, number>,
): SmartFilterGroups {
  return {
    demographic: computeDemographicGroups(persons),
    roles: computeRoleGroups(persons, relationships),
    generations: computeGenerationGroups(persons, generations),
  };
}
