import { describe, expect, it, vi } from "vitest";
import { TurningPointCategory } from "../types/domain";
import {
  getTurningPointColor,
  getTurningPointColors,
  TURNING_POINT_COLORS,
} from "./turningPointColors";

describe("turningPointColors", () => {
  it("TURNING_POINT_COLORS has an entry for every category", () => {
    for (const cat of Object.values(TurningPointCategory)) {
      expect(TURNING_POINT_COLORS[cat]).toBeDefined();
      expect(TURNING_POINT_COLORS[cat]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("getTurningPointColor returns CSS variable value when available", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => " #00ff00 ",
    } as unknown as CSSStyleDeclaration);

    expect(getTurningPointColor(TurningPointCategory.CycleBreaking)).toBe("#00ff00");
  });

  it("getTurningPointColor returns fallback when CSS variable is empty", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "",
    } as unknown as CSSStyleDeclaration);

    expect(getTurningPointColor(TurningPointCategory.CycleBreaking)).toBe(
      TURNING_POINT_COLORS[TurningPointCategory.CycleBreaking],
    );
  });

  it("getTurningPointColors returns all categories", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "",
    } as unknown as CSSStyleDeclaration);

    const colors = getTurningPointColors();
    for (const cat of Object.values(TurningPointCategory)) {
      expect(colors[cat]).toBe(TURNING_POINT_COLORS[cat]);
    }
  });
});
