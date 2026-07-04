import { describe, expect, it } from "vitest";
import type { DecryptedPerson } from "../../hooks/useTreeData";
import {
  buildPersonData,
  buildPersonDraft,
  computeAgeHint,
  daysInMonth,
  parseOptionalInt,
  withBirthMonth,
  withBirthYear,
  withDeathMonth,
  withDeathYear,
} from "./personForm";

function makePerson(overrides: Partial<DecryptedPerson> = {}): DecryptedPerson {
  return {
    id: "p1",
    name: "Alice",
    birth_year: 1960,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    cause_of_death: null,
    gender: "female",
    is_adopted: false,
    notes: null,
    ...overrides,
  };
}

describe("parseOptionalInt", () => {
  it("parses integers", () => {
    expect(parseOptionalInt("1975")).toBe(1975);
  });

  it("returns null for empty string", () => {
    expect(parseOptionalInt("")).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(parseOptionalInt("abc")).toBeNull();
  });
});

describe("daysInMonth", () => {
  it("gives 28 for February (non-leap)", () => {
    expect(daysInMonth(2)).toBe(28);
  });

  it("gives 31 for January", () => {
    expect(daysInMonth(1)).toBe(31);
  });

  it("gives 30 for April", () => {
    expect(daysInMonth(4)).toBe(30);
  });
});

describe("buildPersonDraft", () => {
  it("maps person fields to string draft values", () => {
    const draft = buildPersonDraft(makePerson({ birth_year: 1960, notes: "n" }));
    expect(draft.name).toBe("Alice");
    expect(draft.birthYear).toBe("1960");
    expect(draft.notes).toBe("n");
    expect(draft.deathYear).toBe("");
  });
});

describe("buildPersonData", () => {
  it("round-trips a draft back to person data", () => {
    const person = makePerson({ birth_year: 1960, birth_month: 6, birth_day: 15 });
    const data = buildPersonData(buildPersonDraft(person), person);
    expect(data).toMatchObject({
      name: "Alice",
      birth_year: 1960,
      birth_month: 6,
      birth_day: 15,
      gender: "female",
      is_adopted: false,
      notes: null,
    });
  });

  it("returns null for a blank name", () => {
    const person = makePerson();
    const draft = { ...buildPersonDraft(person), name: "   " };
    expect(buildPersonData(draft, person)).toBeNull();
  });

  it("carries the saved position through", () => {
    const person = makePerson({ position: { x: 5, y: 7 } } as Partial<DecryptedPerson>);
    const data = buildPersonData(buildPersonDraft(person), person);
    expect(data?.position).toEqual({ x: 5, y: 7 });
  });

  it("omits position when the person has none", () => {
    const person = makePerson();
    const data = buildPersonData(buildPersonDraft(person), person);
    expect(data && "position" in data).toBe(false);
  });

  it("normalizes empty optional strings to null", () => {
    const person = makePerson();
    const draft = { ...buildPersonDraft(person), causeOfDeath: "", notes: "" };
    const data = buildPersonData(draft, person);
    expect(data?.cause_of_death).toBeNull();
    expect(data?.notes).toBeNull();
  });
});

describe("dependent field clearing", () => {
  const base = buildPersonDraft(
    makePerson({
      birth_year: 1960,
      birth_month: 6,
      birth_day: 15,
      death_year: 2020,
      death_month: 3,
      death_day: 2,
    }),
  );

  it("clearing birth year clears month and day", () => {
    const next = withBirthYear(base, "");
    expect(next.birthMonth).toBe("");
    expect(next.birthDay).toBe("");
  });

  it("setting birth year keeps month and day", () => {
    const next = withBirthYear(base, "1961");
    expect(next.birthMonth).toBe("6");
    expect(next.birthDay).toBe("15");
  });

  it("clearing birth month clears day", () => {
    const next = withBirthMonth(base, "");
    expect(next.birthDay).toBe("");
  });

  it("clearing death year clears month and day", () => {
    const next = withDeathYear(base, "");
    expect(next.deathMonth).toBe("");
    expect(next.deathDay).toBe("");
  });

  it("clearing death month clears day", () => {
    const next = withDeathMonth(base, "");
    expect(next.deathDay).toBe("");
  });
});

describe("computeAgeHint", () => {
  it("returns null without a birth year", () => {
    expect(computeAgeHint(buildPersonDraft(makePerson({ birth_year: null })))).toBeNull();
  });

  it("computes age at death", () => {
    const hint = computeAgeHint(
      buildPersonDraft(makePerson({ birth_year: 1960, death_year: 2020 })),
    );
    expect(hint).toEqual({ age: "60", isDead: true });
  });
});
