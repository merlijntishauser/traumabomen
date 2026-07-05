import { PartnerStatus, type RelationshipData, RelationshipType } from "../types/domain";

export type RelatedPersonKind = "child" | "parent" | "partner" | "sibling";

export interface PlannedRelationship {
  sourcePersonId: string;
  targetPersonId: string;
  data: RelationshipData;
}

export interface RelatedPersonPlan {
  /** Relationships to create linking the new person to the tree. */
  relationships: PlannedRelationship[];
  /** Position offset for the new node relative to the source node. */
  offset: { dx: number; dy: number };
}

// New node placement relative to the source: children below, parents above,
// partners and siblings alongside. findFreePosition nudges these to avoid
// overlap; the auto-layout button re-tidies afterwards.
const BESIDE = 240;
const STACK = 160;

function biologicalParent(sourcePersonId: string, targetPersonId: string): PlannedRelationship {
  return {
    sourcePersonId,
    targetPersonId,
    data: { type: RelationshipType.BiologicalParent, periods: [], active_period: null },
  };
}

/**
 * Given a right-click "add related person" action, return the relationships to
 * create and where to place the new node, relative to the source person S.
 *
 * - child:   biological-parent edge S -> N, N below S.
 * - parent:  biological-parent edge N -> S, N above S.
 * - partner: partner edge S -> N with a default "together" period, N beside S.
 * - sibling: N inherits S's biological parents (one parent edge each), so it
 *   becomes a true full/half sibling. With no shared parents, fall back to a
 *   plain biological-sibling edge S -> N. N beside S.
 */
export function buildRelatedPersonPlan(
  kind: RelatedPersonKind,
  sourcePersonId: string,
  newPersonId: string,
  sharedParentIds: string[],
  currentYear: number,
): RelatedPersonPlan {
  switch (kind) {
    case "child":
      return {
        relationships: [biologicalParent(sourcePersonId, newPersonId)],
        offset: { dx: 0, dy: STACK },
      };
    case "parent":
      return {
        relationships: [biologicalParent(newPersonId, sourcePersonId)],
        offset: { dx: 0, dy: -STACK },
      };
    case "partner":
      return {
        relationships: [
          {
            sourcePersonId,
            targetPersonId: newPersonId,
            data: {
              type: RelationshipType.Partner,
              periods: [
                { start_year: currentYear, end_year: null, status: PartnerStatus.Together },
              ],
              active_period: null,
            },
          },
        ],
        offset: { dx: BESIDE, dy: 0 },
      };
    case "sibling": {
      const relationships =
        sharedParentIds.length > 0
          ? sharedParentIds.map((parentId) => biologicalParent(parentId, newPersonId))
          : [
              {
                sourcePersonId,
                targetPersonId: newPersonId,
                data: {
                  type: RelationshipType.BiologicalSibling,
                  periods: [],
                  active_period: null,
                },
              },
            ];
      return { relationships, offset: { dx: BESIDE, dy: 0 } };
    }
  }
}
