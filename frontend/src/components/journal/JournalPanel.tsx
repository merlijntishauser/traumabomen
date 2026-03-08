import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedJournalEntry,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import type { JournalEntry, JournalLinkedRef } from "../../types/domain";
import { JournalEntryList } from "./JournalEntryList";
import "./Journal.css";

interface JournalPanelProps {
  journalEntries: Map<string, DecryptedJournalEntry>;
  persons: Map<string, DecryptedPerson>;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  turningPoints: Map<string, DecryptedTurningPoint>;
  classifications: Map<string, DecryptedClassification>;
  patterns: Map<string, DecryptedPattern>;
  onSave: (entryId: string | null, data: JournalEntry) => void;
  onDelete: (entryId: string) => void;
  onClose: () => void;
  initialPrompt?: string;
  initialLinkedRef?: JournalLinkedRef;
}

export function JournalPanel({
  journalEntries,
  persons,
  events,
  lifeEvents,
  turningPoints,
  classifications,
  patterns,
  onSave,
  onDelete,
  onClose,
  initialPrompt,
  initialLinkedRef,
}: JournalPanelProps) {
  const { t } = useTranslation();

  const sortedEntries = useMemo(
    () =>
      Array.from(journalEntries.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [journalEntries],
  );

  return (
    <div className="panel-overlay journal-panel" data-testid="journal-panel">
      <div className="panel-header">
        <h2>{t("journal.title")}</h2>
        <button type="button" className="panel-close" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>

      <div className="journal-panel__content">
        <JournalEntryList
          entries={sortedEntries}
          persons={persons}
          events={events}
          lifeEvents={lifeEvents}
          turningPoints={turningPoints}
          classifications={classifications}
          patterns={patterns}
          onSave={onSave}
          onDelete={onDelete}
          initialPrompt={initialPrompt}
          initialLinkedRef={initialLinkedRef}
        />
      </div>
    </div>
  );
}
