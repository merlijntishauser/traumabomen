import type { DecryptedPerson } from "../../hooks/useTreeData";
import { formatAge } from "../../lib/age";
import type { Person } from "../../types/domain";

export interface PersonFormState {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  deathYear: string;
  deathMonth: string;
  deathDay: string;
  causeOfDeath: string;
  gender: string;
  isAdopted: boolean;
  notes: string;
}

export function daysInMonth(month: number): number {
  // Use a non-leap year; Feb = 28, etc.
  return new Date(2001, month, 0).getDate();
}

export function parseOptionalInt(value: string): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

function toStr(value: number | null): string {
  return value != null ? String(value) : "";
}

export function buildPersonDraft(person: DecryptedPerson): PersonFormState {
  return {
    name: person.name,
    birthYear: toStr(person.birth_year),
    birthMonth: toStr(person.birth_month),
    birthDay: toStr(person.birth_day),
    deathYear: toStr(person.death_year),
    deathMonth: toStr(person.death_month),
    deathDay: toStr(person.death_day),
    causeOfDeath: person.cause_of_death ?? "",
    gender: person.gender,
    isAdopted: person.is_adopted,
    notes: person.notes ?? "",
  };
}

/**
 * Serialize the draft for persisting; null when invalid (blank name).
 * Position is carried through from the saved person: the panel must never
 * strip a manually placed node back to auto-layout.
 */
export function buildPersonData(draft: PersonFormState, person: DecryptedPerson): Person | null {
  if (!draft.name.trim()) return null;
  return {
    name: draft.name,
    birth_year: parseOptionalInt(draft.birthYear),
    birth_month: parseOptionalInt(draft.birthMonth),
    birth_day: parseOptionalInt(draft.birthDay),
    death_year: parseOptionalInt(draft.deathYear),
    death_month: parseOptionalInt(draft.deathMonth),
    death_day: parseOptionalInt(draft.deathDay),
    cause_of_death: draft.causeOfDeath || null,
    gender: draft.gender,
    is_adopted: draft.isAdopted,
    notes: draft.notes || null,
    ...(person.position ? { position: person.position } : {}),
  };
}

/** Clearing a year clears its dependent month/day; clearing a month, its day. */
export function withBirthYear(state: PersonFormState, value: string): PersonFormState {
  return {
    ...state,
    birthYear: value,
    birthMonth: value ? state.birthMonth : "",
    birthDay: value ? state.birthDay : "",
  };
}

export function withBirthMonth(state: PersonFormState, value: string): PersonFormState {
  return { ...state, birthMonth: value, birthDay: value ? state.birthDay : "" };
}

export function withDeathYear(state: PersonFormState, value: string): PersonFormState {
  return {
    ...state,
    deathYear: value,
    deathMonth: value ? state.deathMonth : "",
    deathDay: value ? state.deathDay : "",
  };
}

export function withDeathMonth(state: PersonFormState, value: string): PersonFormState {
  return { ...state, deathMonth: value, deathDay: value ? state.deathDay : "" };
}

export function computeAgeHint(state: PersonFormState): { age: string; isDead: boolean } | null {
  const by = parseOptionalInt(state.birthYear);
  if (by == null) return null;
  const dy = parseOptionalInt(state.deathYear);
  const age = formatAge(
    by,
    dy,
    parseOptionalInt(state.birthMonth),
    parseOptionalInt(state.birthDay),
    parseOptionalInt(state.deathMonth),
    parseOptionalInt(state.deathDay),
  );
  if (age == null) return null;
  return { age, isDead: dy != null };
}
