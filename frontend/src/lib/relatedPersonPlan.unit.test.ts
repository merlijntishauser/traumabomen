import { describe, expect, it } from "vitest";
import { PartnerStatus, RelationshipType } from "../types/domain";
import { buildRelatedPersonPlan } from "./relatedPersonPlan";

const S = "source-id";
const N = "new-id";

describe("buildRelatedPersonPlan", () => {
  it("child: one biological-parent edge S -> N, placed below", () => {
    const plan = buildRelatedPersonPlan("child", S, N, [], 2026);
    expect(plan.relationships).toEqual([
      {
        sourcePersonId: S,
        targetPersonId: N,
        data: { type: RelationshipType.BiologicalParent, periods: [], active_period: null },
      },
    ]);
    expect(plan.offset.dy).toBeGreaterThan(0);
    expect(plan.offset.dx).toBe(0);
  });

  it("parent: one biological-parent edge N -> S, placed above", () => {
    const plan = buildRelatedPersonPlan("parent", S, N, [], 2026);
    expect(plan.relationships[0]).toMatchObject({
      sourcePersonId: N,
      targetPersonId: S,
      data: { type: RelationshipType.BiologicalParent },
    });
    expect(plan.offset.dy).toBeLessThan(0);
  });

  it("partner: partner edge S -> N with a 'together' period at the current year, beside", () => {
    const plan = buildRelatedPersonPlan("partner", S, N, [], 2026);
    const rel = plan.relationships[0];
    expect(rel.sourcePersonId).toBe(S);
    expect(rel.targetPersonId).toBe(N);
    expect(rel.data.type).toBe(RelationshipType.Partner);
    expect(rel.data.periods).toEqual([
      { start_year: 2026, end_year: null, status: PartnerStatus.Together },
    ]);
    expect(plan.offset.dx).toBeGreaterThan(0);
    expect(plan.offset.dy).toBe(0);
  });

  it("sibling with two shared parents: two biological-parent edges (full sibling)", () => {
    const plan = buildRelatedPersonPlan("sibling", S, N, ["p1", "p2"], 2026);
    expect(plan.relationships).toHaveLength(2);
    expect(plan.relationships.map((r) => r.sourcePersonId)).toEqual(["p1", "p2"]);
    for (const r of plan.relationships) {
      expect(r.targetPersonId).toBe(N);
      expect(r.data.type).toBe(RelationshipType.BiologicalParent);
    }
  });

  it("sibling with one shared parent: one edge (half sibling)", () => {
    const plan = buildRelatedPersonPlan("sibling", S, N, ["p1"], 2026);
    expect(plan.relationships).toHaveLength(1);
    expect(plan.relationships[0]).toMatchObject({ sourcePersonId: "p1", targetPersonId: N });
  });

  it("sibling with no shared parents: fallback biological-sibling edge S -> N", () => {
    const plan = buildRelatedPersonPlan("sibling", S, N, [], 2026);
    expect(plan.relationships).toEqual([
      {
        sourcePersonId: S,
        targetPersonId: N,
        data: { type: RelationshipType.BiologicalSibling, periods: [], active_period: null },
      },
    ]);
    expect(plan.offset.dx).toBeGreaterThan(0);
  });
});
