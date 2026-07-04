import { describe, expect, it, vi } from "vitest";
import { blurOnEnter, sanitizeYearInput } from "./fieldHelpers";

describe("sanitizeYearInput", () => {
  it("strips non-digits", () => {
    expect(sanitizeYearInput("19a7!5")).toBe("1975");
  });

  it("caps at four digits", () => {
    expect(sanitizeYearInput("197512")).toBe("1975");
  });

  it("keeps empty input empty", () => {
    expect(sanitizeYearInput("")).toBe("");
  });
});

describe("blurOnEnter", () => {
  it("blurs the field on Enter", () => {
    const blur = vi.fn();
    blurOnEnter({
      key: "Enter",
      currentTarget: { blur },
    } as unknown as React.KeyboardEvent<HTMLInputElement>);
    expect(blur).toHaveBeenCalledOnce();
  });

  it("ignores other keys", () => {
    const blur = vi.fn();
    blurOnEnter({
      key: "a",
      currentTarget: { blur },
    } as unknown as React.KeyboardEvent<HTMLInputElement>);
    expect(blur).not.toHaveBeenCalled();
  });
});
