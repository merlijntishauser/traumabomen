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

  it("each category has a code", () => {
    for (const cat of DSM_CATEGORIES) {
      expect(cat.code).toBeTruthy();
      expect(typeof cat.code).toBe("string");
    }
  });

  it("neurodevelopmental has subcategories with object shape", () => {
    const neuro = DSM_CATEGORIES.find((c) => c.key === "neurodevelopmental");
    expect(neuro).toBeDefined();
    expect(neuro!.subcategories).toBeDefined();
    expect(neuro!.subcategories!.length).toBeGreaterThan(0);
    const adhd = neuro!.subcategories!.find((s) => s.key === "adhd");
    expect(adhd).toBeDefined();
    expect(adhd!.code).toBe("F90");
    const autism = neuro!.subcategories!.find((s) => s.key === "autism");
    expect(autism).toBeDefined();
    expect(autism!.code).toBe("F84");
  });

  it("15 categories have subcategories", () => {
    const withSub = DSM_CATEGORIES.filter((c) => c.subcategories);
    expect(withSub).toHaveLength(15);
  });

  it("7 categories have no subcategories", () => {
    const withoutSub = DSM_CATEGORIES.filter((c) => !c.subcategories);
    expect(withoutSub).toHaveLength(7);
    const keys = withoutSub.map((c) => c.key);
    expect(keys).toContain("elimination");
    expect(keys).toContain("sexual_dysfunction");
    expect(keys).toContain("gender_dysphoria");
    expect(keys).toContain("paraphilic");
    expect(keys).toContain("other_mental");
    expect(keys).toContain("medication_induced");
    expect(keys).toContain("other_conditions");
  });

  it("all subcategories have key and code strings", () => {
    for (const cat of DSM_CATEGORIES) {
      if (!cat.subcategories) continue;
      for (const sub of cat.subcategories) {
        expect(sub.key).toBeTruthy();
        expect(typeof sub.key).toBe("string");
        expect(sub.code).toBeTruthy();
        expect(typeof sub.code).toBe("string");
      }
    }
  });

  it("subcategory codes start with a letter", () => {
    for (const cat of DSM_CATEGORIES) {
      if (!cat.subcategories) continue;
      for (const sub of cat.subcategories) {
        expect(sub.code).toMatch(/^[A-Z]/);
      }
    }
  });

  it("has no duplicate subcategory keys across all categories", () => {
    const allKeys: string[] = [];
    for (const cat of DSM_CATEGORIES) {
      if (!cat.subcategories) continue;
      for (const sub of cat.subcategories) {
        allKeys.push(sub.key);
      }
    }
    expect(new Set(allKeys).size).toBe(allKeys.length);
  });

  it("getCategoryByKey finds existing category", () => {
    const result = getCategoryByKey("anxiety");
    expect(result).toBeDefined();
    expect(result!.key).toBe("anxiety");
    expect(result!.code).toBe("F40-F41");
  });

  it("getCategoryByKey returns undefined for unknown key", () => {
    expect(getCategoryByKey("nonexistent")).toBeUndefined();
  });
});
