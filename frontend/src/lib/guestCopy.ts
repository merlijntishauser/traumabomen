import {
  type ClassificationPeriod,
  type ClassificationStatus,
  LifeEventCategory,
  type LinkedEntity,
  PartnerStatus,
  type RelationshipPeriod,
  RelationshipType,
  type SiblingGroupMember,
  TraumaCategory,
  TurningPointCategory,
} from "../types/domain";
import { DSM_CATEGORIES } from "./dsmCategories";
import { PATTERN_COLORS } from "./patternColors";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedSiblingGroup,
  DecryptedTurningPoint,
  TreeEntityMaps,
} from "./treeEntities";

/*
 * The guest copy: one tree as a single JSON document, published by the owner
 * and opened by someone without an account. The builder projects every entity
 * through an explicit field list, so a field added to the app later is not
 * published by accident, and the journal has no place in it at all.
 *
 * The parser treats a decrypted copy as untrusted input (any account holder
 * can craft one, and /view shares the app's origin): it checks the version,
 * every key, type, enum, colour, length, count and reference, and rejects the
 * whole copy on any mismatch. Error messages name the path only, never data.
 */

export const GUEST_COPY_VERSION = 1;

export type GuestCopyLanguage = "en" | "nl";

export interface GuestCopy {
  version: typeof GUEST_COPY_VERSION;
  publishedAt: string;
  language: GuestCopyLanguage;
  treeName: string;
  persons: DecryptedPerson[];
  relationships: DecryptedRelationship[];
  events: DecryptedEvent[];
  lifeEvents: DecryptedLifeEvent[];
  turningPoints: DecryptedTurningPoint[];
  classifications: DecryptedClassification[];
  patterns: DecryptedPattern[];
  siblingGroups: DecryptedSiblingGroup[];
}

/** What a copy is built from: the owner's freshly fetched, decrypted tree. */
export type GuestCopyInput = TreeEntityMaps;

/** What the guest views render from: the same maps as the public demo. */
export type GuestTreeState = TreeEntityMaps;

export class GuestCopyError extends Error {
  constructor(message = "Invalid guest copy.") {
    super(message);
    this.name = "GuestCopyError";
  }
}

// ---- Field lists --------------------------------------------------------

type MissingKeys<T, K extends readonly (keyof T)[]> = Exclude<keyof T, K[number]>;

/**
 * Declares the complete field list of a shape: leaving a field of `T` out is a
 * compile error, so a new field has to be placed in (or deliberately kept out
 * of) the copy by changing `T`'s list here.
 */
function fieldsOf<T>() {
  return <const K extends readonly (keyof T)[]>(
    keys: K & (MissingKeys<T, K> extends never ? unknown : { missing: MissingKeys<T, K> }),
  ): K => keys;
}

type Position = { x: number; y: number };
type ActivePeriod = NonNullable<DecryptedRelationship["active_period"]>;

const POSITION_FIELDS = fieldsOf<Position>()(["x", "y"]);
const PERSON_FIELDS = fieldsOf<DecryptedPerson>()([
  "id",
  "name",
  "birth_year",
  "birth_month",
  "birth_day",
  "death_year",
  "death_month",
  "death_day",
  "cause_of_death",
  "gender",
  "is_adopted",
  "notes",
  "position",
]);
const RELATIONSHIP_FIELDS = fieldsOf<DecryptedRelationship>()([
  "id",
  "source_person_id",
  "target_person_id",
  "type",
  "periods",
  "active_period",
]);
const PARTNER_PERIOD_FIELDS = fieldsOf<RelationshipPeriod>()(["start_year", "end_year", "status"]);
const ACTIVE_PERIOD_FIELDS = fieldsOf<ActivePeriod>()(["start_year", "end_year"]);
const EVENT_FIELDS = fieldsOf<DecryptedEvent>()([
  "id",
  "person_ids",
  "title",
  "description",
  "category",
  "approximate_date",
  "severity",
  "tags",
]);
const LIFE_EVENT_FIELDS = fieldsOf<DecryptedLifeEvent>()([
  "id",
  "person_ids",
  "title",
  "description",
  "category",
  "approximate_date",
  "impact",
  "tags",
]);
const TURNING_POINT_FIELDS = fieldsOf<DecryptedTurningPoint>()([
  "id",
  "person_ids",
  "title",
  "description",
  "category",
  "approximate_date",
  "significance",
  "tags",
]);
const CLASSIFICATION_FIELDS = fieldsOf<DecryptedClassification>()([
  "id",
  "person_ids",
  "dsm_category",
  "dsm_subcategory",
  "status",
  "diagnosis_year",
  "periods",
  "notes",
]);
const CLASSIFICATION_PERIOD_FIELDS = fieldsOf<ClassificationPeriod>()(["start_year", "end_year"]);
const PATTERN_FIELDS = fieldsOf<DecryptedPattern>()([
  "id",
  "person_ids",
  "name",
  "description",
  "color",
  "linked_entities",
]);
const LINKED_ENTITY_FIELDS = fieldsOf<LinkedEntity>()(["entity_type", "entity_id"]);
const SIBLING_GROUP_FIELDS = fieldsOf<DecryptedSiblingGroup>()([
  "id",
  "person_ids",
  "members",
  "position",
]);
const MEMBER_FIELDS = fieldsOf<SiblingGroupMember>()([
  "name",
  "birth_year",
  "gender",
  "death_year",
]);

