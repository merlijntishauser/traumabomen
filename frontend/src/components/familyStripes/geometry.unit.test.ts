import { describe, expect, it } from "vitest";
import type { DecryptedPerson } from "../../hooks/useTreeData";
import { buildStripeLayout } from "../../lib/familyStripes";
import {
  fieldGeometry,
  GEN_HEIGHT,
  ROW_HEIGHT,
  RULER_HEIGHT,
  revealScrollLeft,
  rulerLabelPlacement,
  starPoints,
} from "./geometry";

function person(id: string, birth: number): DecryptedPerson {
  return {
    id,
    name: id,
    birth_year: birth,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    cause_of_death: null,
    gender: "female",
    is_adopted: false,
    notes: null,
  };
}

describe("fieldGeometry", () => {
  it("stacks a generation header and its rows under the ruler", () => {
    const layout = buildStripeLayout(
      new Map([
        ["a", person("a", 1930)],
        ["b", person("b", 1960)],
        ["c", person("c", 1962)],
      ]),
      new Map([
        ["a", 0],
        ["b", 1],
        ["c", 1],
      ]),
      2026,
    );
    const geo = fieldGeometry(layout);
    expect(geo.gens).toEqual([RULER_HEIGHT, RULER_HEIGHT + GEN_HEIGHT + ROW_HEIGHT]);
    expect(geo.rows.map((r) => [r.row.person.id, r.y])).toEqual([
      ["a", RULER_HEIGHT + GEN_HEIGHT],
      ["b", RULER_HEIGHT + 2 * GEN_HEIGHT + ROW_HEIGHT],
      ["c", RULER_HEIGHT + 2 * GEN_HEIGHT + 2 * ROW_HEIGHT],
    ]);
    expect(geo.height).toBe(RULER_HEIGHT + 2 * GEN_HEIGHT + 3 * ROW_HEIGHT + 8);
  });
});

describe("starPoints", () => {
  it("draws ten points alternating between the outer and inner radius", () => {
    const points = starPoints(0, 0, 10).split(" ");
    expect(points).toHaveLength(10);
    expect(points[0]).toBe("0.00,-10.00");
    const [x, y] = points[1].split(",").map(Number);
    expect(Math.hypot(x, y)).toBeCloseTo(4.5, 1);
  });
});

describe("revealScrollLeft", () => {
  it("leaves a column that is in view alone", () => {
    expect(revealScrollLeft(300, 100, 600)).toBeNull();
  });

  it("centres a column that is out of view, never past the start", () => {
    expect(revealScrollLeft(1000, 0, 600)).toBe(700);
    expect(revealScrollLeft(50, 400, 600)).toBe(0);
  });
});

describe("rulerLabelPlacement", () => {
  const flag = { left: 500, right: 546 };

  it("puts a label right of its tick when the flag is far away", () => {
    expect(rulerLabelPlacement(100, 90, flag)).toEqual({ x: 104, anchor: "start" });
  });

  it("steps a label left of the flag when its tick is just before it", () => {
    expect(rulerLabelPlacement(470, 90, flag)).toEqual({ x: 494, anchor: "end" });
  });

  it("steps a label right of the flag when its tick is under its right side", () => {
    expect(rulerLabelPlacement(530, 90, flag)).toEqual({ x: 552, anchor: "start" });
  });

  it("drops a label when stepping aside would reach its neighbour", () => {
    expect(rulerLabelPlacement(530, 60, flag)).toBeNull();
    expect(rulerLabelPlacement(470, 40, flag)).toBeNull();
  });

  it("drops a label that would sit under the names column", () => {
    expect(rulerLabelPlacement(100, 90, flag, 120)).toBeNull();
    expect(rulerLabelPlacement(100, 90, flag, 100)).toEqual({ x: 104, anchor: "start" });
  });
});
