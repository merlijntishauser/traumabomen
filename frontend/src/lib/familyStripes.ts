import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../hooks/useTreeData";
import { type DateReading, readDate, yearsFor } from "./dateReading";

/**
 * The timeline as family stripes: every life is one band of whole-year cells,
 * read one year (or one age) at a time. These helpers are pure so the layout,
 * date and reading rules are testable without rendering.
 */

export type StripeKind = "trauma_event" | "life_event" | "classification" | "turning_point";
export type StripeMode = "years" | "age";

export interface YearSpan {
  from: number;
  to: number;
}

export interface StripeEntry {
  id: string;
  kind: StripeKind;
  /** Trauma, life event and turning point category; classification status. */
  category: string;
  title: string;
  personIds: string[];
  spans: YearSpan[];
  approx: boolean;
  /** Set when the date is read per person; spans are then filled in per person. */
  relative?: RelativeDate;
}

export interface StripeRow {
  person: DecryptedPerson;
  generation: number;
  born: number;
  last: number;
  /** No death year and too old to still be living: the end of the band is a guess. */
  endUnknown: boolean;
}

export interface StripeLayout {
  /** Rows grouped by generation, oldest generation first, then by birth year. */
  generations: { generation: number; rows: StripeRow[] }[];
  rows: StripeRow[];
  /** People who cannot be placed: no birth year. */
  unplaced: DecryptedPerson[];
}

/** Oldest age a person without a death year is still drawn as living. */
const MAX_LIVING_AGE = 105;
/** Where a band ends when the death year is unknown and the person cannot be living. */
const ASSUMED_LIFESPAN = 80;

/**
 * An entry dated by age, stage of life, or a two-digit year: its spans differ
 * per person, so they are filled in from each birth year (see entriesByPerson).
 */
export type RelativeDate = Exclude<DateReading, { kind: "years" }>;

function datedEntry(
  id: string,
  kind: StripeKind,
  category: string,
  title: string,
  personIds: string[],
  date: string,
): StripeEntry | null {
  const reading = readDate(date);
  if (!reading) return null;
  const base = { id, kind, category, title, personIds };
  if (reading.kind === "years") {
    return { ...base, spans: [{ from: reading.from, to: reading.to }], approx: reading.approx };
  }
  return { ...base, spans: [], approx: reading.kind === "ages", relative: reading };
}

function classificationSpans(cls: DecryptedClassification, now: number): YearSpan[] {
  if (cls.periods.length > 0) {
    return cls.periods.map((p) => ({ from: p.start_year, to: p.end_year ?? now }));
  }
  if (cls.diagnosis_year != null) return [{ from: cls.diagnosis_year, to: now }];
  return [];
}

export interface StripeSources {
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  classifications: Map<string, DecryptedClassification>;
  turningPoints: Map<string, DecryptedTurningPoint>;
}

/** Every dated entry, as stripes. Classification titles come from the caller (they are translated). */
export function buildStripeEntries(
  sources: StripeSources,
  classificationTitle: (cls: DecryptedClassification) => string,
  now: number,
): StripeEntry[] {
  const out: StripeEntry[] = [];
  const push = (entry: StripeEntry | null) => {
    if (entry) out.push(entry);
  };
  for (const e of sources.events.values()) {
    push(datedEntry(e.id, "trauma_event", e.category, e.title, e.person_ids, e.approximate_date));
  }
  for (const e of sources.lifeEvents.values()) {
    push(datedEntry(e.id, "life_event", e.category, e.title, e.person_ids, e.approximate_date));
  }
  for (const e of sources.turningPoints.values()) {
    push(datedEntry(e.id, "turning_point", e.category, e.title, e.person_ids, e.approximate_date));
  }
  for (const c of sources.classifications.values()) {
    const spans = classificationSpans(c, now);
    if (spans.length === 0) continue;
    out.push({
      id: c.id,
      kind: "classification",
      category: c.status,
      title: classificationTitle(c),
      personIds: c.person_ids,
      spans,
      approx: false,
    });
  }
  return out;
}

/** An entry the stripes cannot place: its date has no year to read. */
export interface UndatedEntry {
  id: string;
  kind: StripeKind;
  personIds: string[];
}

/**
 * Every entry left off the stripes because it has no year, so the view can
 * say so instead of reading a person's life as quieter than it was.
 */
export function undatedEntries(sources: StripeSources): UndatedEntry[] {
  const out: UndatedEntry[] = [];
  const check = (id: string, kind: StripeKind, personIds: string[], date: string) => {
    if (!readDate(date)) out.push({ id, kind, personIds });
  };
  for (const e of sources.events.values())
    check(e.id, "trauma_event", e.person_ids, e.approximate_date);
  for (const e of sources.lifeEvents.values())
    check(e.id, "life_event", e.person_ids, e.approximate_date);
  for (const e of sources.turningPoints.values()) {
    check(e.id, "turning_point", e.person_ids, e.approximate_date);
  }
  for (const c of sources.classifications.values()) {
    if (c.periods.length === 0 && c.diagnosis_year == null) {
      out.push({ id: c.id, kind: "classification", personIds: c.person_ids });
    }
  }
  return out;
}