const COPY_FIELDS = fieldsOf<GuestCopy>()([
  "version",
  "publishedAt",
  "language",
  "treeName",
  "persons",
  "relationships",
  "events",
  "lifeEvents",
  "turningPoints",
  "classifications",
  "patterns",
  "siblingGroups",
]);

/** Fields a shape may leave out; every other field is required, null or not. */
const OPTIONAL_PERSON_FIELDS = ["position"] as const;
const OPTIONAL_SIBLING_GROUP_FIELDS = ["position"] as const;
const OPTIONAL_MEMBER_FIELDS = ["gender", "death_year"] as const;

// ---- Building -----------------------------------------------------------

/**
 * Copy only the listed fields. A missing field becomes null (old records may
 * predate a nullable field), except optional ones, which stay absent.
 */
function pick<T, K extends keyof T>(src: T, keys: readonly K[], optional: readonly K[] = []): T {
  const out: Partial<Record<K, unknown>> = {};
  const mayBeAbsent = new Set<K>(optional);
  for (const key of keys) {
    const value = src[key];
    if (value !== undefined) out[key] = value;
    else if (!mayBeAbsent.has(key)) out[key] = null;
  }
  return out as T;
}

function pickPosition<T extends { position?: Position }>(projected: T): T {
  if (projected.position) projected.position = pick(projected.position, POSITION_FIELDS);
  return projected;
}

function projectPerson(p: DecryptedPerson): DecryptedPerson {
  return pickPosition(pick(p, PERSON_FIELDS, OPTIONAL_PERSON_FIELDS));
}

function projectRelationship(r: DecryptedRelationship): DecryptedRelationship {
  const out = pick(r, RELATIONSHIP_FIELDS);
  out.periods = (r.periods ?? []).map((period) => pick(period, PARTNER_PERIOD_FIELDS));
  out.active_period = r.active_period ? pick(r.active_period, ACTIVE_PERIOD_FIELDS) : null;
  return out;
}

function projectLinked<T extends { person_ids: string[]; tags?: string[] }>(
  entity: T,
  keys: readonly (keyof T)[],
  optional: readonly (keyof T)[] = [],
): T {
  const out = pick(entity, keys, optional);
  out.person_ids = [...entity.person_ids];
  if ("tags" in out) out.tags = [...(entity.tags ?? [])];
  return out;
}

