import type {
  Classification,
  JournalEntry,
  LifeEvent,
  Pattern,
  Person,
  RelationshipData,
  SiblingGroupData,
  TraumaEvent,
  TurningPoint,
} from "../types/domain";

/*
 * The decrypted entity shapes and helpers shared by the app, the public demo
 * and the guest page. This module must stay free of values from Sentry, the API
 * client and the contexts, so the guest page can import it without pulling
 * those in; type-only imports are fine.
 */

export interface DecryptedPerson extends Person {
  id: string;
}

export interface DecryptedRelationship extends RelationshipData {
  id: string;
  source_person_id: string;
  target_person_id: string;
}

export interface DecryptedEvent extends TraumaEvent {
  id: string;
  person_ids: string[];
}

export interface DecryptedLifeEvent extends LifeEvent {
  id: string;
  person_ids: string[];
}

export interface DecryptedTurningPoint extends TurningPoint {
  id: string;
  person_ids: string[];
}

export interface DecryptedClassification extends Classification {
  id: string;
  person_ids: string[];
}

export interface DecryptedPattern extends Pattern {
  id: string;
  person_ids: string[];
}

export interface DecryptedSiblingGroup extends SiblingGroupData {
  id: string;
  person_ids: string[];
}

export interface DecryptedJournalEntry extends JournalEntry {
  id: string;
  created_at: string;
  updated_at: string;
}

/** Filter a linked-entity map to entries associated with a given person. */
export function filterByPerson<T extends { person_ids: string[] }>(
  entities: Map<string, T>,
  personId: string | null,
): T[] {
  if (!personId) return [];
  return Array.from(entities.values()).filter((e) => e.person_ids.includes(personId));
}

/** One tree's decrypted entities keyed by id, as the read-only views take them. */
export interface TreeEntityMaps {
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
