import { describe, expect, it } from "vitest";
import { placeForPeople, readDate, yearsFor } from "./dateReading";

const years = (from: number, to = from, approx = false) => ({ kind: "years", from, to, approx });
const ages = (from: number, to = from) => ({ kind: "ages", from, to });

describe("readDate: calendar years", () => {
  it.each([
    ["1997", years(1997)],
    ["1963-1970", years(1963, 1970)],
    ["1963 – 1970", years(1963, 1970)],
    ["1970-1963", years(1970)],
    ["about 1965", years(1965, 1965, true)],
    ["rond 1965", years(1965, 1965, true)],
    ["~1965", years(1965, 1965, true)],
    ["1965?", years(1965, 1965, true)],
    ["summer 1965", years(1965)],
    ["1960s", years(1960, 1969, true)],
    ["at 1997", years(1997)],
  ])("%s", (text, expected) => {
    expect(readDate(text)).toEqual(expected);
  });
});

describe("readDate: decades in words", () => {
  it.each([
    ["the sixties", years(1960, 1969, true)],
    ["in the 60s", years(1960, 1969, true)],
    ["the '60s", years(1960, 1969, true)],
    ["jaren 60", years(1960, 1969, true)],
    ["in de jaren '60", years(1960, 1969, true)],
    ["jaren zestig", years(1960, 1969, true)],
    ["the 10s", years(2010, 2019, true)],
  ])("%s", (text, expected) => {
    expect(readDate(text)).toEqual(expected);
  });
});

describe("readDate: ages", () => {
  it.each([
    ["at 12", ages(12)],
    ["at age 12", ages(12)],
    ["at the age of 12", ages(12)],
    ["aged 12-15", ages(12, 15)],
    ["between 12 and 15", ages(12, 15)],
    ["12 years old", ages(12)],
    ["12 jaar oud", ages(12)],
    ["op haar 12e", ages(12)],
    ["op 12-jarige leeftijd", ages(12)],
    ["toen ze 12 was", ages(12)],
    ["toen hij 12 jaar was", ages(12)],
    ["when she was 12", ages(12)],
  ])("%s", (text, expected) => {
    expect(readDate(text)).toEqual(expected);
  });

  it("ignores impossible ages", () => {
    expect(readDate("at 140")).toBeNull();
    expect(readDate("aged 15-12")).toBeNull();
  });
});

describe("readDate: stages of life", () => {
  it.each([
    ["as a baby", ages(0, 1)],
    ["als peuter", ages(1, 3)],
    ["kleutertijd", ages(3, 6)],
    ["in primary school", ages(4, 12)],
    ["op de basisschool", ages(4, 12)],
    ["as a child", ages(0, 12)],
    ["in her childhood", ages(0, 12)],
    ["als kind", ages(0, 12)],
    ["when he was little", ages(0, 12)],
    ["toen ze klein was", ages(0, 12)],
    ["in zijn jeugd", ages(0, 18)],
    ["as a teenager", ages(13, 19)],
    ["in his teens", ages(13, 19)],
    ["puberteit", ages(13, 19)],
    ["in high school", ages(12, 18)],
    ["at university", ages(18, 23)],
    ["studententijd", ages(18, 23)],
    ["young adulthood", ages(18, 25)],
    ["in her twenties", ages(20, 29)],
    ["during their 30s", ages(30, 39)],
    ["in de veertig", ages(40, 49)],
    ["als dertiger", ages(30, 39)],
    ["middle-aged", ages(40, 60)],
    ["middelbare leeftijd", ages(40, 60)],
    ["in old age", ages(65, 110)],
    ["op oudere leeftijd", ages(65, 110)],
  ])("%s", (text, expected) => {
    expect(readDate(text)).toEqual(expected);
  });

  it("does not read someone else's baby as the person's infancy", () => {
    expect(readDate("when she had a baby")).toBeNull();
  });
});

describe("readDate: two-digit years and nothing", () => {
  it("reads apostrophe years, alone or as a range", () => {
    expect(readDate("summer of '85")).toEqual({ kind: "short", from: 85, to: 85 });
    expect(readDate("’63–’70")).toEqual({ kind: "short", from: 63, to: 70 });
  });

  it("returns null when there is nothing to place", () => {
    expect(readDate("")).toBeNull();
    expect(readDate("   ")).toBeNull();
    expect(readDate(null)).toBeNull();
    expect(readDate("after the war")).toBeNull();
  });
});

describe("yearsFor", () => {
  it("keeps calendar years whoever they belong to", () => {
    expect(yearsFor(years(1997), null)).toEqual({ from: 1997, to: 1997, approx: false });
  });

  it("places ages and stages from the birth year, always as approximate", () => {
    expect(yearsFor(ages(0, 12), 1958)).toEqual({ from: 1958, to: 1970, approx: true });
    expect(yearsFor(ages(12), null)).toBeNull();
  });

  it("puts two-digit years in the first matching year after birth", () => {
    expect(yearsFor({ kind: "short", from: 85, to: 85 }, 1960)).toEqual({
      from: 1985,
      to: 1985,
      approx: false,
    });
    expect(yearsFor({ kind: "short", from: 5, to: 5 }, 1960)).toEqual({
      from: 2005,
      to: 2005,
      approx: false,
    });
    expect(yearsFor({ kind: "short", from: 98, to: 3 }, 1960)).toEqual({
      from: 1998,
      to: 2003,
      approx: false,
    });
    expect(yearsFor({ kind: "short", from: 85, to: 85 }, null)).toBeNull();
  });
});

describe("placeForPeople", () => {
  const people = [
    { name: "Harold", birthYear: 1932 },
    { name: "Emma", birthYear: 2014 },
    { name: "Ada", birthYear: null },
  ];

  it("gives each person's age for a calendar date, leaving out the unborn and unknown", () => {
    expect(placeForPeople(years(1944), people)).toEqual([{ name: "Harold", from: 12, to: 12 }]);
    expect(placeForPeople(years(1930, 1945), people)).toEqual([
      { name: "Harold", from: 0, to: 13 },
    ]);
  });

  it("gives each person's years for an age, leaving out those without a birth year", () => {
    expect(placeForPeople(ages(0, 12), people)).toEqual([
      { name: "Harold", from: 1932, to: 1944 },
      { name: "Emma", from: 2014, to: 2026 },
    ]);
    expect(placeForPeople({ kind: "short", from: 85, to: 85 }, [people[2]])).toEqual([]);
  });
});
