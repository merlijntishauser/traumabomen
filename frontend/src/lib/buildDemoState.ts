import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedSiblingGroup,
  DecryptedTurningPoint,
} from "../hooks/useTreeData";
import type {
  Classification,
  LifeEvent,
  Pattern,
  RelationshipPeriod,
  RelationshipType,
  TraumaEvent,
  TurningPoint,
} from "../types/domain";
import type { DemoFixture } from "./createDemoTree";

export interface DemoTreeState {
  treeName: string;
  persons: Map<string, DecryptedPerson>;
  relationships: Map<string, DecryptedRelationship>;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  turningPoints: Map<string, DecryptedTurningPoint>;
  classifications: Map<string, DecryptedClassification>;
  patterns: Map<string, DecryptedPattern>;
  siblingGroups: Map<string, DecryptedSiblingGroup>;
}

/**
 * Turn a plaintext demo fixture into the same in-memory, decrypted entity maps
 * that `useTreeData` produces after fetch-and-decrypt. The public demo renders
 * from these directly: no API, no encryption, no master key.
 *
 * Fixture string ids (such as `demo-p1`) are used as-is because nothing
 * persists. The fixture's category/type/status strings already match the domain
 * enums, so they are cast rather than re-validated.
 */
export function buildDemoState(fixture: DemoFixture): DemoTreeState {
  const persons = new Map<string, DecryptedPerson>(
    fixture.persons.map((p) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        birth_year: p.birth_year,
        birth_month: null,
        birth_day: null,
        death_year: p.death_year,
        death_month: null,
        death_day: null,
        cause_of_death: null,
        gender: p.gender,
        is_adopted: p.is_adopted,
        notes: p.notes,
      },
    ]),
  );

  const relationships = new Map<string, DecryptedRelationship>(
    fixture.relationships.map((r) => [
      r.id,
      {
        id: r.id,
        source_person_id: r.source_person_id,
        target_person_id: r.target_person_id,
        type: r.type as RelationshipType,
        active_period: null,
        periods: r.periods.map((per) => ({
          start_year: per.start_year,
          end_year: per.end_year,
          status: (per.status ?? "together") as RelationshipPeriod["status"],
        })),
      },
    ]),
  );

  const events = new Map<string, DecryptedEvent>(
    fixture.events.map((e) => [
      e.id,
      {
        id: e.id,
        person_ids: e.person_ids,
        title: e.title,
        description: e.description,
        category: e.category as TraumaEvent["category"],
        approximate_date: e.approximate_date,
        severity: e.severity,
        tags: e.tags,
      },
    ]),
  );

  const lifeEvents = new Map<string, DecryptedLifeEvent>(
    fixture.lifeEvents.map((le) => [
      le.id,
      {
        id: le.id,
        person_ids: le.person_ids,
        title: le.title,
        description: le.description,
        category: le.category as LifeEvent["category"],
        approximate_date: le.approximate_date,
        impact: le.impact,
        tags: le.tags,
      },
    ]),
  );

  const turningPoints = new Map<string, DecryptedTurningPoint>(
    fixture.turningPoints.map((tp) => [
      tp.id,
      {
        id: tp.id,
        person_ids: tp.person_ids,
        title: tp.title,
        description: tp.description,
        category: tp.category as TurningPoint["category"],
        approximate_date: tp.approximate_date,
        significance: tp.significance,
        tags: tp.tags,
      },
    ]),
  );

  const classifications = new Map<string, DecryptedClassification>(
    fixture.classifications.map((c) => [
      c.id,
      {
        id: c.id,
        person_ids: c.person_ids,
        dsm_category: c.dsm_category,
        dsm_subcategory: c.dsm_subcategory || null,
        status: c.status as Classification["status"],
        diagnosis_year: c.diagnosis_year,
        periods: c.periods,
        notes: c.notes || null,
      },
    ]),
  );

  const patterns = new Map<string, DecryptedPattern>(
    fixture.patterns.map((pat) => [
      pat.id,
      {
        id: pat.id,
        person_ids: pat.person_ids,
        name: pat.name,
        description: pat.description,
        color: pat.color,
        linked_entities: pat.linked_entities.map((le) => ({
          entity_type: le.entity_type as Pattern["linked_entities"][number]["entity_type"],
          entity_id: le.entity_id,
        })),
      },
    ]),
  );

  const siblingGroups = new Map<string, DecryptedSiblingGroup>(
    fixture.siblingGroups.map((sg) => [
      sg.id,
      { id: sg.id, person_ids: sg.person_ids, members: sg.members },
    ]),
  );

  return {
    treeName: fixture.treeName,
    persons,
    relationships,
    events,
    lifeEvents,
    turningPoints,
    classifications,
    patterns,
    siblingGroups,
  };
}
