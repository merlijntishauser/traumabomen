import { describe, expect, it } from "vitest";
import { PartnerStatus, withAutoDissolvedPeriods } from "./domain";

describe("withAutoDissolvedPeriods", () => {
  it("appends divorced period when married period has end_year and no successor", () => {
    const result = withAutoDissolvedPeriods([
      { start_year: 1985, end_year: 1995, status: PartnerStatus.Married },
    ]);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      start_year: 1995,
      end_year: null,
      status: PartnerStatus.Divorced,
    });
  });

  it("sets divorced end_year to start of next period", () => {
    const result = withAutoDissolvedPeriods([
      { start_year: 1985, end_year: 1995, status: PartnerStatus.Married },
      { start_year: 2005, end_year: null, status: PartnerStatus.Married },
    ]);
    expect(result).toHaveLength(3);
    expect(result[1]).toEqual({
      start_year: 1995,
      end_year: 2005,
      status: PartnerStatus.Divorced,
    });
  });

  it("does not append divorced period when a subsequent period starts at end_year", () => {
    const result = withAutoDissolvedPeriods([
      { start_year: 1985, end_year: 1995, status: PartnerStatus.Married },
      { start_year: 1995, end_year: null, status: PartnerStatus.Separated },
    ]);
    expect(result).toHaveLength(2);
    expect(result[1].status).toBe(PartnerStatus.Separated);
  });

  it("does not append divorced period when married period has no end_year", () => {
    const result = withAutoDissolvedPeriods([
      { start_year: 1985, end_year: null, status: PartnerStatus.Married },
    ]);
    expect(result).toHaveLength(1);
  });

  it("does not append divorced period for non-married statuses with end_year", () => {
    const result = withAutoDissolvedPeriods([
      { start_year: 1985, end_year: 1990, status: PartnerStatus.Together },
    ]);
    expect(result).toHaveLength(1);
  });

  it("handles multiple married periods with gaps", () => {
    const result = withAutoDissolvedPeriods([
      { start_year: 1985, end_year: 1995, status: PartnerStatus.Married },
      { start_year: 2005, end_year: 2010, status: PartnerStatus.Married },
    ]);
    expect(result).toHaveLength(4);
    expect(result[1]).toEqual({
      start_year: 1995,
      end_year: 2005,
      status: PartnerStatus.Divorced,
    });
    expect(result[3]).toEqual({
      start_year: 2010,
      end_year: null,
      status: PartnerStatus.Divorced,
    });
  });

  it("returns empty array for empty input", () => {
    expect(withAutoDissolvedPeriods([])).toEqual([]);
  });

  it("sorts periods by start_year before processing", () => {
    const result = withAutoDissolvedPeriods([
      { start_year: 1995, end_year: null, status: PartnerStatus.Together },
      { start_year: 1985, end_year: 1995, status: PartnerStatus.Married },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].status).toBe(PartnerStatus.Married);
    expect(result[1].status).toBe(PartnerStatus.Together);
  });

  it("ends divorced period at partner death year", () => {
    const result = withAutoDissolvedPeriods(
      [{ start_year: 1985, end_year: 1995, status: PartnerStatus.Married }],
      { source: null, target: 2010 },
    );
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      start_year: 1995,
      end_year: 2010,
      status: PartnerStatus.Divorced,
    });
  });

  it("uses earliest death year when both partners have death years", () => {
    const result = withAutoDissolvedPeriods(
      [{ start_year: 1985, end_year: 1995, status: PartnerStatus.Married }],
      { source: 2015, target: 2010 },
    );
    expect(result[1].end_year).toBe(2010);
  });

  it("prefers next period start over death year when it comes first", () => {
    const result = withAutoDissolvedPeriods(
      [
        { start_year: 1985, end_year: 1995, status: PartnerStatus.Married },
        { start_year: 2000, end_year: null, status: PartnerStatus.Together },
      ],
      { source: null, target: 2020 },
    );
    expect(result[1].end_year).toBe(2000);
  });

  it("ignores death year before divorce start", () => {
    const result = withAutoDissolvedPeriods(
      [{ start_year: 1985, end_year: 1995, status: PartnerStatus.Married }],
      { source: null, target: 1990 },
    );
    // Death year 1990 is before divorce start 1995, so ignored
    expect(result[1].end_year).toBeNull();
  });

  it("strips and regenerates auto-divorced periods on re-run", () => {
    // Simulate first save: married 1985-1995, auto-divorced 1995-null
    const firstSave = withAutoDissolvedPeriods([
      { start_year: 1985, end_year: 1995, status: PartnerStatus.Married },
    ]);
    expect(firstSave).toHaveLength(2);
    expect(firstSave[1].end_year).toBeNull();

    // Simulate second save: user added a new marriage at 2005
    const secondSave = withAutoDissolvedPeriods([
      ...firstSave,
      { start_year: 2005, end_year: null, status: PartnerStatus.Married },
    ]);
    // Divorced period should now end at 2005
    expect(secondSave).toHaveLength(3);
    expect(secondSave[1]).toEqual({
      start_year: 1995,
      end_year: 2005,
      status: PartnerStatus.Divorced,
    });
    expect(secondSave[2].status).toBe(PartnerStatus.Married);
  });
});
