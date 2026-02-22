import { BookOpen, Plus } from "lucide-react";
import { useState } from "react";
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
import type { JournalEntry } from "../../types/domain";
import { JournalEntryForm } from "./JournalEntryForm";
import "./Journal.css";

const PREVIEW_LENGTH = 120;

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

function stripMarkdown(text: string): string {
  return text
    .replace(/[#*_~`>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n+/g, " ")
    .trim();
}

function truncate(text: string, maxLength: number): string {
  const stripped = stripMarkdown(text);
  if (stripped.length <= maxLength) return stripped;
  return `${stripped.slice(0, maxLength)}...`;
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
        className="detail-panel__btn detail-panel__btn--primary journal-list__new-btn"
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
        />
      )}

      {entries.length === 0 && editingId === null && (
        <div className="journal-list__empty" data-testid="journal-empty">
          <BookOpen size={32} />
          <p>{t("journal.empty")}</p>
        </div>
      )}

      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className="journal-list__card"
          onClick={() => setEditingId(entry.id)}
          data-testid={`journal-card-${entry.id}`}
        >
          <div className="journal-list__card-header">
            <span className="journal-list__card-time">
              {formatRelativeTime(entry.created_at, t)}
            </span>
            {entry.linked_entities.length > 0 && (
              <span className="journal-list__card-links">
                {t("journal.linkedCount", { count: entry.linked_entities.length })}
              </span>
            )}
          </div>
          <p className="journal-list__card-preview">{truncate(entry.text, PREVIEW_LENGTH)}</p>
        </button>
      ))}
    </div>
  );
}
