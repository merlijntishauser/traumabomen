import { describe, expect, it } from "vitest";
import type { DecryptedRelationship } from "../hooks/useTreeData";
import { PartnerStatus, type RelationshipPeriod, RelationshipType } from "../types/domain";
import { buildSilhouette, type SilhouettePerson } from "./treeSilhouette";

function person(id: string, x: number, y: number): SilhouettePerson {
  return { id, name: id, x, y };
}

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

describe("buildSilhouette", () => {
  it("returns an empty drawing with a default frame for an empty tree", () => {
    const s = buildSilhouette([], []);
    expect(s.people).toEqual([]);
    expect(s.links).toEqual([]);
    expect(s.viewBox).toEqual({ x: 0, y: 0, width: 540, height: 240 });
  });

  it("frames all people with padding", () => {
    const s = buildSilhouette([person("a", 0, 0), person("b", 400, 300)], []);
    expect(s.viewBox).toEqual({ x: -48, y: -48, width: 676, height: 476 });
  });

  it("joins partners side to side at mid height", () => {
    const s = buildSilhouette(
      [person("b", 260, 0), person("a", 0, 0)],
      [rel("r1", RelationshipType.Partner, "b", "a")],
    );
    expect(s.links).toEqual([{ key: "r1", kind: "partner", d: "M180 40L260 40" }]);
  });

  it("marks partners whose periods all ended as former", () => {
    const s = buildSilhouette(
      [person("a", 0, 0), person("b", 260, 0)],
      [
        rel("r1", RelationshipType.Partner, "a", "b", [
          { start_year: 1970, end_year: 1980, status: PartnerStatus.Divorced },
        ]),
      ],
    );
    expect(s.links[0].kind).toBe("formerPartner");
  });

  it("draws one line from a couple to their child", () => {
    const s = buildSilhouette(
      [person("mum", 0, 0), person("dad", 260, 0), person("kid", 130, 240)],
      [
        rel("p", RelationshipType.Partner, "mum", "dad"),
        rel("c1", RelationshipType.BiologicalParent, "mum", "kid"),
        rel("c2", RelationshipType.BiologicalParent, "dad", "kid"),
      ],
    );
    const parent = s.links.filter((l) => l.kind === "parent");
    expect(parent).toEqual([{ key: "kid-couple", kind: "parent", d: "M220 40V140H220V240" }]);
  });

  it("draws a line per parent when the parents are not partners", () => {
    const s = buildSilhouette(
      [person("mum", 0, 0), person("dad", 400, 0), person("kid", 200, 240)],
      [
        rel("c1", RelationshipType.BiologicalParent, "mum", "kid"),
        rel("c2", RelationshipType.BiologicalParent, "dad", "kid"),
      ],
    );
    expect(s.links.map((l) => l.d)).toEqual(["M90 80V160H290V240", "M490 80V160H290V240"]);
  });

  it("marks adoptive and step parents as chosen", () => {
    const s = buildSilhouette(
      [person("mum", 0, 0), person("step", 260, 0), person("kid", 130, 240)],
      [
        rel("p", RelationshipType.Partner, "mum", "step"),
        rel("c1", RelationshipType.BiologicalParent, "mum", "kid"),
        rel("c2", RelationshipType.StepParent, "step", "kid"),
      ],
    );
    expect(s.links.find((l) => l.key === "kid-couple")?.kind).toBe("chosenParent");
  });

  it("labels each single parent's line by its own type", () => {
    const s = buildSilhouette(
      [person("a", 0, 0), person("kid", 0, 240)],
      [rel("c", RelationshipType.AdoptiveParent, "a", "kid")],
    );
    expect(s.links).toEqual([{ key: "kid-c", kind: "chosenParent", d: "M90 80V160H90V240" }]);
  });

  it("skips relationships to people who are not drawn, and siblings and friends", () => {
    const s = buildSilhouette(
      [person("a", 0, 0), person("b", 260, 0)],
      [
        rel("x", RelationshipType.Partner, "a", "gone"),
        rel("y", RelationshipType.BiologicalParent, "gone", "a"),
        rel("s", RelationshipType.BiologicalSibling, "a", "b"),
        rel("f", RelationshipType.Friend, "a", "b"),
      ],
    );
    expect(s.links).toEqual([]);
  });
});
