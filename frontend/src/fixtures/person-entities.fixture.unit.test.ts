import { describe, expect, it } from "vitest";
import fixture from "./person-entities.fixture.json";

/**
 * Guards the shared golden fixture (person-entities.fixture.json) that the iOS
 * models round-trip against (mobile/ios/scripts/verify-entities.sh). If the web
 * schema in domain.ts changes, update the expected keys here, the fixture, and
 * the iOS models in lockstep, so neither platform silently drifts.
 */
const EXPECTED_KEYS: Record<string, string[]> = {
  trauma_event: ["title", "description", "category", "approximate_date", "severity", "tags"],
  life_event: ["title", "description", "category", "approximate_date", "impact", "tags"],
  turning_point: ["title", "description", "category", "approximate_date", "significance", "tags"],
  classification: [
    "dsm_category",
    "dsm_subcategory",
    "status",
    "diagnosis_year",
    "periods",
    "notes",
  ],
};

const entries = fixture as unknown as Record<string, Record<string, unknown>>;

describe("person entities golden fixture", () => {
  for (const [key, expected] of Object.entries(EXPECTED_KEYS)) {
    it(`${key} has exactly the domain.ts keys`, () => {
      expect(Object.keys(entries[key]).sort()).toEqual([...expected].sort());
    });
  }

  it("classification periods carry start_year and nullable end_year", () => {
    const period = (entries.classification.periods as Array<Record<string, unknown>>)[0];
    expect(Object.keys(period).sort()).toEqual(["end_year", "start_year"]);
    expect(period.end_year).toBeNull();
  });

  it("nullable fields are present as explicit null, not omitted", () => {
    expect(entries.life_event.impact).toBeNull();
    expect(entries.turning_point.significance).toBeNull();
    expect(entries.classification.notes).toBeNull();
    expect(entries.classification.dsm_subcategory).not.toBeNull();
  });
});
