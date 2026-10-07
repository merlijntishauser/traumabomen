import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { dateReadingSentence } from "./dateReadingSentence";

const t = ((key: string, opts?: Record<string, unknown>) =>
  opts ? `${key}(${Object.values(opts).join("|")})` : key) as unknown as TFunction;

const harold = { name: "Harold Whitfield", birthYear: 1932 };
const dorothy = { name: "Dorothy Whitfield", birthYear: 1935 };
const say = (text: string, people = [harold]) => dateReadingSentence(text, people, t, "en");

describe("dateReadingSentence", () => {
  it("says nothing for an empty field", () => {
    expect(say("  ")).toBeNull();
  });

  it("says when there is nothing to place", () => {
    expect(say("after the war")).toBe("dateHint.none");
  });

  it("reads a year with each person's age", () => {
    expect(say("1944", [harold, dorothy])).toBe(
      "dateHint.readsWhen(1944|dateHint.personAge(Harold|12) and dateHint.personAge(Dorothy|9))",
    );
  });

  it("reads a range and an approximate year", () => {
    expect(say("1940-1945")).toBe(
      "dateHint.readsWhen(dateHint.range(1940|1945)|dateHint.personAge(Harold|dateHint.range(8|13)))",
    );
    expect(say("about 1944", [])).toBe("dateHint.reads(dateHint.about(1944))");
  });

  it("reads ages and stages of life as each person's own years", () => {
    expect(say("as a child")).toBe(
      "dateHint.readsFor(dateHint.ages(0|12)|dateHint.yearsFor(dateHint.range(1932|1944)|Harold))",
    );
    expect(say("at 12")).toBe("dateHint.readsFor(dateHint.age(12)|dateHint.yearsFor(1944|Harold))");
    expect(say("in old age")).toBe(
      "dateHint.readsFor(dateHint.fromAge(65)|dateHint.yearsFor(dateHint.fromYear(1997)|Harold))",
    );
  });

  it("asks for a birth year when an age cannot be placed", () => {
    expect(say("as a child", [{ name: "Ada", birthYear: null }])).toBe(
      "dateHint.needsBirth(dateHint.ages(0|12))",
    );
    expect(say("'85", [])).toBe("dateHint.needsBirth('85)");
  });

  it("reads two-digit years against the birth year", () => {
    expect(say("'63-'70")).toBe(
      "dateHint.readsFor('63-'70|dateHint.yearsFor(dateHint.range(1963|1970)|Harold))",
    );
  });

  it("names three people and counts the rest", () => {
    const many = ["Ada", "Ben", "Cas", "Dirk", "Eva"].map((name) => ({ name, birthYear: 1930 }));
    expect(say("1940", many)).toContain("dateHint.more(2)");
  });
});
