import { describe, expect, it, vi } from "vitest";
import { LifeEventCategory } from "../types/domain";
import { getLifeEventColor, getLifeEventColors, LIFE_EVENT_COLORS } from "./lifeEventColors";

describe("lifeEventColors", () => {
  it("LIFE_EVENT_COLORS has an entry for every category", () => {
    for (const cat of Object.values(LifeEventCategory)) {
      expect(LIFE_EVENT_COLORS[cat]).toBeDefined();
      expect(LIFE_EVENT_COLORS[cat]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("getLifeEventColor returns CSS variable value when available", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => " #00ff00 ",
    } as unknown as CSSStyleDeclaration);

    expect(getLifeEventColor(LifeEventCategory.Family)).toBe("#00ff00");
  });

  it("getLifeEventColor returns fallback when CSS variable is empty", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "",
    } as unknown as CSSStyleDeclaration);

    expect(getLifeEventColor(LifeEventCategory.Family)).toBe(
      LIFE_EVENT_COLORS[LifeEventCategory.Family],
    );
  });

  it("getLifeEventColors returns all categories", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "",
    } as unknown as CSSStyleDeclaration);

    const colors = getLifeEventColors();
    for (const cat of Object.values(LifeEventCategory)) {
      expect(colors[cat]).toBe(LIFE_EVENT_COLORS[cat]);
    }
  });
});
