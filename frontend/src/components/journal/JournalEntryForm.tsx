import { ChevronDown, ChevronRight, Link2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { getRandomJournalPrompts } from "../../lib/reflectionPrompts";
import type { JournalEntry, JournalLinkedRef } from "../../types/domain";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { EntityLinkPicker } from "./EntityLinkPicker";

export const ALLOWED_MARKDOWN_ELEMENTS = [
  "p",
  "br",
  "strong",
  "em",
  "del",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "a",
  "hr",
];

type FormMode = "write" | "preview";

interface JournalEntryFormProps {
  entry: DecryptedJournalEntry | null;
  persons: Map<string, DecryptedPerson>;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  turningPoints: Map<string, DecryptedTurningPoint>;
  classifications: Map<string, DecryptedClassification>;
  patterns: Map<string, DecryptedPattern>;
  onSave: (data: JournalEntry) => void;
  onDelete?: () => void;
  onCancel: () => void;
  initialPrompt?: string;
  initialLinkedRef?: JournalLinkedRef;
}

export function JournalEntryForm({
  entry,
  persons,
  events,
  lifeEvents,
  turningPoints,
  classifications,
  patterns,
  onSave,
  onDelete,
  onCancel,
  initialPrompt,
  initialLinkedRef,
}: JournalEntryFormProps) {
  const { t } = useTranslation();
  const isNew = entry === null;

  const [text, setText] = useState(entry?.text ?? initialPrompt ?? "");
  const [linkedEntities, setLinkedEntities] = useState<JournalLinkedRef[]>(
    entry?.linked_entities ?? (initialLinkedRef ? [initialLinkedRef] : []),
  );
  const [mode, setMode] = useState<FormMode>("write");
  const [showPicker, setShowPicker] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [prompts] = useState(() => getRandomJournalPrompts(t));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally depends on text/mode so autoGrow re-triggers on content and tab changes
  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [text, mode]);

  useEffect(() => {
    autoGrow();
  }, [autoGrow]);

  function handleSave() {
    onSave({ text: text.trim(), linked_entities: linkedEntities });
  }

  function handleAddLink(ref: JournalLinkedRef) {
    const alreadyLinked = linkedEntities.some(
      (e) => e.entity_type === ref.entity_type && e.entity_id === ref.entity_id,
    );
    if (!alreadyLinked) {
      setLinkedEntities([...linkedEntities, ref]);
    }
  }

  function handleRemoveLink(index: number) {
    setLinkedEntities(linkedEntities.filter((_, i) => i !== index));
  }

  function handlePromptClick(prompt: string) {
    setText((prev) => (prev ? `${prev}\n\n${prompt}` : prompt));
    setShowPrompts(false);
  }

  const WRITE_CLASS = "journal-form__mode-btn";
  const WRITE_ACTIVE = `${WRITE_CLASS} journal-form__mode-btn--active`;

  return (
    <div className="journal-form" data-testid="journal-entry-form">
      <div className="journal-form__mode-toggle">
        <button
          type="button"
          className={mode === "write" ? WRITE_ACTIVE : WRITE_CLASS}
          onClick={() => setMode("write")}
        >
          {t("journal.write")}
        </button>
        <button
          type="button"
          className={mode === "preview" ? WRITE_ACTIVE : WRITE_CLASS}
          onClick={() => setMode("preview")}
        >
          {t("journal.preview")}
        </button>
      </div>

      {mode === "write" ? (
        <textarea
          ref={textareaRef}
          className="journal-form__textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("journal.textPlaceholder")}
          rows={4}
          data-testid="journal-textarea"
        />
      ) : (
        <div className="journal-form__preview" data-testid="journal-preview">
          {text ? (
            <Markdown allowedElements={ALLOWED_MARKDOWN_ELEMENTS} unwrapDisallowed>
              {text}
            </Markdown>
          ) : (
            <p className="journal-form__preview-empty">{t("journal.textPlaceholder")}</p>
          )}
        </div>
      )}

      <div className="journal-form__link-section">
        <button
          type="button"
          className="detail-panel__btn--small journal-form__link-btn"
          onClick={() => setShowPicker(!showPicker)}
        >
          <Link2 size={12} />
          {t("journal.linkEntity")}
        </button>

        {showPicker && (
          <EntityLinkPicker
            persons={persons}
            events={events}
            lifeEvents={lifeEvents}
            turningPoints={turningPoints}
            classifications={classifications}
            patterns={patterns}
            onSelect={handleAddLink}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>

      {linkedEntities.length > 0 && (
        <div className="journal-form__chips" data-testid="journal-chips">
          {linkedEntities.map((ref, index) => (
            <span
              key={`${ref.entity_type}-${ref.entity_id}`}
              className="journal-form__chip"
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
              <button
                type="button"
                className="journal-form__chip-remove"
                onClick={() => handleRemoveLink(index)}
                aria-label={t("common.remove")}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {isNew && (
        <div className="journal-form__prompts">
          <button
            type="button"
            className="journal-form__prompts-toggle"
            onClick={() => setShowPrompts(!showPrompts)}
          >
            {showPrompts ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {t("journal.inspiration")}
          </button>
          {showPrompts && (
            <div className="journal-form__prompts-list" data-testid="journal-prompts">
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="journal-form__prompt-item"
                  onClick={() => handlePromptClick(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="journal-form__actions">
        <button
          type="button"
          className="detail-panel__btn detail-panel__btn--primary"
          onClick={handleSave}
          disabled={!text.trim()}
        >
          {t("journal.save")}
        </button>
        <button type="button" className="detail-panel__btn" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        {onDelete && (
          <ConfirmDeleteButton
            onConfirm={onDelete}
            label={t("journal.delete")}
            confirmLabel={t("journal.confirmDelete")}
          />
        )}
      </div>
    </div>
  );
}
