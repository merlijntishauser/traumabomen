import { describe, expect, it, vi } from "vitest";
import { TraumaCategory } from "../types/domain";
import { getTraumaColor, getTraumaColors, TRAUMA_COLORS } from "./traumaColors";

describe("traumaColors", () => {
  it("TRAUMA_COLORS has an entry for every category", () => {
    for (const cat of Object.values(TraumaCategory)) {
      expect(TRAUMA_COLORS[cat]).toBeDefined();
      expect(TRAUMA_COLORS[cat]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("getTraumaColor returns CSS variable value when available", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => " #ff0000 ",
    } as unknown as CSSStyleDeclaration);

    expect(getTraumaColor(TraumaCategory.Loss)).toBe("#ff0000");
  });

  it("getTraumaColor returns fallback when CSS variable is empty", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "",
    } as unknown as CSSStyleDeclaration);

    expect(getTraumaColor(TraumaCategory.Loss)).toBe(TRAUMA_COLORS[TraumaCategory.Loss]);
  });

  it("getTraumaColors returns all categories", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "",
    } as unknown as CSSStyleDeclaration);

    const colors = getTraumaColors();
    for (const cat of Object.values(TraumaCategory)) {
      expect(colors[cat]).toBe(TRAUMA_COLORS[cat]);
    }
  });

  it("getTraumaColors uses CSS values when available", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "#aabbcc",
    } as unknown as CSSStyleDeclaration);

    const colors = getTraumaColors();
    for (const cat of Object.values(TraumaCategory)) {
      expect(colors[cat]).toBe("#aabbcc");
    }
  });
});
