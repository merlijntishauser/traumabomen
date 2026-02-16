import { describe, expect, it } from "vitest";
import { PATTERN_COLORS } from "./patternColors";

describe("PATTERN_COLORS", () => {
  it("has 8 colors", () => {
    expect(PATTERN_COLORS).toHaveLength(8);
  });

  it("all are valid hex colors", () => {
    for (const color of PATTERN_COLORS) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("all colors are unique", () => {
    const unique = new Set(PATTERN_COLORS.map((c) => c.toLowerCase()));
    expect(unique.size).toBe(PATTERN_COLORS.length);
  });
});