/** Each person's undated entries. */
export function undatedByPerson(undated: UndatedEntry[]): Map<string, UndatedEntry[]> {
  const byPerson = new Map<string, UndatedEntry[]>();
  for (const e of undated) {
    for (const id of e.personIds) {
      const list = byPerson.get(id) ?? [];
      list.push(e);
      byPerson.set(id, list);
    }
  }
  return byPerson;
}

/** The last year a life is drawn to. */
export function lastYearOf(
  person: DecryptedPerson,
  now: number,
): { last: number; endUnknown: boolean } {
  const born = person.birth_year as number;
  if (person.death_year != null) return { last: person.death_year, endUnknown: false };
  if (now - born <= MAX_LIVING_AGE) return { last: now, endUnknown: false };
  return { last: born + ASSUMED_LIFESPAN, endUnknown: true };
}

export function buildStripeLayout(
  persons: Map<string, DecryptedPerson>,
  generations: Map<string, number>,
  now: number,
): StripeLayout {
  const unplaced: DecryptedPerson[] = [];
  const byGen = new Map<number, StripeRow[]>();
  for (const person of persons.values()) {
    if (person.birth_year == null) {
      unplaced.push(person);
      continue;
    }
    const generation = generations.get(person.id) ?? 0;
    const { last, endUnknown } = lastYearOf(person, now);
    const list = byGen.get(generation) ?? [];
    list.push({ person, generation, born: person.birth_year, last, endUnknown });
    byGen.set(generation, list);
  }
  const groups = Array.from(byGen.entries())
    .toSorted(([a], [b]) => a - b)
    .map(([generation, rows]) => ({
      generation,
      rows: rows.sort((a, b) => a.born - b.born || a.person.name.localeCompare(b.person.name)),
    }));
  unplaced.sort((a, b) => a.name.localeCompare(b.name));
  return { generations: groups, rows: groups.flatMap((g) => g.rows), unplaced };
}

/** First year of the years ruler: a decade boundary before the earliest birth. */
export function yearDomainStart(rows: StripeRow[], now: number): number {
  const earliest = rows.reduce((min, r) => Math.min(min, r.born), now);
  return Math.floor((earliest - 1) / 10) * 10;
}

/** Ages shown in age mode: the oldest age anyone reached, plus room, rounded to a decade. */
export function ageDomainSpan(rows: StripeRow[]): number {
  const oldest = rows.reduce((max, r) => Math.max(max, r.last - r.born), 0);
  return Math.max(30, Math.ceil((oldest + 6) / 10) * 10);
}

export function coversYear(entry: StripeEntry, year: number): boolean {
  return entry.spans.some((s) => year >= s.from && year <= s.to);
}

/** Each person's entries, looked up once instead of scanned per row or year. */
export function entriesByPerson(
  rows: StripeRow[],
  entries: StripeEntry[],
): Map<string, StripeEntry[]> {
  const born = new Map(rows.map((r) => [r.person.id, r.born]));
  const byPerson = new Map<string, StripeEntry[]>(rows.map((r) => [r.person.id, []]));
  for (const e of entries) {
    for (const id of e.personIds) {
      const list = byPerson.get(id);
      if (!list) continue;
      if (!e.relative) {
        list.push(e);
        continue;
      }
      // Ages and two-digit years become this person's own calendar years.
      const years = yearsFor(e.relative, born.get(id) ?? null);
      if (years) list.push({ ...e, spans: [{ from: years.from, to: years.to }] });
    }
  }
  return byPerson;
}

export interface TraumaRun {
  start: number;
  end: number;
  entries: StripeEntry[];
}

/** Consecutive years with the same set of trauma events, clipped to a life. */
export function traumaRuns(entries: StripeEntry[], born: number, last: number): TraumaRun[] {
  const traumas = entries.filter((e) => e.kind === "trauma_event");
  const runs: TraumaRun[] = [];
  let current: (TraumaRun & { key: string }) | null = null;
  for (let year = born; year <= last; year++) {
    const here = traumas.filter((e) => coversYear(e, year));
    const key = here.map((e) => e.id).join(",");
    if (current && current.key === key) {
      current.end = year;
      continue;
    }
    if (current && current.entries.length) runs.push(current);
    current = { key, start: year, end: year, entries: here };
  }
  if (current && current.entries.length) runs.push(current);
  return runs.map(({ start, end, entries: list }) => ({ start, end, entries: list }));
}

