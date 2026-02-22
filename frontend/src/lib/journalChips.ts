import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../hooks/useTreeData";
import type { JournalLinkedRef } from "../types/domain";

export const CHIP_COLORS: Record<JournalLinkedRef["entity_type"], string> = {
  person: "var(--color-accent)",
  trauma_event: "#f87171",
  life_event: "#60a5fa",
  turning_point: "#34d399",
  classification: "#fbbf24",
  pattern: "var(--color-accent)",
};

export function resolveChipLabel(
  ref: JournalLinkedRef,
  t: (key: string) => string,
  persons: Map<string, DecryptedPerson>,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  turningPoints: Map<string, DecryptedTurningPoint>,
  classifications: Map<string, DecryptedClassification>,
  patterns: Map<string, DecryptedPattern>,
): string {
  switch (ref.entity_type) {
    case "person": {
      const p = persons.get(ref.entity_id);
      return p?.name ?? ref.entity_id;
    }
    case "trauma_event": {
      const e = events.get(ref.entity_id);
      return e?.title ?? ref.entity_id;
    }
    case "life_event": {
      const le = lifeEvents.get(ref.entity_id);
      return le?.title ?? ref.entity_id;
    }
    case "turning_point": {
      const tp = turningPoints.get(ref.entity_id);
      return tp?.title ?? ref.entity_id;
    }
    case "classification": {
      const c = classifications.get(ref.entity_id);
      if (!c) return ref.entity_id;
      return c.dsm_subcategory ? t(`dsm.sub.${c.dsm_subcategory}`) : t(`dsm.${c.dsm_category}`);
    }
    case "pattern": {
      const pat = patterns.get(ref.entity_id);
      return pat?.name ?? ref.entity_id;
    }
    default:
      return ref.entity_id;
  }
}

export function getChipColor(
  ref: JournalLinkedRef,
  patterns: Map<string, DecryptedPattern>,
): string {
  if (ref.entity_type === "pattern") {
    const pat = patterns.get(ref.entity_id);
    return pat?.color ?? CHIP_COLORS.pattern;
  }
  return CHIP_COLORS[ref.entity_type];
}
