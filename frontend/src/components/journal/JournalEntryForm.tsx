import { ChevronDown, ChevronRight, Link2, X } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
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
import { ALLOWED_MARKDOWN_ELEMENTS } from "./allowedMarkdownElements";
import { EntityLinkPicker } from "./EntityLinkPicker";

type FormMode = "write" | "preview";

interface JournalFormState {
  text: string;
  linkedEntities: JournalLinkedRef[];
  mode: FormMode;
  showPicker: boolean;
  showPrompts: boolean;
}

type JournalFormAction =
  | { type: "SET_TEXT"; value: string }
  | { type: "SET_MODE"; mode: FormMode }
  | { type: "TOGGLE_PICKER" }
  | { type: "CLOSE_PICKER" }
  | { type: "SET_SHOW_PROMPTS"; value: boolean }
  | { type: "ADD_LINK"; ref: JournalLinkedRef }
  | { type: "REMOVE_LINK"; index: number }
  | { type: "APPLY_PROMPT"; prompt: string };

function journalFormReducer(state: JournalFormState, action: JournalFormAction): JournalFormState {
  switch (action.type) {
    case "SET_TEXT":
      return { ...state, text: action.value };
    case "SET_MODE":
      return { ...state, mode: action.mode };
    case "TOGGLE_PICKER":
      return { ...state, showPicker: !state.showPicker };
    case "CLOSE_PICKER":
      return { ...state, showPicker: false };
    case "SET_SHOW_PROMPTS":
      return { ...state, showPrompts: action.value };
    case "ADD_LINK": {
      const alreadyLinked = state.linkedEntities.some(
        (e) => e.entity_type === action.ref.entity_type && e.entity_id === action.ref.entity_id,
      );
      if (alreadyLinked) return state;
      return { ...state, linkedEntities: [...state.linkedEntities, action.ref] };
    }
    case "REMOVE_LINK":
      return {
        ...state,
        linkedEntities: state.linkedEntities.filter((_, i) => i !== action.index),
      };
    case "APPLY_PROMPT":
      return {
        ...state,
        text: state.text ? `${state.text}\n\n${action.prompt}` : action.prompt,
        showPrompts: false,
      };
  }
}

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

  const [state, dispatch] = useReducer(journalFormReducer, {
    text: entry?.text ?? initialPrompt ?? "",
    linkedEntities: entry?.linked_entities ?? (initialLinkedRef ? [initialLinkedRef] : []),
    mode: "write" as FormMode,
    showPicker: false,
    showPrompts: false,
  });
  const [prompts] = useState(() => getRandomJournalPrompts(t));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally depends on text/mode so autoGrow re-triggers on content and tab changes
  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [state.text, state.mode]);

  useEffect(() => {
    autoGrow();
  }, [autoGrow]);

  function handleSave() {
    onSave({ text: state.text.trim(), linked_entities: state.linkedEntities });
  }

  const WRITE_CLASS = "journal-form__mode-btn";
  const WRITE_ACTIVE = `${WRITE_CLASS} journal-form__mode-btn--active`;

  return (
    <div className="journal-form" data-testid="journal-entry-form">
      <div className="journal-form__mode-toggle">
        <button
          type="button"
          className={state.mode === "write" ? WRITE_ACTIVE : WRITE_CLASS}
          onClick={() => dispatch({ type: "SET_MODE", mode: "write" })}
        >
          {t("journal.write")}
        </button>
        <button
          type="button"
          className={state.mode === "preview" ? WRITE_ACTIVE : WRITE_CLASS}
          onClick={() => dispatch({ type: "SET_MODE", mode: "preview" })}
        >
          {t("journal.preview")}
        </button>
      </div>

      {state.mode === "write" ? (
        <textarea
          ref={textareaRef}
          className="journal-form__textarea"
          value={state.text}
          onChange={(e) => dispatch({ type: "SET_TEXT", value: e.target.value })}
          placeholder={t("journal.textPlaceholder")}
          rows={4}
          data-testid="journal-textarea"
        />
      ) : (
        <div className="journal-form__preview" data-testid="journal-preview">
          {state.text ? (
            <Markdown allowedElements={ALLOWED_MARKDOWN_ELEMENTS} unwrapDisallowed>
              {state.text}
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
          onClick={() => dispatch({ type: "TOGGLE_PICKER" })}
        >
          <Link2 size={12} />
          {t("journal.linkEntity")}
        </button>

        {state.showPicker && (
          <EntityLinkPicker
            persons={persons}
            events={events}
            lifeEvents={lifeEvents}
            turningPoints={turningPoints}
            classifications={classifications}
            patterns={patterns}
            onSelect={(ref) => dispatch({ type: "ADD_LINK", ref })}
            onClose={() => dispatch({ type: "CLOSE_PICKER" })}
          />
        )}
      </div>

      {state.linkedEntities.length > 0 && (
        <div className="journal-form__chips" data-testid="journal-chips">
          {state.linkedEntities.map((ref, index) => (
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
                onClick={() => dispatch({ type: "REMOVE_LINK", index })}
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
            onClick={() => dispatch({ type: "SET_SHOW_PROMPTS", value: !state.showPrompts })}
          >
            {state.showPrompts ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {t("journal.inspiration")}
          </button>
          {state.showPrompts && (
            <div className="journal-form__prompts-list" data-testid="journal-prompts">
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="journal-form__prompt-item"
                  onClick={() => dispatch({ type: "APPLY_PROMPT", prompt })}
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
          className="btn btn--primary"
          onClick={handleSave}
          disabled={!state.text.trim()}
        >
          {t("journal.save")}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
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
