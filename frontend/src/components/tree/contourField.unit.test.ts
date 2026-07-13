import { describe, expect, it } from "vitest";
import {
  chaikin,
  type FieldSpec,
  makeGrid,
  marchingSquares,
  sampleField,
  toPath,
} from "./contourField";

const singlePeak: FieldSpec = {
  peaks: [{ x: 0, y: 0, amp: 1, sigma: 100 }],
  ripples: [],
};

describe("sampleField", () => {
  it("is highest at the peak and falls off with distance", () => {
    const atPeak = sampleField(singlePeak, 0, 0);
    const nearby = sampleField(singlePeak, 50, 0);
    const far = sampleField(singlePeak, 500, 0);
    expect(atPeak).toBeCloseTo(1, 5);
    expect(nearby).toBeLessThan(atPeak);
    expect(far).toBeLessThan(nearby);
  });

  it("sums multiple peaks", () => {
    const two: FieldSpec = {
      peaks: [
        { x: 0, y: 0, amp: 1, sigma: 100 },
        { x: 0, y: 0, amp: 0.5, sigma: 100 },
      ],
      ripples: [],
    };
    expect(sampleField(two, 0, 0)).toBeCloseTo(1.5, 5);
  });
});

describe("makeGrid", () => {
  it("samples the field over the requested bounds", () => {
    const grid = makeGrid(singlePeak, { x0: -200, y0: -200, x1: 200, y1: 200 }, 50);
    expect(grid.nx).toBeGreaterThan(2);
    expect(grid.values).toHaveLength(grid.nx * grid.ny);
    // The centre sample should dominate the corner sample
    const centre = grid.values[Math.floor(grid.ny / 2) * grid.nx + Math.floor(grid.nx / 2)];
    expect(centre).toBeGreaterThan(grid.values[0]);
  });
});

describe("marchingSquares", () => {
  const grid = makeGrid(singlePeak, { x0: -300, y0: -300, x1: 300, y1: 300 }, 20);

  it("extracts a closed loop around a single peak", () => {
    const lines = marchingSquares(grid, 0.5);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const loop = lines[0];
    expect(loop.length).toBeGreaterThan(8);
    // Closed: first and last points coincide
    expect(loop[0].x).toBeCloseTo(loop[loop.length - 1].x, 1);
    expect(loop[0].y).toBeCloseTo(loop[loop.length - 1].y, 1);
  });

  it("level-set radius matches the analytic contour of the gaussian", () => {
    const threshold = 0.5;
    const expected = Math.sqrt(-2 * 100 * 100 * Math.log(threshold));
    const [loop] = marchingSquares(grid, threshold);
    for (const p of loop) {
      const r = Math.hypot(p.x, p.y);
      expect(Math.abs(r - expected)).toBeLessThan(15);
    }
  });

  it("nested thresholds produce nested loops", () => {
    const outer = marchingSquares(grid, 0.3)[0];
    const inner = marchingSquares(grid, 0.7)[0];
    const maxInner = Math.max(...inner.map((p) => Math.hypot(p.x, p.y)));
    const minOuter = Math.min(...outer.map((p) => Math.hypot(p.x, p.y)));
    expect(maxInner).toBeLessThan(minOuter);
  });

  it("returns nothing above the field maximum", () => {
    expect(marchingSquares(grid, 2)).toHaveLength(0);
  });
});

describe("chaikin", () => {
  it("smooths while preserving open endpoints", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    const smooth = chaikin(line, 2);
    expect(smooth.length).toBeGreaterThan(line.length);
    expect(smooth[0]).toEqual(line[0]);
    expect(smooth[smooth.length - 1]).toEqual(line[line.length - 1]);
  });

  it("keeps closed loops closed", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 },
    ];
    const smooth = chaikin(square, 2);
    expect(smooth[0].x).toBeCloseTo(smooth[smooth.length - 1].x, 5);
    expect(smooth[0].y).toBeCloseTo(smooth[smooth.length - 1].y, 5);
  });
});

describe("toPath", () => {
  it("renders a move followed by line segments", () => {
    const d = toPath([
      { x: 0, y: 0 },
      { x: 10, y: 5 },
    ]);
    expect(d).toBe("M0.0,0.0L10.0,5.0");
  });

  it("returns empty for degenerate input", () => {
    expect(toPath([{ x: 1, y: 1 }])).toBe("");
  });
});
