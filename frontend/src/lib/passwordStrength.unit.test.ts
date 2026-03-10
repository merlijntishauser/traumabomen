import { describe, expect, it } from "vitest";
import { getPasswordStrength } from "./passwordStrength";

describe("getPasswordStrength", () => {
  it("returns weak for empty string", () => {
    expect(getPasswordStrength("")).toEqual({ score: 0, level: "weak" });
  });

  it("returns weak for password shorter than 8 characters", () => {
    expect(getPasswordStrength("short")).toEqual({ score: 0, level: "weak" });
  });

  it("returns weak for 8 chars single lowercase (score 1)", () => {
    expect(getPasswordStrength("abcdefgh")).toEqual({ score: 1, level: "weak" });
  });

  it("returns weak for 8 chars with mixed case only (score 2)", () => {
    expect(getPasswordStrength("Abcdefgh")).toEqual({ score: 2, level: "weak" });
  });

  it("returns weak for 12 chars single case (score 2)", () => {
    expect(getPasswordStrength("abcdefghijkl")).toEqual({ score: 2, level: "weak" });
  });

  it("returns fair for 8 chars with mixed case and digit (score 3)", () => {
    expect(getPasswordStrength("Abcdefg1")).toEqual({ score: 3, level: "fair" });
  });

  it("returns fair for 12 chars with mixed case (score 3)", () => {
    expect(getPasswordStrength("Abcdefghijkl")).toEqual({ score: 3, level: "fair" });
  });

  it("returns fair for 16+ chars single case (score 3)", () => {
    expect(getPasswordStrength("abcdefghijklmnop")).toEqual({ score: 3, level: "fair" });
  });

  it("returns strong for 16+ chars with mixed case and digit (score 5)", () => {
    expect(getPasswordStrength("Abcdefghijklmno1")).toEqual({ score: 5, level: "strong" });
  });

  it("counts symbols as digit-or-symbol diversity", () => {
    expect(getPasswordStrength("abcdefg!")).toEqual({ score: 2, level: "weak" });
    expect(getPasswordStrength("abcdefghijk!")).toEqual({ score: 3, level: "fair" });
  });

  it("handles max length edge (64 chars)", () => {
    const result = getPasswordStrength(`A1${"a".repeat(62)}`);
    expect(result.level).toBe("strong");
  });

  it("returns strong for 12 chars with mixed case and digit (score 4)", () => {
    expect(getPasswordStrength("Abcdefghij1l")).toEqual({ score: 4, level: "strong" });
  });
});
