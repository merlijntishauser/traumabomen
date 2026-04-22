import { useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { useEditingState } from "../../hooks/useEditingState";
import type { DecryptedEvent, DecryptedPerson } from "../../hooks/useTreeData";
import { getTraumaColor } from "../../lib/traumaColors";
import type { TraumaEvent } from "../../types/domain";
import { TraumaCategory } from "../../types/domain";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { EditSubPanel } from "./EditSubPanel";
import { EventCard } from "./EventCard";
import { PersonLinkField } from "./PersonLinkField";

// Shared i18n keys
const T_SAVE = "common.save";
const T_DELETE = "common.delete";

interface TraumaEventsTabProps {
  person: DecryptedPerson;
  events: DecryptedEvent[];
  allPersons: Map<string, DecryptedPerson>;
  onSaveEvent: (eventId: string | null, data: TraumaEvent, personIds: string[]) => void;
  onDeleteEvent: (eventId: string) => void;
  initialEditId?: string;
}

export function TraumaEventsTab({
  person,
  events,
  allPersons,
  onSaveEvent,
  onDeleteEvent,
  initialEditId,
}: TraumaEventsTabProps) {
  const { t } = useTranslation();
  const { editingId, setEditingId, isEditing, setShowNew, clearEditing } =
    useEditingState(initialEditId);

  if (isEditing) {
    return (
      <EditSubPanel
        title={
          editingId
            ? (events.find((e) => e.id === editingId)?.title ?? t("trauma.editEvent"))
            : t("trauma.newEvent")
        }
        onBack={clearEditing}
      >
        <EventForm
          event={editingId ? (events.find((e) => e.id === editingId) ?? null) : null}
          allPersons={allPersons}
          initialPersonIds={
            editingId
              ? (events.find((e) => e.id === editingId)?.person_ids ?? [person.id])
              : [person.id]
          }
          onSave={(data, personIds) => {
            onSaveEvent(editingId, data, personIds);
            clearEditing();
          }}
          onDelete={
            editingId
              ? () => {
                  onDeleteEvent(editingId);
                  setEditingId(null);
                }
              : undefined
          }
        />
      </EditSubPanel>
    );
  }

  return (
    <>
      {events.map((event) => (
        <EventCard
          key={event.id}
          title={event.title}
          approximateDate={event.approximate_date}
          categoryLabel={t(`trauma.category.${event.category}`)}
          color={getTraumaColor(event.category)}
          barValue={event.severity}
          onClick={() => setEditingId(event.id)}
        />
      ))}
      <button
        type="button"
        className="btn detail-panel__btn--secondary"
        onClick={() => setShowNew(true)}
      >
        {t("trauma.newEvent")}
      </button>
    </>
  );
}

interface EventFormProps {
  event: DecryptedEvent | null;
  allPersons: Map<string, DecryptedPerson>;
  initialPersonIds: string[];
  onSave: (data: TraumaEvent, personIds: string[]) => void;
  onDelete?: () => void;
}

interface EventFormState {
  title: string;
  description: string;
  category: TraumaCategory;
  approximateDate: string;
  severity: string;
  tags: string;
}

type EventFormAction = { type: "SET_FIELD"; field: keyof EventFormState; value: string };

function eventFormReducer(state: EventFormState, action: EventFormAction): EventFormState {
  if (action.type === "SET_FIELD") {
    return { ...state, [action.field]: action.value };
  }
  return state;
}

function EventForm({ event, allPersons, initialPersonIds, onSave, onDelete }: EventFormProps) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(eventFormReducer, {
    title: event?.title ?? "",
    description: event?.description ?? "",
    category: event?.category ?? TraumaCategory.Loss,
    approximateDate: event?.approximate_date ?? "",
    severity: String(event?.severity ?? 5),
    tags: event?.tags?.join(", ") ?? "",
  });
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(
    () => new Set(initialPersonIds),
  );

  function handleSave() {
    onSave(
      {
        title: state.title,
        description: state.description,
        category: state.category,
        approximate_date: state.approximateDate,
        severity: parseInt(state.severity, 10) || 1,
        tags: state.tags.split(",").flatMap((s) => {
          const trimmed = s.trim();
          return trimmed ? [trimmed] : [];
        }),
      },
      Array.from(selectedPersonIds),
    );
  }

  return (
    <div className="detail-panel__event-form">
      <label className="detail-panel__field">
        <span>{t("trauma.title")}</span>
        <input
          type="text"
          value={state.title}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "title", value: e.target.value })}
        />
      </label>
      <label className="detail-panel__field">
        <span>{t("trauma.description")}</span>
        <textarea
          value={state.description}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "description", value: e.target.value })
          }
          rows={2}
        />
      </label>
      <label className="detail-panel__field">
        <span>{t("trauma.category")}</span>
        <select
          value={state.category}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "category", value: e.target.value })
          }
        >
          {Object.values(TraumaCategory).map((cat) => (
            <option key={cat} value={cat}>
              {t(`trauma.category.${cat}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="detail-panel__field">
        <span>{t("trauma.approximateDate")}</span>
        <input
          type="text"
          value={state.approximateDate}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "approximateDate", value: e.target.value })
          }
          placeholder={t("trauma.datePlaceholder")}
        />
      </label>
      <label className="detail-panel__field">
        <span>
          {t("trauma.severity")} ({state.severity})
        </span>
        <input
          type="range"
          min="1"
          max="10"
          value={state.severity}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "severity", value: e.target.value })
          }
        />
      </label>
      <label className="detail-panel__field">
        <span>{t("trauma.tags")}</span>
        <input
          type="text"
          value={state.tags}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "tags", value: e.target.value })}
          placeholder={t("trauma.tagsPlaceholder")}
        />
      </label>
      <PersonLinkField
        allPersons={allPersons}
        selectedIds={selectedPersonIds}
        onChange={setSelectedPersonIds}
      />
      <div className="detail-panel__actions">
        <button type="button" className="btn btn--primary" onClick={handleSave}>
          {t(T_SAVE)}
        </button>
        {onDelete && (
          <ConfirmDeleteButton
            onConfirm={onDelete}
            label={t(T_DELETE)}
            confirmLabel={t("trauma.confirmDelete")}
          />
        )}
      </div>
    </div>
  );
}
