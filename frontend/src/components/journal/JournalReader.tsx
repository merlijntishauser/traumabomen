import { PenLine, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import type { DecryptedJournalEntry } from "../../hooks/useTreeData";
import { formatEntryDate, wasEditedLater } from "../../lib/journalExcerpt";
import { ALLOWED_MARKDOWN_ELEMENTS } from "./allowedMarkdownElements";
import { type JournalEntityMaps, JournalLinkedChips } from "./JournalLinkedChips";

interface JournalReaderProps {
  entry: DecryptedJournalEntry;
  entities: JournalEntityMaps;
  onEdit: () => void;
  onNewEntry: () => void;
}

/** An earlier entry opened in the writing column, to reread before editing. */
export function JournalReader({ entry, entities, onEdit, onNewEntry }: JournalReaderProps) {
  const { t, i18n } = useTranslation();
  const edited = wasEditedLater(entry.created_at, entry.updated_at);
  return (
    <article className="journal-reader" aria-labelledby="journal-reader-date">
      <header className="journal-reader__head">
        <h2 id="journal-reader-date" className="journal-reader__date">
          {formatEntryDate(entry.created_at, i18n.language)}
        </h2>
        {edited && (
          <p className="journal-reader__edited">
            {t("journal.editedOn", { date: formatEntryDate(entry.updated_at, i18n.language) })}
          </p>
        )}
      </header>

      <div className="journal-reader__body">
        <Markdown allowedElements={ALLOWED_MARKDOWN_ELEMENTS} unwrapDisallowed>
          {entry.text}
        </Markdown>
      </div>

      <JournalLinkedChips refs={entry.linked_entities} entities={entities} />

      <div className="journal-reader__actions">
        <button type="button" className="btn" onClick={onEdit}>
          <PenLine size={15} aria-hidden="true" />
          {t("journal.editEntry")}
        </button>
        <button type="button" className="journal-reader__new" onClick={onNewEntry}>
          <Plus size={15} aria-hidden="true" />
          {t("journal.writeNew")}
        </button>
      </div>
    </article>
  );
}
