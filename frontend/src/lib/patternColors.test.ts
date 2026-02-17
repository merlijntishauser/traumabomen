import { describe, expect, it, vi } from "vitest";
import { getPatternColor, PATTERN_COLORS } from "./patternColors";

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

describe("getPatternColor", () => {
  it("resolves CSS variable value when available", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => " #ff0000 ",
    } as unknown as CSSStyleDeclaration);

    expect(getPatternColor(PATTERN_COLORS[0])).toBe("#ff0000");
  });

  it("falls back to original hex when CSS variable is empty", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "",
    } as unknown as CSSStyleDeclaration);

    expect(getPatternColor(PATTERN_COLORS[0])).toBe(PATTERN_COLORS[0]);
  });

  it("passes through unknown hex values unchanged", () => {
    expect(getPatternColor("#123456")).toBe("#123456");
  });

  it("performs case-insensitive lookup", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "#abcdef",
    } as unknown as CSSStyleDeclaration);

    expect(getPatternColor("#818CF8")).toBe("#abcdef");
    expect(getPatternColor("#818cf8")).toBe("#abcdef");
  });

  it("queries the correct CSS variable for each index", () => {
    const calls: string[] = [];
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (name: string) => {
        calls.push(name);
        return "";
      },
    } as unknown as CSSStyleDeclaration);

    for (const color of PATTERN_COLORS) {
      getPatternColor(color);
    }

    expect(calls).toEqual([
      "--color-pattern-0",
      "--color-pattern-1",
      "--color-pattern-2",
      "--color-pattern-3",
      "--color-pattern-4",
      "--color-pattern-5",
      "--color-pattern-6",
      "--color-pattern-7",
    ]);
  });
});