function projectClassification(c: DecryptedClassification): DecryptedClassification {
  const out = projectLinked(c, CLASSIFICATION_FIELDS);
  out.dsm_subcategory = c.dsm_subcategory || null;
  out.periods = (c.periods ?? []).map((period) => pick(period, CLASSIFICATION_PERIOD_FIELDS));
  return out;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/**
 * The palette colour a pattern is published with. Patterns from older demo
 * trees carry colours outside today's palette, and the guest page accepts the
 * palette only, so those take the nearest palette colour; anything that is not
 * a hex colour takes the first.
 */
export function toPaletteColor(color: string): string {
  const exact = PATTERN_COLORS.find((c) => c.toLowerCase() === color.toLowerCase());
  if (exact) return exact;
  if (!HEX_COLOR.test(color)) return PATTERN_COLORS[0];
  const [r, g, b] = rgb(color);
  let nearest = PATTERN_COLORS[0];
  let best = Number.POSITIVE_INFINITY;
  for (const candidate of PATTERN_COLORS) {
    const [cr, cg, cb] = rgb(candidate);
    const distance = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (distance < best) {
      best = distance;
      nearest = candidate;
    }
  }
  return nearest;
}

function projectPattern(p: DecryptedPattern): DecryptedPattern {
  const out = projectLinked(p, PATTERN_FIELDS);
  out.color = toPaletteColor(p.color);
  out.linked_entities = p.linked_entities.map((le) => pick(le, LINKED_ENTITY_FIELDS));
  return out;
}

function projectSiblingGroup(g: DecryptedSiblingGroup): DecryptedSiblingGroup {
  const out = pickPosition(projectLinked(g, SIBLING_GROUP_FIELDS, OPTIONAL_SIBLING_GROUP_FIELDS));
  out.members = g.members.map((m) => pick(m, MEMBER_FIELDS, OPTIONAL_MEMBER_FIELDS));
  return out;
}

export function buildGuestCopy(
  input: GuestCopyInput,
  now: Date,
  language: GuestCopyLanguage,
): GuestCopy {
  const all = <T>(map: Map<string, T>): T[] => Array.from(map.values());
  return {
    version: GUEST_COPY_VERSION,
    publishedAt: now.toISOString(),
    language,
    treeName: input.treeName,
    persons: all(input.persons).map(projectPerson),
    relationships: all(input.relationships).map(projectRelationship),
    events: all(input.events).map((e) => projectLinked(e, EVENT_FIELDS)),
    lifeEvents: all(input.lifeEvents).map((e) => projectLinked(e, LIFE_EVENT_FIELDS)),
    turningPoints: all(input.turningPoints).map((e) => projectLinked(e, TURNING_POINT_FIELDS)),
    classifications: all(input.classifications).map(projectClassification),
    patterns: all(input.patterns).map(projectPattern),
    siblingGroups: all(input.siblingGroups).map(projectSiblingGroup),
  };
}

/** The counts for the publish dialog: people, events of any kind, patterns. */
export function summarizeGuestCopy(input: GuestCopyInput): {
  persons: number;
  events: number;
  patterns: number;
} {
  return {
    persons: input.persons.size,
    events: input.events.size + input.lifeEvents.size + input.turningPoints.size,
    patterns: input.patterns.size,
  };
}

export function guestCopyToState(copy: GuestCopy): GuestTreeState {
  const byId = <T extends { id: string }>(items: T[]) =>
    new Map(items.map((item) => [item.id, item] as const));
  return {
    treeName: copy.treeName,
    persons: byId(copy.persons),
    relationships: byId(copy.relationships),
    events: byId(copy.events),
    lifeEvents: byId(copy.lifeEvents),
    turningPoints: byId(copy.turningPoints),
    classifications: byId(copy.classifications),
    patterns: byId(copy.patterns),
    siblingGroups: byId(copy.siblingGroups),
  };
}

// ---- Parsing ------------------------------------------------------------

const MAX_ID_LENGTH = 64;
const MAX_TEXT_LENGTH = 20_000;
const MAX_NAME_LENGTH = 500;
const MAX_ITEMS = 5_000;
const MAX_YEAR = 3000;
const MAX_SCALE = 10;
const MAX_COORDINATE = 10_000_000;

const GENDERS: ReadonlySet<string> = new Set(["", "male", "female", "other"]);
const RELATIONSHIP_TYPES: ReadonlySet<string> = new Set(Object.values(RelationshipType));
const PARTNER_STATUSES: ReadonlySet<string> = new Set(Object.values(PartnerStatus));
const TRAUMA_CATEGORIES: ReadonlySet<string> = new Set(Object.values(TraumaCategory));
const LIFE_EVENT_CATEGORIES: ReadonlySet<string> = new Set(Object.values(LifeEventCategory));
const TURNING_POINT_CATEGORIES: ReadonlySet<string> = new Set(Object.values(TurningPointCategory));
const CLASSIFICATION_STATUSES: ReadonlySet<string> = new Set<ClassificationStatus>([
  "suspected",
  "diagnosed",
]);
const DSM_SUBCATEGORIES: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  DSM_CATEGORIES.map((c) => [c.key, new Set((c.subcategories ?? []).map((s) => s.key))]),
);
const PATTERN_COLOR_SET: ReadonlySet<string> = new Set(PATTERN_COLORS.map((c) => c.toLowerCase()));

type Raw = Record<string, unknown>;

function fail(path: string): never {
  throw new GuestCopyError(`Invalid guest copy at ${path}.`);
}

