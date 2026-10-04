import type { DecryptedRelationship } from "../hooks/useTreeData";
import { PartnerStatus, RelationshipType } from "../types/domain";
import type { InferredSibling } from "./inferSiblings";

/**
 * How the people around a person are named in the glance line at the top of
 * their page ("Married to Hendrik. Mother of Pieter and Anna."). Each role is
 * phrased from the selected person's side.
 */
export type GlanceRole =
  | "marriedTo"
  | "partnerOf"
  | "formerPartnerOf"
  | "childOf"
  | "stepChildOf"
  | "parentOf"
  | "stepParentOf"
  | "siblingOf"
  | "halfSiblingOf"
  | "stepSiblingOf"
  | "friendOf";

export interface GlanceGroup {
  role: GlanceRole;
  personIds: string[];
}

const ROLE_ORDER: readonly GlanceRole[] = [
  "marriedTo",
  "partnerOf",
  "formerPartnerOf",
  "childOf",
  "stepChildOf",
  "parentOf",
  "stepParentOf",
  "siblingOf",
  "halfSiblingOf",
  "stepSiblingOf",
  "friendOf",
];

const PARENT_TYPES = new Set<RelationshipType>([
  RelationshipType.BiologicalParent,
  RelationshipType.CoParent,
  RelationshipType.AdoptiveParent,
]);

function partnerRole(rel: DecryptedRelationship): GlanceRole {
  if (rel.periods.length === 0) return "partnerOf";
  const latest = [...rel.periods].sort((a, b) => a.start_year - b.start_year).at(-1);
  if (!latest || latest.end_year != null) return "formerPartnerOf";
  if (latest.status === PartnerStatus.Separated || latest.status === PartnerStatus.Divorced) {
    return "formerPartnerOf";
  }
  return latest.status === PartnerStatus.Married ? "marriedTo" : "partnerOf";
}

/** The role the other person plays, phrased from `personId`'s side. */
function roleFor(rel: DecryptedRelationship, personId: string): GlanceRole {
  const isSource = rel.source_person_id === personId;
  if (PARENT_TYPES.has(rel.type)) return isSource ? "parentOf" : "childOf";
  switch (rel.type) {
    case RelationshipType.StepParent:
      return isSource ? "stepParentOf" : "stepChildOf";
    case RelationshipType.Partner:
      return partnerRole(rel);
    case RelationshipType.HalfSibling:
      return "halfSiblingOf";
    case RelationshipType.StepSibling:
      return "stepSiblingOf";
    case RelationshipType.Friend:
      return "friendOf";
    default:
      return "siblingOf";
  }
}

/** Group a person's relationships and inferred siblings into glance roles, in reading order. */
export function buildGlanceGroups(
  personId: string,
  relationships: DecryptedRelationship[],
  inferredSiblings: InferredSibling[],
): GlanceGroup[] {
  const byRole = new Map<GlanceRole, string[]>();
  const add = (role: GlanceRole, otherId: string) => {
    const ids = byRole.get(role) ?? [];
    if (!ids.includes(otherId)) ids.push(otherId);
    byRole.set(role, ids);
  };
  for (const rel of relationships) {
    const otherId = rel.source_person_id === personId ? rel.target_person_id : rel.source_person_id;
    add(roleFor(rel, personId), otherId);
  }
  for (const sib of inferredSiblings) {
    const otherId = sib.personAId === personId ? sib.personBId : sib.personAId;
    add(sib.type === "half_sibling" ? "halfSiblingOf" : "siblingOf", otherId);
  }
  return ROLE_ORDER.flatMap((role) => {
    const personIds = byRole.get(role);
    return personIds ? [{ role, personIds }] : [];
  });
}
