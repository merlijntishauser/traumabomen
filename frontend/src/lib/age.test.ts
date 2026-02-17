import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatAge } from "./age";

describe("formatAge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1));
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
});
