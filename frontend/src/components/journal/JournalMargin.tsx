import { useTranslation } from "react-i18next";
import type { DecryptedJournalEntry } from "../../hooks/useTreeData";
import { entryExcerpt, formatEntryDate } from "../../lib/journalExcerpt";
import { type JournalEntityMaps, JournalLinkedChips } from "./JournalLinkedChips";

const MARGIN_CHIPS = 3;

interface JournalMarginProps {
  entries: DecryptedJournalEntry[];
  entities: JournalEntityMaps;
  selectedId: string | null;
  onSelect: (entryId: string) => void;
}

/**
 * The margin of the writing desk: every earlier entry, newest first, as its
 * date, its opening line and who it is about. Choosing one opens it in the
 * writing column.
 */
export function JournalMargin({ entries, entities, selectedId, onSelect }: JournalMarginProps) {
  const { t, i18n } = useTranslation();
  return (
    <aside className="journal-margin" aria-labelledby="journal-margin-title">
      <div className="journal-margin__head">
        <h2 id="journal-margin-title" className="journal-margin__title">
          {t("journal.earlierEntries")}
        </h2>
        {entries.length > 0 && (
          <span className="journal-margin__count" aria-live="polite">
            {t("journal.entryCount", { count: entries.length })}
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="journal-margin__empty">{t("journal.marginEmpty")}</p>
      ) : (
        <ol className="journal-margin__list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className="journal-margin__item"
                aria-current={entry.id === selectedId ? "true" : undefined}
                onClick={() => onSelect(entry.id)}
              >
                <span className="journal-margin__date">
                  {formatEntryDate(entry.created_at, i18n.language)}
                </span>
                <span className="journal-margin__excerpt">{entryExcerpt(entry.text)}</span>
                <JournalLinkedChips
                  refs={entry.linked_entities}
                  entities={entities}
                  limit={MARGIN_CHIPS}
                />
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
