import { describe, expect, it } from "vitest";
import { capPeriodsAtDeath, PartnerStatus, withAutoDissolvedPeriods } from "./domain";

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

  it("caps ongoing marriage at death year", () => {
    const result = withAutoDissolvedPeriods(
      [{ start_year: 1985, end_year: null, status: PartnerStatus.Married }],
      { source: 2010, target: null },
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      start_year: 1985,
      end_year: 2010,
      status: PartnerStatus.Married,
    });
  });

  it("caps ongoing together period at death year", () => {
    const result = withAutoDissolvedPeriods(
      [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
      { source: null, target: 2015 },
    );
    expect(result).toHaveLength(1);
    expect(result[0].end_year).toBe(2015);
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
    // Divorce between periods capped at 2000 (next period start), together capped at 2020 (death)
    expect(result[1].end_year).toBe(2000);
    expect(result[2].end_year).toBe(2020);
  });

  it("caps marriage at death year and removes divorce starting after death", () => {
    const result = withAutoDissolvedPeriods(
      [{ start_year: 1985, end_year: 1995, status: PartnerStatus.Married }],
      { source: null, target: 1990 },
    );
    // Death year 1990 caps the marriage; divorce at 1995 is removed (starts after death)
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      start_year: 1985,
      end_year: 1990,
      status: PartnerStatus.Married,
    });
  });

  it("caps multiple ongoing periods at earliest death year", () => {
    const result = withAutoDissolvedPeriods(
      [
        { start_year: 1985, end_year: 1995, status: PartnerStatus.Married },
        { start_year: 1995, end_year: null, status: PartnerStatus.Divorced },
      ],
      { source: 2020, target: 2010 },
    );
    // Divorced period should be capped at 2010 (earliest death)
    expect(result[1].end_year).toBe(2010);
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

describe("capPeriodsAtDeath", () => {
  it("returns periods unchanged when no death years provided", () => {
    const periods = [{ start_year: 1985, end_year: null, status: PartnerStatus.Married }];
    expect(capPeriodsAtDeath(periods)).toEqual(periods);
  });

  it("returns periods unchanged when both death years are null", () => {
    const periods = [{ start_year: 1985, end_year: null, status: PartnerStatus.Married }];
    expect(capPeriodsAtDeath(periods, { source: null, target: null })).toEqual(periods);
  });

  it("caps ongoing period at death year", () => {
    const result = capPeriodsAtDeath(
      [{ start_year: 1985, end_year: null, status: PartnerStatus.Married }],
      { source: 2010, target: null },
    );
    expect(result[0].end_year).toBe(2010);
  });

  it("caps period extending beyond death year", () => {
    const result = capPeriodsAtDeath(
      [{ start_year: 1985, end_year: 2020, status: PartnerStatus.Married }],
      { source: null, target: 2010 },
    );
    expect(result[0].end_year).toBe(2010);
  });

  it("removes periods starting after death year", () => {
    const result = capPeriodsAtDeath(
      [
        { start_year: 1985, end_year: 1995, status: PartnerStatus.Married },
        { start_year: 2000, end_year: null, status: PartnerStatus.Together },
      ],
      { source: 1990, target: null },
    );
    expect(result).toHaveLength(1);
    expect(result[0].end_year).toBe(1990);
  });

  it("uses earliest death year of both partners", () => {
    const result = capPeriodsAtDeath(
      [{ start_year: 1985, end_year: null, status: PartnerStatus.Together }],
      { source: 2020, target: 2010 },
    );
    expect(result[0].end_year).toBe(2010);
  });

  it("does not modify periods ending before death year", () => {
    const result = capPeriodsAtDeath(
      [{ start_year: 1985, end_year: 1995, status: PartnerStatus.Married }],
      { source: null, target: 2010 },
    );
    expect(result[0].end_year).toBe(1995);
  });
});
