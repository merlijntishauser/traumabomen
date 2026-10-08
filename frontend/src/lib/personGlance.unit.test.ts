import { describe, expect, it } from "vitest";
import type { DecryptedRelationship } from "../hooks/useTreeData";
import { PartnerStatus, type RelationshipPeriod, RelationshipType } from "../types/domain";
import type { InferredSibling } from "./inferSiblings";
import { buildGlanceGroups } from "./personGlance";

function rel(
  id: string,
  type: RelationshipType,
  source: string,
  target: string,
  periods: RelationshipPeriod[] = [],
): DecryptedRelationship {
  return {
    id,
    type,
    source_person_id: source,
    target_person_id: target,
    periods,
    active_period: null,
  };
}

describe("buildGlanceGroups", () => {
  it("is empty for a person without relationships", () => {
    expect(buildGlanceGroups("me", [], [])).toEqual([]);
  });

  it("names parents and children from the person's side", () => {
    const groups = buildGlanceGroups(
      "me",
      [
        rel("r1", RelationshipType.BiologicalParent, "mum", "me"),
        rel("r2", RelationshipType.AdoptiveParent, "dad", "me"),
        rel("r3", RelationshipType.BiologicalParent, "me", "kid"),
        rel("r4", RelationshipType.CoParent, "me", "kid2"),
      ],
      [],
    );
    expect(groups).toEqual([
      { role: "childOf", personIds: ["mum", "dad"] },
      { role: "parentOf", personIds: ["kid", "kid2"] },
    ]);
  });

  it("keeps step-parents apart from parents", () => {
    const groups = buildGlanceGroups(
      "me",
      [
        rel("r1", RelationshipType.StepParent, "step", "me"),
        rel("r2", RelationshipType.StepParent, "me", "stepkid"),
      ],
      [],
    );
    expect(groups).toEqual([
      { role: "stepChildOf", personIds: ["step"] },
      { role: "stepParentOf", personIds: ["stepkid"] },
    ]);
  });

  it("reads a partner's latest period", () => {
    const groups = buildGlanceGroups(
      "me",
      [
        rel("r1", RelationshipType.Partner, "me", "wife", [
          { start_year: 1970, end_year: 1975, status: PartnerStatus.Together },
          { start_year: 1975, end_year: null, status: PartnerStatus.Married },
        ]),
        rel("r2", RelationshipType.Partner, "ex", "me", [
          { start_year: 1960, end_year: 1968, status: PartnerStatus.Married },
        ]),
        rel("r3", RelationshipType.Partner, "me", "now", []),
        rel("r4", RelationshipType.Partner, "me", "sep", [
          { start_year: 1990, end_year: null, status: PartnerStatus.Separated },
        ]),
        rel("r5", RelationshipType.Partner, "me", "together", [
          { start_year: 2000, end_year: null, status: PartnerStatus.Together },
        ]),
      ],
      [],
    );
    expect(groups).toEqual([
      { role: "marriedTo", personIds: ["wife"] },
      { role: "partnerOf", personIds: ["now", "together"] },
      { role: "formerPartnerOf", personIds: ["ex", "sep"] },
    ]);
  });

  it("keeps a partnership that ended in a death, and still names a separation", () => {
    const died: Record<string, number> = { late: 2005, widower: 1999 };
    const groups = buildGlanceGroups(
      "me",
      [
        rel("r1", RelationshipType.Partner, "me", "late", [
          { start_year: 1956, end_year: 2005, status: PartnerStatus.Married },
        ]),
        rel("r2", RelationshipType.Partner, "widower", "me", [
          { start_year: 1990, end_year: 1999, status: PartnerStatus.Together },
        ]),
        rel("r3", RelationshipType.Partner, "me", "ex", [
          { start_year: 1950, end_year: 1954, status: PartnerStatus.Married },
        ]),
        rel("r4", RelationshipType.Partner, "me", "late-ex", [
          { start_year: 1960, end_year: 2001, status: PartnerStatus.Divorced },
        ]),
      ],
      [],
      (id) => died[id] ?? (id === "ex" ? 2010 : id === "late-ex" ? 2001 : null),
    );
    expect(groups).toEqual([
      { role: "marriedTo", personIds: ["late"] },
      { role: "partnerOf", personIds: ["widower"] },
      { role: "formerPartnerOf", personIds: ["ex", "late-ex"] },
    ]);
  });

  it("merges explicit and inferred siblings without duplicates", () => {
    const inferred: InferredSibling[] = [
      { personAId: "me", personBId: "bro", type: "full_sibling", sharedParentIds: ["mum"] },
      { personAId: "half", personBId: "me", type: "half_sibling", sharedParentIds: ["mum"] },
    ];
    const groups = buildGlanceGroups(
      "me",
      [
        rel("r1", RelationshipType.BiologicalSibling, "me", "bro"),
        rel("r2", RelationshipType.StepSibling, "me", "stepsis"),
        rel("r3", RelationshipType.HalfSibling, "other", "me"),
      ],
      inferred,
    );
    expect(groups).toEqual([
      { role: "siblingOf", personIds: ["bro"] },
      { role: "halfSiblingOf", personIds: ["other", "half"] },
      { role: "stepSiblingOf", personIds: ["stepsis"] },
    ]);
  });

  it("lists friends last", () => {
    const groups = buildGlanceGroups(
      "me",
      [
        rel("r1", RelationshipType.Friend, "pal", "me"),
        rel("r2", RelationshipType.BiologicalParent, "mum", "me"),
      ],
      [],
    );
    expect(groups.map((g) => g.role)).toEqual(["childOf", "friendOf"]);
  });
});