function requiredOf(keys: readonly PropertyKey[], optional: readonly PropertyKey[]): string[] {
  const mayBeAbsent = new Set(optional);
  const required: string[] = [];
  for (const key of keys) if (!mayBeAbsent.has(key)) required.push(String(key));
  return required;
}

/** A plain object with exactly the required keys, plus any of the optional ones. */
function record(
  value: unknown,
  path: string,
  keys: readonly PropertyKey[],
  optional: readonly PropertyKey[] = [],
): Raw {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) fail(path);
  const allowed = new Set(keys.map(String));
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${path}.${key}`);
  }
  for (const key of requiredOf(keys, optional)) {
    if (!Object.hasOwn(value, key)) fail(`${path}.${key}`);
  }
  return value as Raw;
}

function list<T>(value: unknown, path: string, item: (v: unknown, path: string) => T): T[] {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) fail(path);
  return value.map((v, i) => item(v, `${path}[${i}]`));
}

function text(value: unknown, path: string, max = MAX_TEXT_LENGTH): string {
  if (typeof value !== "string" || value.length > max) fail(path);
  return value;
}

function name(value: unknown, path: string): string {
  return text(value, path, MAX_NAME_LENGTH);
}

function nullable<T>(value: unknown, path: string, check: (v: unknown, path: string) => T) {
  return value === null ? null : check(value, path);
}

function id(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_ID_LENGTH) fail(path);
  return value;
}

function integer(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    fail(path);
  }
  return value;
}

function year(value: unknown, path: string): number {
  return integer(value, path, 0, MAX_YEAR);
}

function coordinate(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > MAX_COORDINATE) {
    fail(path);
  }
  return value;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path);
  return value;
}

function oneOf<T extends string>(value: unknown, path: string, allowed: ReadonlySet<string>): T {
  if (typeof value !== "string" || !allowed.has(value)) fail(path);
  return value as T;
}

function refTo(ids: ReadonlySet<string>) {
  return (value: unknown, path: string): string => {
    const ref = id(value, path);
    if (!ids.has(ref)) fail(path);
    return ref;
  };
}

/** Parse an entity list and reject duplicate ids within it. */
function entities<T extends { id: string }>(
  value: unknown,
  path: string,
  item: (v: unknown, path: string) => T,
): { items: T[]; ids: Set<string> } {
  const items = list(value, path, item);
  const ids = new Set(items.map((e) => e.id));
  if (ids.size !== items.length) fail(path);
  return { items, ids };
}

function parsePosition(value: unknown, path: string): Position {
  const r = record(value, path, POSITION_FIELDS);
  return { x: coordinate(r.x, `${path}.x`), y: coordinate(r.y, `${path}.y`) };
}

function parsePerson(value: unknown, path: string): DecryptedPerson {
  const r = record(value, path, PERSON_FIELDS, OPTIONAL_PERSON_FIELDS);
  const at = (key: string) => `${path}.${key}`;
  const person: DecryptedPerson = {
    id: id(r.id, at("id")),
    name: name(r.name, at("name")),
    birth_year: nullable(r.birth_year, at("birth_year"), year),
    birth_month: nullable(r.birth_month, at("birth_month"), (v, p) => integer(v, p, 1, 12)),
    birth_day: nullable(r.birth_day, at("birth_day"), (v, p) => integer(v, p, 1, 31)),
    death_year: nullable(r.death_year, at("death_year"), year),
    death_month: nullable(r.death_month, at("death_month"), (v, p) => integer(v, p, 1, 12)),
    death_day: nullable(r.death_day, at("death_day"), (v, p) => integer(v, p, 1, 31)),
    cause_of_death: nullable(r.cause_of_death, at("cause_of_death"), text),
    gender: oneOf(r.gender, at("gender"), GENDERS),
    is_adopted: boolean(r.is_adopted, at("is_adopted")),
    notes: nullable(r.notes, at("notes"), text),
  };
  if (r.position !== undefined) person.position = parsePosition(r.position, at("position"));
  return person;
}

function parsePartnerPeriod(value: unknown, path: string): RelationshipPeriod {
  const r = record(value, path, PARTNER_PERIOD_FIELDS);
  return {
    start_year: year(r.start_year, `${path}.start_year`),
    end_year: nullable(r.end_year, `${path}.end_year`, year),
    status: oneOf(r.status, `${path}.status`, PARTNER_STATUSES),
  };
}

function parseActivePeriod(value: unknown, path: string): ActivePeriod {
  const r = record(value, path, ACTIVE_PERIOD_FIELDS);
  return {
    start_year: year(r.start_year, `${path}.start_year`),
    end_year: nullable(r.end_year, `${path}.end_year`, year),
  };
}

function parseRelationship(personIds: ReadonlySet<string>) {
  const person = refTo(personIds);
  return (value: unknown, path: string): DecryptedRelationship => {
    const r = record(value, path, RELATIONSHIP_FIELDS);
    return {
      id: id(r.id, `${path}.id`),
      source_person_id: person(r.source_person_id, `${path}.source_person_id`),
      target_person_id: person(r.target_person_id, `${path}.target_person_id`),
      type: oneOf(r.type, `${path}.type`, RELATIONSHIP_TYPES),
      periods: list(r.periods, `${path}.periods`, parsePartnerPeriod),
      active_period: nullable(r.active_period, `${path}.active_period`, parseActivePeriod),
    };
  };
}

/** The fields events, life events and turning points share. */
function parseStory(r: Raw, path: string, personIds: ReadonlySet<string>) {
  return {
    id: id(r.id, `${path}.id`),
    person_ids: list(r.person_ids, `${path}.person_ids`, refTo(personIds)),
    title: name(r.title, `${path}.title`),
    description: text(r.description, `${path}.description`),
    approximate_date: text(r.approximate_date, `${path}.approximate_date`),
    tags: list(r.tags, `${path}.tags`, name),
  };
}

function scale(value: unknown, path: string): number {
  return integer(value, path, 0, MAX_SCALE);
}

function parseEvent(personIds: ReadonlySet<string>) {
  return (value: unknown, path: string): DecryptedEvent => {
    const r = record(value, path, EVENT_FIELDS);
    return {
      ...parseStory(r, path, personIds),
      category: oneOf(r.category, `${path}.category`, TRAUMA_CATEGORIES),
      severity: scale(r.severity, `${path}.severity`),
    };
  };
}

function parseLifeEvent(personIds: ReadonlySet<string>) {
  return (value: unknown, path: string): DecryptedLifeEvent => {
    const r = record(value, path, LIFE_EVENT_FIELDS);
    return {
      ...parseStory(r, path, personIds),
      category: oneOf(r.category, `${path}.category`, LIFE_EVENT_CATEGORIES),
      impact: nullable(r.impact, `${path}.impact`, scale),
    };
  };
}

function parseTurningPoint(personIds: ReadonlySet<string>) {
  return (value: unknown, path: string): DecryptedTurningPoint => {
    const r = record(value, path, TURNING_POINT_FIELDS);
    return {
      ...parseStory(r, path, personIds),
      category: oneOf(r.category, `${path}.category`, TURNING_POINT_CATEGORIES),
      significance: nullable(r.significance, `${path}.significance`, scale),
    };
  };
}

function parseClassificationPeriod(value: unknown, path: string): ClassificationPeriod {
  const r = record(value, path, CLASSIFICATION_PERIOD_FIELDS);
  return {
    start_year: year(r.start_year, `${path}.start_year`),
    end_year: nullable(r.end_year, `${path}.end_year`, year),
  };
}

function parseClassification(personIds: ReadonlySet<string>) {
  return (value: unknown, path: string): DecryptedClassification => {
    const r = record(value, path, CLASSIFICATION_FIELDS);
    const category = oneOf(
      r.dsm_category,
      `${path}.dsm_category`,
      new Set(DSM_SUBCATEGORIES.keys()),
    );
    const subcategories = DSM_SUBCATEGORIES.get(category) ?? new Set<string>();
    return {
      id: id(r.id, `${path}.id`),
      person_ids: list(r.person_ids, `${path}.person_ids`, refTo(personIds)),
      dsm_category: category,
      dsm_subcategory: nullable(r.dsm_subcategory, `${path}.dsm_subcategory`, (v, p) =>
        oneOf(v, p, subcategories),
      ),
      status: oneOf(r.status, `${path}.status`, CLASSIFICATION_STATUSES),
      diagnosis_year: nullable(r.diagnosis_year, `${path}.diagnosis_year`, year),
      periods: list(r.periods, `${path}.periods`, parseClassificationPeriod),
      notes: nullable(r.notes, `${path}.notes`, text),
    };
  };
}

type LinkableIds = Record<LinkedEntity["entity_type"], ReadonlySet<string>>;

function parseLinkedEntity(linkable: LinkableIds) {
  const types = new Set(Object.keys(linkable));
  return (value: unknown, path: string): LinkedEntity => {
    const r = record(value, path, LINKED_ENTITY_FIELDS);
    const entityType = oneOf<LinkedEntity["entity_type"]>(
      r.entity_type,
      `${path}.entity_type`,
      types,
    );
    return {
      entity_type: entityType,
      entity_id: refTo(linkable[entityType])(r.entity_id, `${path}.entity_id`),
    };
  };
}

function parsePattern(personIds: ReadonlySet<string>, linkable: LinkableIds) {
  return (value: unknown, path: string): DecryptedPattern => {
    const r = record(value, path, PATTERN_FIELDS);
    const color = text(r.color, `${path}.color`, MAX_NAME_LENGTH);
    if (!PATTERN_COLOR_SET.has(color.toLowerCase())) fail(`${path}.color`);
    return {
      id: id(r.id, `${path}.id`),
      person_ids: list(r.person_ids, `${path}.person_ids`, refTo(personIds)),
      name: name(r.name, `${path}.name`),
      description: text(r.description, `${path}.description`),
      color,
      linked_entities: list(
        r.linked_entities,
        `${path}.linked_entities`,
        parseLinkedEntity(linkable),
      ),
    };
  };
}

function parseMember(value: unknown, path: string): SiblingGroupMember {
  const r = record(value, path, MEMBER_FIELDS, OPTIONAL_MEMBER_FIELDS);
  const member: SiblingGroupMember = {
    name: name(r.name, `${path}.name`),
    birth_year: nullable(r.birth_year, `${path}.birth_year`, year),
  };
  if (r.gender !== undefined) member.gender = oneOf(r.gender, `${path}.gender`, GENDERS);
  if (r.death_year !== undefined) {
    member.death_year = nullable(r.death_year, `${path}.death_year`, year);
  }
  return member;
}

function parseSiblingGroup(personIds: ReadonlySet<string>) {
  return (value: unknown, path: string): DecryptedSiblingGroup => {
    const r = record(value, path, SIBLING_GROUP_FIELDS, OPTIONAL_SIBLING_GROUP_FIELDS);
    const group: DecryptedSiblingGroup = {
      id: id(r.id, `${path}.id`),
      person_ids: list(r.person_ids, `${path}.person_ids`, refTo(personIds)),
      members: list(r.members, `${path}.members`, parseMember),
    };
    if (r.position !== undefined) group.position = parsePosition(r.position, `${path}.position`);
    return group;
  };
}

function publishedAt(value: unknown, path: string): string {
  const iso = text(value, path, MAX_ID_LENGTH);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(iso)) fail(path);
  if (Number.isNaN(Date.parse(iso))) fail(path);
  return iso;
}

/** Validate a decrypted, JSON-parsed copy. Throws GuestCopyError on any mismatch. */
export function parseGuestCopy(raw: unknown): GuestCopy {
  const r = record(raw, "copy", COPY_FIELDS);
  if (r.version !== GUEST_COPY_VERSION) fail("copy.version");

  const persons = entities(r.persons, "copy.persons", parsePerson);
  const ids = persons.ids;
  const relationships = entities(r.relationships, "copy.relationships", parseRelationship(ids));
  const events = entities(r.events, "copy.events", parseEvent(ids));
  const lifeEvents = entities(r.lifeEvents, "copy.lifeEvents", parseLifeEvent(ids));
  const turningPoints = entities(r.turningPoints, "copy.turningPoints", parseTurningPoint(ids));
  const classifications = entities(
    r.classifications,
    "copy.classifications",
    parseClassification(ids),
  );
  const linkable: LinkableIds = {
    trauma_event: events.ids,
    life_event: lifeEvents.ids,
    turning_point: turningPoints.ids,
    classification: classifications.ids,
  };
  const patterns = entities(r.patterns, "copy.patterns", parsePattern(ids, linkable));
  const siblingGroups = entities(r.siblingGroups, "copy.siblingGroups", parseSiblingGroup(ids));

  return {
    version: GUEST_COPY_VERSION,
    publishedAt: publishedAt(r.publishedAt, "copy.publishedAt"),
    language: oneOf(r.language, "copy.language", new Set(["en", "nl"])),
    treeName: name(r.treeName, "copy.treeName"),
    persons: persons.items,
    relationships: relationships.items,
    events: events.items,
    lifeEvents: lifeEvents.items,
    turningPoints: turningPoints.items,
    classifications: classifications.items,
    patterns: patterns.items,
    siblingGroups: siblingGroups.items,
  };
}
