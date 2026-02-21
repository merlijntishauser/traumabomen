import type { SyncRequest } from "../types/api";
import { createLifeEvent, createTree, createTurningPoint, syncTree } from "./api";

interface FixturePerson {
  id: string;
  name: string;
  birth_year: number;
  death_year: number | null;
  gender: string;
  is_adopted: boolean;
  notes: string;
}

interface FixturePeriod {
  start_year: number;
  end_year: number | null;
  status?: string;
}

interface FixtureRelationship {
  id: string;
  source_person_id: string;
  target_person_id: string;
  type: string;
  periods: FixturePeriod[];
}

interface FixtureEvent {
  id: string;
  person_ids: string[];
  title: string;
  description: string;
  category: string;
  approximate_date: string;
  severity: number;
  tags: string[];
}

interface FixtureLifeEvent {
  id: string;
  person_ids: string[];
  title: string;
  description: string;
  category: string;
  approximate_date: string;
  impact: number;
  tags: string[];
}

interface FixtureTurningPoint {
  id: string;
  person_ids: string[];
  title: string;
  description: string;
  category: string;
  approximate_date: string;
  significance: number;
  tags: string[];
}

interface FixtureClassification {
  id: string;
  person_ids: string[];
  dsm_category: string;
  dsm_subcategory: string;
  status: string;
  diagnosis_year: number | null;
  periods: { start_year: number; end_year: number | null }[];
  notes: string;
}

interface FixtureLinkedEntity {
  entity_type: string;
  entity_id: string;
}

interface FixturePattern {
  id: string;
  name: string;
  description: string;
  color: string;
  person_ids: string[];
  linked_entities: FixtureLinkedEntity[];
}

export interface DemoFixture {
  treeName: string;
  persons: FixturePerson[];
  relationships: FixtureRelationship[];
  events: FixtureEvent[];
  lifeEvents: FixtureLifeEvent[];
  turningPoints: FixtureTurningPoint[];
  classifications: FixtureClassification[];
  patterns: FixturePattern[];
}

export function buildIdMap(fixture: DemoFixture): Map<string, string> {
  const idMap = new Map<string, string>();

  for (const p of fixture.persons) {
    idMap.set(p.id, crypto.randomUUID());
  }
  for (const r of fixture.relationships) {
    idMap.set(r.id, crypto.randomUUID());
  }
  for (const e of fixture.events) {
    idMap.set(e.id, crypto.randomUUID());
  }
  for (const le of fixture.lifeEvents) {
    idMap.set(le.id, crypto.randomUUID());
  }
  for (const tp of fixture.turningPoints) {
    idMap.set(tp.id, crypto.randomUUID());
  }
  for (const c of fixture.classifications) {
    idMap.set(c.id, crypto.randomUUID());
  }
  for (const pat of fixture.patterns) {
    idMap.set(pat.id, crypto.randomUUID());
  }

  return idMap;
}

function remapIds(ids: string[], idMap: Map<string, string>): string[] {
  return ids.map((id) => idMap.get(id) ?? id);
}

export function buildSyncRequest(
  fixture: DemoFixture,
  idMap: Map<string, string>,
  encryptedEntities: Map<string, string>,
): SyncRequest {
  return {
    persons_create: fixture.persons.map((p) => ({
      id: idMap.get(p.id)!,
      encrypted_data: encryptedEntities.get(p.id)!,
    })),
    relationships_create: fixture.relationships.map((r) => ({
      id: idMap.get(r.id)!,
      source_person_id: idMap.get(r.source_person_id)!,
      target_person_id: idMap.get(r.target_person_id)!,
      encrypted_data: encryptedEntities.get(r.id)!,
    })),
    events_create: fixture.events.map((e) => ({
      id: idMap.get(e.id)!,
      person_ids: remapIds(e.person_ids, idMap),
      encrypted_data: encryptedEntities.get(e.id)!,
    })),
    classifications_create: fixture.classifications.map((c) => ({
      id: idMap.get(c.id)!,
      person_ids: remapIds(c.person_ids, idMap),
      encrypted_data: encryptedEntities.get(c.id)!,
    })),
    patterns_create: fixture.patterns.map((pat) => ({
      id: idMap.get(pat.id)!,
      person_ids: remapIds(pat.person_ids, idMap),
      encrypted_data: encryptedEntities.get(pat.id)!,
    })),
  };
}

