import { BookOpen, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedJournalEntry,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import { getChipColor, resolveChipLabel } from "../../lib/journalChips";
import type { JournalEntry, JournalLinkedRef } from "../../types/domain";
import { ALLOWED_MARKDOWN_ELEMENTS } from "./allowedMarkdownElements";
import { JournalEntryForm } from "./JournalEntryForm";
import "./Journal.css";

const MAX_CHIPS = 4;

interface JournalEntryListProps {
  entries: DecryptedJournalEntry[];
  persons: Map<string, DecryptedPerson>;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  turningPoints: Map<string, DecryptedTurningPoint>;
  classifications: Map<string, DecryptedClassification>;
  patterns: Map<string, DecryptedPattern>;
  onSave: (entryId: string | null, data: JournalEntry) => void;
  onDelete: (entryId: string) => void;
  initialPrompt?: string;
  initialLinkedRef?: JournalLinkedRef;
}

function formatRelativeTime(
  dateString: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) {
    return t("journal.justNow");
  }
  if (diffHours < 24) {
    return t("journal.hoursAgo", { count: diffHours });
  }
  return date.toLocaleDateString();
}

export function JournalEntryList({
  entries,
  persons,
  events,
  lifeEvents,
  turningPoints,
  classifications,
  patterns,
  onSave,
  onDelete,
  initialPrompt,
  initialLinkedRef,
}: JournalEntryListProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null | "new">(null);

  function handleSave(data: JournalEntry) {
    const entryId = editingId === "new" ? null : editingId;
    onSave(entryId, data);
    setEditingId(null);
  }

  function handleDelete() {
    if (editingId && editingId !== "new") {
      onDelete(editingId);
      setEditingId(null);
    }
  }

  function handleCancel() {
    setEditingId(null);
  }

  const editingEntry =
    editingId && editingId !== "new" ? (entries.find((e) => e.id === editingId) ?? null) : null;

  return (
    <div className="journal-list" data-testid="journal-entry-list">
      <button
        type="button"
        className="btn btn--primary journal-list__new-btn"
        onClick={() => setEditingId("new")}
      >
        <Plus size={14} />
        {t("journal.newEntry")}
      </button>

      {editingId !== null && (
        <JournalEntryForm
          entry={editingEntry}
          persons={persons}
          events={events}
          lifeEvents={lifeEvents}
          turningPoints={turningPoints}
          classifications={classifications}
          patterns={patterns}
          onSave={handleSave}
          onDelete={editingId !== "new" ? handleDelete : undefined}
          onCancel={handleCancel}
          initialPrompt={editingId === "new" ? initialPrompt : undefined}
          initialLinkedRef={editingId === "new" ? initialLinkedRef : undefined}
        />
      )}

      {entries.length === 0 && editingId === null && (
        <div className="journal-list__empty" data-testid="journal-empty">
          <BookOpen size={32} />
          <p>{t("journal.empty")}</p>
        </div>
      )}

      {entries.map((entry) => (
        // biome-ignore lint/a11y/useSemanticElements: card contains block-level markdown (h1, p, div) which is invalid inside <button>
        <div
          key={entry.id}
          className="journal-list__card"
          onClick={() => setEditingId(entry.id)}
          data-testid={`journal-card-${entry.id}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setEditingId(entry.id);
            }
          }}
        >
          <div className="journal-list__card-header">
            <span className="journal-list__card-time">
              {formatRelativeTime(entry.created_at, t)}
            </span>
          </div>

          <div className="journal-list__card-body">
            <div className="journal-list__card-markdown">
              <Markdown allowedElements={ALLOWED_MARKDOWN_ELEMENTS} unwrapDisallowed>
                {entry.text}
              </Markdown>
            </div>
          </div>

          {entry.linked_entities.length > 0 && (
            <div className="journal-list__card-footer">
              <span className="journal-list__chip-label">{t("journal.linkedPersons")}</span>
              <div className="journal-list__card-chips">
                {entry.linked_entities.slice(0, MAX_CHIPS).map((ref) => (
                  <span
                    key={`${ref.entity_type}-${ref.entity_id}`}
                    className="journal-list__chip"
                    style={{
                      backgroundColor: `${getChipColor(ref, patterns)}20`,
                      borderColor: `${getChipColor(ref, patterns)}40`,
                      color: getChipColor(ref, patterns),
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
                  </span>
                ))}
                {entry.linked_entities.length > MAX_CHIPS && (
                  <span className="journal-list__chip-more">
                    +{entry.linked_entities.length - MAX_CHIPS}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
