import { describe, expect, it } from "vitest";
import { DSM_CATEGORIES, getCategoryByKey } from "./dsmCategories";

describe("dsmCategories", () => {
  it("contains 22 major categories", () => {
    expect(DSM_CATEGORIES).toHaveLength(22);
  });

  it("each category has a non-empty key", () => {
    for (const cat of DSM_CATEGORIES) {
      expect(cat.key).toBeTruthy();
      expect(typeof cat.key).toBe("string");
    }
  });

  it("neurodevelopmental has subcategories", () => {
    const neuro = DSM_CATEGORIES.find((c) => c.key === "neurodevelopmental");
    expect(neuro).toBeDefined();
    expect(neuro!.subcategories).toBeDefined();
    expect(neuro!.subcategories!.length).toBeGreaterThan(0);
    expect(neuro!.subcategories).toContain("adhd");
    expect(neuro!.subcategories).toContain("autism");
  });

  it("most categories have no subcategories", () => {
    const withSub = DSM_CATEGORIES.filter((c) => c.subcategories);
    expect(withSub).toHaveLength(1);
  });

  it("getCategoryByKey finds existing category", () => {
    const result = getCategoryByKey("anxiety");
    expect(result).toBeDefined();
    expect(result!.key).toBe("anxiety");
  });

  it("getCategoryByKey returns undefined for unknown key", () => {
    expect(getCategoryByKey("nonexistent")).toBeUndefined();
  });
});