async function loadFixture(language: string): Promise<DemoFixture> {
  const lang = language.startsWith("nl") ? "nl" : "en";
  const module = await import(`../fixtures/demo-tree-${lang}.json`);
  return module.default as DemoFixture;
}

export async function createDemoTree(
  encrypt: (data: unknown) => Promise<string>,
  language: string,
): Promise<string> {
  const fixture = await loadFixture(language);
  const idMap = buildIdMap(fixture);

  // Create tree
  const encryptedTreeName = await encrypt({ name: fixture.treeName });
  const tree = await createTree({ encrypted_data: encryptedTreeName, is_demo: true });
  const treeId = tree.id;

  // Encrypt all entities
  const encryptedEntities = new Map<string, string>();

  await Promise.all([
    ...fixture.persons.map(async (p) => {
      const encrypted = await encrypt({
        name: p.name,
        birth_year: p.birth_year,
        death_year: p.death_year,
        cause_of_death: null,
        gender: p.gender,
        is_adopted: p.is_adopted,
        notes: p.notes,
      });
      encryptedEntities.set(p.id, encrypted);
    }),
    ...fixture.relationships.map(async (r) => {
      const encrypted = await encrypt({
        type: r.type,
        periods: r.periods,
      });
      encryptedEntities.set(r.id, encrypted);
    }),
    ...fixture.events.map(async (e) => {
      const encrypted = await encrypt({
        title: e.title,
        description: e.description,
        category: e.category,
        approximate_date: e.approximate_date,
        severity: e.severity,
        tags: e.tags,
      });
      encryptedEntities.set(e.id, encrypted);
    }),
    ...fixture.lifeEvents.map(async (le) => {
      const encrypted = await encrypt({
        title: le.title,
        description: le.description,
        category: le.category,
        approximate_date: le.approximate_date,
        impact: le.impact,
        tags: le.tags,
      });
      encryptedEntities.set(le.id, encrypted);
    }),
    ...fixture.turningPoints.map(async (tp) => {
      const encrypted = await encrypt({
        title: tp.title,
        description: tp.description,
        category: tp.category,
        approximate_date: tp.approximate_date,
        significance: tp.significance,
        tags: tp.tags,
      });
      encryptedEntities.set(tp.id, encrypted);
    }),
    ...fixture.classifications.map(async (c) => {
      const encrypted = await encrypt({
        dsm_category: c.dsm_category,
        dsm_subcategory: c.dsm_subcategory,
        status: c.status,
        diagnosis_year: c.diagnosis_year,
        periods: c.periods,
        notes: c.notes,
      });
      encryptedEntities.set(c.id, encrypted);
    }),
    ...fixture.patterns.map(async (pat) => {
      const encrypted = await encrypt({
        name: pat.name,
        description: pat.description,
        color: pat.color,
        linked_entities: pat.linked_entities.map((le) => ({
          entity_type: le.entity_type,
          entity_id: idMap.get(le.entity_id) ?? le.entity_id,
        })),
      });
      encryptedEntities.set(pat.id, encrypted);
    }),
  ]);

  // Sync persons, relationships, events, classifications, and patterns
  const syncRequest = buildSyncRequest(fixture, idMap, encryptedEntities);
  await syncTree(treeId, syncRequest);

  // Life events are not in the sync endpoint; create them individually
  for (const le of fixture.lifeEvents) {
    await createLifeEvent(treeId, {
      person_ids: remapIds(le.person_ids, idMap),
      encrypted_data: encryptedEntities.get(le.id)!,
    });
  }

  // Turning points are not in the sync endpoint; create them individually
  for (const tp of fixture.turningPoints) {
    await createTurningPoint(treeId, {
      person_ids: remapIds(tp.person_ids, idMap),
      encrypted_data: encryptedEntities.get(tp.id)!,
    });
  }

  return treeId;
}
