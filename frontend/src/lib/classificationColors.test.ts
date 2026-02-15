import { describe, expect, it, vi } from "vitest";
import { getClassificationColor } from "./classificationColors";

describe("classificationColors", () => {
  it("returns CSS variable value for suspected status", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => " #aabb00 ",
    } as unknown as CSSStyleDeclaration);

    expect(getClassificationColor("suspected")).toBe("#aabb00");
  });

  it("returns CSS variable value for diagnosed status", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "#0099ff",
    } as unknown as CSSStyleDeclaration);

    expect(getClassificationColor("diagnosed")).toBe("#0099ff");
  });

  it("returns fallback for suspected when CSS variable is empty", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "",
    } as unknown as CSSStyleDeclaration);

    expect(getClassificationColor("suspected")).toBe("#fbbf24");
  });

  it("returns fallback for diagnosed when CSS variable is empty", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "",
    } as unknown as CSSStyleDeclaration);

    expect(getClassificationColor("diagnosed")).toBe("#38bdf8");
  });
});
