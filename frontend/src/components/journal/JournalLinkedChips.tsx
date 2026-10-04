import { useTranslation } from "react-i18next";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import { getChipColor, resolveChipLabel } from "../../lib/journalChips";
import type { JournalLinkedRef } from "../../types/domain";

export interface JournalEntityMaps {
  persons: Map<string, DecryptedPerson>;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  turningPoints: Map<string, DecryptedTurningPoint>;
  classifications: Map<string, DecryptedClassification>;
  patterns: Map<string, DecryptedPattern>;
}

interface JournalLinkedChipsProps {
  refs: JournalLinkedRef[];
  entities: JournalEntityMaps;
  /** Show at most this many, then "+n". */
  limit?: number;
}

/** The people, events and patterns an entry is about, as quiet coloured chips. */
export function JournalLinkedChips({ refs, entities, limit }: JournalLinkedChipsProps) {
  const { t } = useTranslation();
  if (refs.length === 0) return null;
  const shown = limit ? refs.slice(0, limit) : refs;
  const { persons, events, lifeEvents, turningPoints, classifications, patterns } = entities;
  return (
    <ul className="journal-chips" aria-label={t("journal.linkedEntities")}>
      {shown.map((ref) => {
        const color = getChipColor(ref, patterns);
        return (
          <li
            key={`${ref.entity_type}-${ref.entity_id}`}
            className="journal-chips__chip"
            style={{
              backgroundColor: `${color}1f`,
              borderColor: `${color}40`,
              color,
            }}
          >
            {resolveChipLabel(
              ref,
              t,
              persons,
              events,
              lifeEvents,
              turningPoints,
              classifications,
              patterns,
            )}
          </li>
        );
      })}
      {limit && refs.length > limit && (
        <li className="journal-chips__more">+{refs.length - limit}</li>
      )}
    </ul>
  );
}
