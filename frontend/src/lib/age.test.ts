import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatAge } from "./age";

describe("formatAge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15)); // June 15, 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current age for a living person", () => {
    expect(formatAge(1990, null)).toBe("36");
  });

  it("returns age at death for a deceased person", () => {
    expect(formatAge(1960, 1995)).toBe("35");
  });

  it("returns null when birth year is null", () => {
    expect(formatAge(null, null)).toBeNull();
    expect(formatAge(null, 2000)).toBeNull();
  });

  it("returns null when birth year is in the future", () => {
    expect(formatAge(2030, null)).toBeNull();
  });

  it("returns '0' when born in the current year", () => {
    expect(formatAge(2026, null)).toBe("0");
  });

  it("returns '0' when birth and death year are the same", () => {
    expect(formatAge(1950, 1950)).toBe("0");
  });

  // Month/day precision tests
  it("returns precise age when birthday has already passed this year", () => {
    // Born March 10, 1990; today is June 15, 2026 -> birthday passed -> age 36
    expect(formatAge(1990, null, 3, 10)).toBe("36");
  });

  it("returns age minus 1 when birthday has not yet passed this year", () => {
    // Born Sept 20, 1990; today is June 15, 2026 -> birthday not passed -> age 35
    expect(formatAge(1990, null, 9, 20)).toBe("35");
  });

  it("returns precise age on exact birthday", () => {
    // Born June 15, 1990; today is June 15, 2026 -> exact birthday -> age 36
    expect(formatAge(1990, null, 6, 15)).toBe("36");
  });

  it("returns precise age at death with full dates", () => {
    // Born March 10, 1960; died Jan 5, 1995 -> birthday not passed in death year -> age 34
    expect(formatAge(1960, 1995, 3, 10, 1, 5)).toBe("34");
  });

  it("returns precise age at death when birthday passed before death", () => {
    // Born March 10, 1960; died June 20, 1995 -> birthday passed -> age 35
    expect(formatAge(1960, 1995, 3, 10, 6, 20)).toBe("35");
  });

  it("falls back to year-only when only month is provided (no day)", () => {
    // Month only, no day -> year-only behavior
    expect(formatAge(1990, null, 9)).toBe("36");
  });

  it("falls back to year-only for deceased with birth month/day but no death month/day", () => {
    // Birth has full date but death only has year -> year-only for death
    expect(formatAge(1960, 1995, 3, 10)).toBe("35");
  });
});
