import { useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { useEditingState } from "../../hooks/useEditingState";
import type { DecryptedLifeEvent, DecryptedPerson } from "../../hooks/useTreeData";
import { getLifeEventColor } from "../../lib/lifeEventColors";
import type { LifeEvent } from "../../types/domain";
import { LifeEventCategory } from "../../types/domain";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";
import { EditSubPanel } from "./EditSubPanel";
import { EventCard } from "./EventCard";
import { PersonLinkField } from "./PersonLinkField";

const T_SAVE = "common.save";
const T_DELETE = "common.delete";

interface LifeEventsTabProps {
  person: DecryptedPerson;
  lifeEvents: DecryptedLifeEvent[];
  allPersons: Map<string, DecryptedPerson>;
  onSaveLifeEvent: (lifeEventId: string | null, data: LifeEvent, personIds: string[]) => void;
  onDeleteLifeEvent: (lifeEventId: string) => void;
  initialEditId?: string;
}

interface LifeEventFormProps {
  event: DecryptedLifeEvent | null;
  allPersons: Map<string, DecryptedPerson>;
  initialPersonIds: string[];
  onSave: (data: LifeEvent, personIds: string[]) => void;
  onDelete?: () => void;
}

interface LifeEventFormState {
  title: string;
  description: string;
  category: LifeEventCategory;
  approximateDate: string;
  impact: string;
  tags: string;
}

type LifeEventFormAction = { type: "SET_FIELD"; field: keyof LifeEventFormState; value: string };

function lifeEventFormReducer(
  state: LifeEventFormState,
  action: LifeEventFormAction,
): LifeEventFormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
  }
}

function LifeEventForm({
  event,
  allPersons,
  initialPersonIds,
  onSave,
  onDelete,
}: LifeEventFormProps) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(lifeEventFormReducer, {
    title: event?.title ?? "",
    description: event?.description ?? "",
    category: event?.category ?? LifeEventCategory.Family,
    approximateDate: event?.approximate_date ?? "",
    impact: event?.impact != null ? String(event.impact) : "",
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
        impact: state.impact ? parseInt(state.impact, 10) || null : null,
        tags: state.tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      },
      Array.from(selectedPersonIds),
    );
  }

  return (
    <div className="detail-panel__event-form">
      <label className="detail-panel__field">
        <span>{t("lifeEvent.title")}</span>
        <input
          type="text"
          value={state.title}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "title", value: e.target.value })}
        />
      </label>
      <label className="detail-panel__field">
        <span>{t("lifeEvent.description")}</span>
        <textarea
          value={state.description}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "description", value: e.target.value })
          }
          rows={2}
        />
      </label>
      <label className="detail-panel__field">
        <span>{t("lifeEvent.category")}</span>
        <select
          value={state.category}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "category", value: e.target.value })
          }
        >
          {Object.values(LifeEventCategory).map((cat) => (
            <option key={cat} value={cat}>
              {t(`lifeEvent.category.${cat}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="detail-panel__field">
        <span>{t("lifeEvent.approximateDate")}</span>
        <input
          type="text"
          value={state.approximateDate}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "approximateDate", value: e.target.value })
          }
          placeholder={t("lifeEvent.datePlaceholder")}
        />
      </label>
      <label className="detail-panel__field">
        <span>
          {t("lifeEvent.impact")} ({state.impact})
        </span>
        <input
          type="range"
          min="1"
          max="10"
          value={state.impact}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "impact", value: e.target.value })}
        />
      </label>
      <label className="detail-panel__field">
        <span>{t("lifeEvent.tags")}</span>
        <input
          type="text"
          value={state.tags}
          onChange={(e) => dispatch({ type: "SET_FIELD", field: "tags", value: e.target.value })}
          placeholder={t("lifeEvent.tagsPlaceholder")}
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
            confirmLabel={t("lifeEvent.confirmDelete")}
          />
        )}
      </div>
    </div>
  );
}

export function LifeEventsTab({
  person,
  lifeEvents,
  allPersons,
  onSaveLifeEvent,
  onDeleteLifeEvent,
  initialEditId,
}: LifeEventsTabProps) {
  const { t } = useTranslation();
  const { editingId, setEditingId, isEditing, setShowNew, clearEditing } =
    useEditingState(initialEditId);

  if (isEditing) {
    return (
      <EditSubPanel
        title={
          editingId
            ? (lifeEvents.find((e) => e.id === editingId)?.title ?? t("lifeEvent.editEvent"))
            : t("lifeEvent.newEvent")
        }
        onBack={clearEditing}
      >
        <LifeEventForm
          event={editingId ? (lifeEvents.find((e) => e.id === editingId) ?? null) : null}
          allPersons={allPersons}
          initialPersonIds={
            editingId
              ? (lifeEvents.find((e) => e.id === editingId)?.person_ids ?? [person.id])
              : [person.id]
          }
          onSave={(data, personIds) => {
            onSaveLifeEvent(editingId, data, personIds);
            clearEditing();
          }}
          onDelete={
            editingId
              ? () => {
                  onDeleteLifeEvent(editingId);
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
      {lifeEvents.map((event) => (
        <EventCard
          key={event.id}
          title={event.title}
          approximateDate={event.approximate_date}
          categoryLabel={t(`lifeEvent.category.${event.category}`)}
          color={getLifeEventColor(event.category)}
          barValue={event.impact}
          dotStyle={{ borderRadius: 2 }}
          onClick={() => setEditingId(event.id)}
        />
      ))}
      <button
        type="button"
        className="btn detail-panel__btn--secondary"
        onClick={() => setShowNew(true)}
      >
        {t("lifeEvent.newEvent")}
      </button>
    </>
  );
}
