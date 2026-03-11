import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../hooks/useTreeData";
import type { LinkedEntity } from "../types/domain";

export interface EntityMaps {
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  turningPoints: Map<string, DecryptedTurningPoint>;
  classifications: Map<string, DecryptedClassification>;
  persons: Map<string, DecryptedPerson>;
}

interface ResolvedEntity {
  label: string;
  personName: string;
  personId: string;
}

function classificationLabel(cls: DecryptedClassification, t: (key: string) => string): string {
  return cls.dsm_subcategory ? t(`dsm.sub.${cls.dsm_subcategory}`) : t(`dsm.${cls.dsm_category}`);
}

export function resolveLinkedEntity(
  le: LinkedEntity,
  maps: EntityMaps,
  t: (key: string) => string,
): ResolvedEntity {
  const titleMaps: Record<string, Map<string, { title?: string; person_ids: string[] }>> = {
    trauma_event: maps.events,
    life_event: maps.lifeEvents,
    turning_point: maps.turningPoints,
  };

  const map = titleMaps[le.entity_type];
  if (map) {
    const entity = map.get(le.entity_id);
    const pid = entity?.person_ids[0];
    return {
      label: (entity as { title?: string } | undefined)?.title ?? "?",
      personName: pid ? (maps.persons.get(pid)?.name ?? "") : "",
      personId: pid ?? "",
    };
  }

  if (le.entity_type === "classification") {
    const cls = maps.classifications.get(le.entity_id);
    const pid = cls?.person_ids[0];
    return {
      label: cls ? classificationLabel(cls, t) : "?",
      personName: pid ? (maps.persons.get(pid)?.name ?? "") : "",
      personId: pid ?? "",
    };
  }

  return { label: "?", personName: "", personId: "" };
}

export function derivePersonIds(
  linkedEntities: LinkedEntity[],
  maps: Pick<EntityMaps, "events" | "lifeEvents" | "turningPoints" | "classifications">,
): string[] {
  const ids = new Set<string>();
  const entityMaps: Record<string, Map<string, { person_ids: string[] }>> = {
    trauma_event: maps.events,
    life_event: maps.lifeEvents,
    turning_point: maps.turningPoints,
    classification: maps.classifications,
  };
  for (const le of linkedEntities) {
    const personIds = entityMaps[le.entity_type]?.get(le.entity_id)?.person_ids ?? [];
    for (const pid of personIds) ids.add(pid);
  }
  return Array.from(ids);
}

interface PersonEntityGroup {
  personId: string;
  personName: string;
  entities: { type: LinkedEntity["entity_type"]; id: string; label: string }[];
}

export function buildPersonEntityGroups(
  maps: EntityMaps,
  t: (key: string) => string,
): PersonEntityGroup[] {
  const personMap = new Map<
    string,
    { type: LinkedEntity["entity_type"]; id: string; label: string }[]
  >();

  function addEntry(pid: string, type: LinkedEntity["entity_type"], id: string, label: string) {
    if (!personMap.has(pid)) personMap.set(pid, []);
    personMap.get(pid)!.push({ type, id, label });
  }

  for (const [id, ev] of maps.events) {
    for (const pid of ev.person_ids) addEntry(pid, "trauma_event", id, ev.title);
  }
  for (const [id, ev] of maps.lifeEvents) {
    for (const pid of ev.person_ids) addEntry(pid, "life_event", id, ev.title);
  }
  for (const [id, tp] of maps.turningPoints) {
    for (const pid of tp.person_ids) addEntry(pid, "turning_point", id, tp.title);
  }
  for (const [id, cls] of maps.classifications) {
    for (const pid of cls.person_ids)
      addEntry(pid, "classification", id, classificationLabel(cls, t));
  }

  return Array.from(personMap, ([pid, entities]) => ({
    personId: pid,
    personName: maps.persons.get(pid)?.name ?? "?",
    entities,
  })).sort((a, b) => a.personName.localeCompare(b.personName));
}