/** A span clipped to a life, or null when it falls outside it. */
export function clipSpan(span: YearSpan, born: number, last: number): YearSpan | null {
  const from = Math.max(span.from, born);
  const to = Math.min(span.to, last);
  return to < from ? null : { from, to };
}

/* -- Reading a year or an age ------------------------------------------------ */

export interface ReadingBlock {
  people: StripeRow[];
  /** Year each person was in (equal for all people in years mode). */
  years: number[];
  entries: StripeEntry[];
}

export interface Reading {
  blocks: ReadingBlock[];
  quiet: StripeRow[];
  notYet: StripeRow[];
  gone: StripeRow[];
}

function yearFor(row: StripeRow, mode: StripeMode, value: number): number {
  return mode === "years" ? value : row.born + value;
}

/**
 * What one year (or one age) held for everyone. In years mode, people whose
 * year held exactly the same entries share one block.
 */
export function readAt(
  rows: StripeRow[],
  entries: StripeEntry[],
  mode: StripeMode,
  value: number,
  now: number,
): Reading {
  const reading: Reading = { blocks: [], quiet: [], notYet: [], gone: [] };
  const byKey = new Map<string, ReadingBlock>();
  const byPerson = entriesByPerson(rows, entries);
  for (const row of rows) {
    const year = yearFor(row, mode, value);
    if (year < row.born || year > now) {
      reading.notYet.push(row);
      continue;
    }
    if (year > row.last) {
      reading.gone.push(row);
      continue;
    }
    const held = (byPerson.get(row.person.id) ?? []).filter((e) => coversYear(e, year));
    if (held.length === 0) {
      reading.quiet.push(row);
      continue;
    }
    const key = held.map((e) => e.id).join(",");
    const shared = mode === "years" ? byKey.get(key) : undefined;
    if (shared) {
      shared.people.push(row);
      shared.years.push(year);
      continue;
    }
    const block = { people: [row], years: [year], entries: held };
    byKey.set(key, block);
    reading.blocks.push(block);
  }
  return reading;
}

/** The year (or age) to open on: the one that holds the most, latest on a tie. */
export function busiestValue(
  rows: StripeRow[],
  entries: StripeEntry[],
  mode: StripeMode,
  min: number,
  max: number,
  now: number,
): number {
  const byPerson = entriesByPerson(rows, entries);
  let best = max;
  let bestWeight = -1;
  for (let v = min; v <= max; v++) {
    let weight = 0;
    for (const row of rows) {
      const year = yearFor(row, mode, v);
      if (year < row.born || year > Math.min(row.last, now)) continue;
      for (const e of byPerson.get(row.person.id) ?? []) if (coversYear(e, year)) weight++;
    }
    if (weight >= bestWeight) {
      best = v;
      bestWeight = weight;
    }
  }
  return best;
}

/* -- Highlighting ------------------------------------------------------------ */

/** Key-item identifiers, kind and category: "trauma_event:loss", "turning_point:recovery"; plus "approx". */
export function keyOf(entry: Pick<StripeEntry, "kind" | "category">): string {
  return `${entry.kind}:${entry.category}`;
}

function normalTitle(title: string): string {
  return title.trim().toLocaleLowerCase();
}

/** An entry lights up together with every entry of the same title. */
export function matchEntry(entries: StripeEntry[], id: string): Set<string> {
  const lit = new Set<string>();
  const source = entries.find((e) => e.id === id);
  if (!source) return lit;
  const title = normalTitle(source.title);
  for (const e of entries) if (normalTitle(e.title) === title) lit.add(e.id);
  return lit;
}

/** A key item lights up every entry it describes. */
export function matchKey(entries: StripeEntry[], key: string): Set<string> {
  const lit = new Set<string>();
  for (const e of entries) if (key === "approx" ? e.approx : keyOf(e) === key) lit.add(e.id);
  return lit;
}

/** The theme variable an entry is drawn in, so a theme switch repaints without a re-render. */
export function stripeColor(entry: Pick<StripeEntry, "kind" | "category">): string {
  const category = entry.category.replace(/_/g, "-");
  switch (entry.kind) {
    case "trauma_event":
      return `var(--color-trauma-${category})`;
    case "life_event":
      return `var(--color-life-${category})`;
    case "classification":
      return `var(--color-classification-${category})`;
    case "turning_point":
      return `var(--color-tp-${category})`;
  }
}

/** The span of an entry that covers a year, or its first span. */
export function spanAt(entry: StripeEntry, year: number): YearSpan {
  return entry.spans.find((s) => year >= s.from && year <= s.to) ?? entry.spans[0];
}

/** Several people share one surname: "Sophie and Lucas Porter" instead of repeating it. */
export function sharedSurname(names: string[]): string | null {
  if (names.length < 2) return null;
  const surnames = names.map((n) => n.trim().split(/\s+/).slice(1).join(" "));
  return surnames[0] && surnames.every((s) => s === surnames[0]) ? surnames[0] : null;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
