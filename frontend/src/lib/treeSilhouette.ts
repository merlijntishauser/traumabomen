import type { DecryptedRelationship } from "../hooks/useTreeData";
import { RelationshipType } from "../types/domain";

/**
 * Geometry for the tree list's preview of the latest tree: the canvas layout
 * in miniature, reduced to people and the two lines that carry a family's
 * shape (partners and parents). Pure, so the drawing rules are testable
 * without rendering an SVG.
 */

export interface SilhouettePerson {
  id: string;
  name: string;
  x: number;
  y: number;
}

export type SilhouetteLinkKind = "partner" | "formerPartner" | "parent" | "chosenParent";

export interface SilhouetteLink {
  key: string;
  kind: SilhouetteLinkKind;
  d: string;
}

export interface Silhouette {
  people: SilhouettePerson[];
  links: SilhouetteLink[];
  viewBox: { x: number; y: number; width: number; height: number };
}

/** Node size in canvas units, matching the person node on the canvas. */
export const SILHOUETTE_NODE = { width: 180, height: 80 } as const;

const PADDING = 48;

const BIO_PARENTS = new Set<RelationshipType>([
  RelationshipType.BiologicalParent,
  RelationshipType.CoParent,
]);
const CHOSEN_PARENTS = new Set<RelationshipType>([
  RelationshipType.AdoptiveParent,
  RelationshipType.StepParent,
]);

function isFormerPartner(rel: DecryptedRelationship): boolean {
  return rel.periods.length > 0 && rel.periods.every((p) => p.end_year != null);
}

function partnerLink(
  rel: DecryptedRelationship,
  a: SilhouettePerson,
  b: SilhouettePerson,
): SilhouetteLink {
  const [left, right] = a.x <= b.x ? [a, b] : [b, a];
  const { width, height } = SILHOUETTE_NODE;
  const y1 = left.y + height / 2;
  const y2 = right.y + height / 2;
  return {
    key: rel.id,
    kind: isFormerPartner(rel) ? "formerPartner" : "partner",
    d: `M${left.x + width} ${y1}L${right.x} ${y2}`,
  };
}

/** An elbow from a point above the child down to the top of the child's node. */
function elbow(fromX: number, fromY: number, child: SilhouettePerson): string {
  const { width } = SILHOUETTE_NODE;
  const toX = child.x + width / 2;
  const midY = fromY + (child.y - fromY) / 2;
  return `M${fromX} ${fromY}V${midY}H${toX}V${child.y}`;
}

function isParentType(type: RelationshipType): boolean {
  return BIO_PARENTS.has(type) || CHOSEN_PARENTS.has(type);
}

/** Parent relationships between drawn people, grouped by child. */
function parentsByChild(
  relationships: DecryptedRelationship[],
  byId: Map<string, SilhouettePerson>,
): Map<string, DecryptedRelationship[]> {
  const byChild = new Map<string, DecryptedRelationship[]>();
  for (const rel of relationships) {
    if (!isParentType(rel.type)) continue;
    if (!byId.has(rel.source_person_id) || !byId.has(rel.target_person_id)) continue;
    const list = byChild.get(rel.target_person_id) ?? [];
    list.push(rel);
    byChild.set(rel.target_person_id, list);
  }
  return byChild;
}

/**
 * Lines from one child's parents. Two parents who are partners share one
 * line from the middle of their partner line, as on the canvas; otherwise
 * each parent draws its own.
 */
function linksForChild(
  child: SilhouettePerson,
  rels: DecryptedRelationship[],
  byId: Map<string, SilhouettePerson>,
  partnerPairs: Set<string>,
): SilhouetteLink[] {
  const { width, height } = SILHOUETTE_NODE;
  const parents = rels.map((r) => byId.get(r.source_person_id) as SilhouettePerson);
  if (parents.length === 2 && partnerPairs.has(pairKey(parents[0].id, parents[1].id))) {
    const kind: SilhouetteLinkKind = rels.every((r) => BIO_PARENTS.has(r.type))
      ? "parent"
      : "chosenParent";
    const fromX = (parents[0].x + parents[1].x + width) / 2;
    const fromY = Math.max(parents[0].y, parents[1].y) + height / 2;
    return [{ key: `${child.id}-couple`, kind, d: elbow(fromX, fromY, child) }];
  }
  return parents.map((parent, i) => ({
    key: `${child.id}-${rels[i].id}`,
    kind: CHOSEN_PARENTS.has(rels[i].type) ? "chosenParent" : "parent",
    d: elbow(parent.x + width / 2, parent.y + height, child),
  }));
}

function parentLinks(
  relationships: DecryptedRelationship[],
  byId: Map<string, SilhouettePerson>,
  partnerPairs: Set<string>,
): SilhouetteLink[] {
  return [...parentsByChild(relationships, byId)].flatMap(([childId, rels]) =>
    linksForChild(byId.get(childId) as SilhouettePerson, rels, byId, partnerPairs),
  );
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** People at their canvas positions, the lines between them, and a padded viewBox. */
export function buildSilhouette(
  people: SilhouettePerson[],
  relationships: DecryptedRelationship[],
): Silhouette {
  const { width, height } = SILHOUETTE_NODE;
  if (people.length === 0) {
    return { people, links: [], viewBox: { x: 0, y: 0, width: width * 3, height: height * 3 } };
  }

  const byId = new Map(people.map((p) => [p.id, p]));
  const partnerPairs = new Set<string>();
  const links: SilhouetteLink[] = [];
  for (const rel of relationships) {
    if (rel.type !== RelationshipType.Partner) continue;
    const a = byId.get(rel.source_person_id);
    const b = byId.get(rel.target_person_id);
    if (!a || !b) continue;
    partnerPairs.add(pairKey(a.id, b.id));
    links.push(partnerLink(rel, a, b));
  }
  links.push(...parentLinks(relationships, byId, partnerPairs));

  const minX = Math.min(...people.map((p) => p.x)) - PADDING;
  const minY = Math.min(...people.map((p) => p.y)) - PADDING;
  const maxX = Math.max(...people.map((p) => p.x)) + width + PADDING;
  const maxY = Math.max(...people.map((p) => p.y)) + height + PADDING;
  return {
    people,
    links,
    viewBox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
  };
}
