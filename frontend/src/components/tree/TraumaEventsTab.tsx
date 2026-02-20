import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DecryptedEvent, DecryptedPerson } from "../../hooks/useTreeData";
import { getTraumaColor } from "../../lib/traumaColors";
import type { TraumaEvent } from "../../types/domain";
import { TraumaCategory } from "../../types/domain";
import { EditSubPanel } from "./EditSubPanel";
import { PersonLinkField } from "./PersonLinkField";

// Shared i18n keys
const T_SAVE = "common.save";
const T_CANCEL = "common.cancel";
const T_DELETE = "common.delete";

/** Mini-bar showing severity/impact as 10 small filled/empty blocks. */
export function SeverityBar({ value, color }: { value: number; color: string }) {
  const clamped = Math.max(0, Math.min(10, value));
  return (
    <div className="detail-panel__severity-bar" role="img" aria-label={`${clamped}/10`}>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={`sev-${i}`}
          className="detail-panel__severity-dot"
          style={{
            backgroundColor: i < clamped ? color : "var(--color-border-primary)",
            opacity: i < clamped ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}

interface TraumaEventsTabProps {
  person: DecryptedPerson;
  events: DecryptedEvent[];
  allPersons: Map<string, DecryptedPerson>;
  onSaveEvent: (eventId: string | null, data: TraumaEvent, personIds: string[]) => void;
  onDeleteEvent: (eventId: string) => void;
}

export function TraumaEventsTab({
  person,
  events,
  allPersons,
  onSaveEvent,
  onDeleteEvent,
}: TraumaEventsTabProps) {
  const { t } = useTranslation();
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);

  if (editingEventId || showNewEvent) {
    return (
      <EditSubPanel
        title={
          editingEventId
            ? (events.find((e) => e.id === editingEventId)?.title ?? t("trauma.editEvent"))
            : t("trauma.newEvent")
        }
        onBack={() => {
          setEditingEventId(null);
          setShowNewEvent(false);
        }}
      >
        <EventForm
          event={editingEventId ? (events.find((e) => e.id === editingEventId) ?? null) : null}
          allPersons={allPersons}
          initialPersonIds={
            editingEventId
              ? (events.find((e) => e.id === editingEventId)?.person_ids ?? [person.id])
              : [person.id]
          }
          onSave={(data, personIds) => {
            onSaveEvent(editingEventId, data, personIds);
            setEditingEventId(null);
            setShowNewEvent(false);
          }}
          onCancel={() => {
            setEditingEventId(null);
            setShowNewEvent(false);
          }}
          onDelete={
            editingEventId
              ? () => {
                  onDeleteEvent(editingEventId);
                  setEditingEventId(null);
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
        <button
          key={event.id}
          type="button"
          className="detail-panel__event-card"
          onClick={() => setEditingEventId(event.id)}
        >
          <div className="detail-panel__event-card-row">
            <span
              className="detail-panel__event-card-dot"
              style={{
                backgroundColor: getTraumaColor(event.category),
              }}
            />
            <span className="detail-panel__event-card-title">{event.title}</span>
            {event.approximate_date && (
              <span className="detail-panel__event-card-date">{event.approximate_date}</span>
            )}
          </div>
          <div className="detail-panel__event-card-meta">
            <span
              className="detail-panel__category-pill"
              style={{
                backgroundColor: `${getTraumaColor(event.category)}26`,
                color: getTraumaColor(event.category),
              }}
            >
              {t(`trauma.category.${event.category}`)}
            </span>
            {event.severity != null && event.severity > 0 && (
              <SeverityBar value={event.severity} color={getTraumaColor(event.category)} />
            )}
          </div>
        </button>
      ))}
      <button
        type="button"
        className="detail-panel__btn detail-panel__btn--secondary"
        onClick={() => setShowNewEvent(true)}
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
  onCancel: () => void;
  onDelete?: () => void;
}

function EventForm({
  event,
  allPersons,
  initialPersonIds,
  onSave,
  onCancel,
  onDelete,
}: EventFormProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [category, setCategory] = useState<TraumaCategory>(event?.category ?? TraumaCategory.Loss);
  const [approximateDate, setApproximateDate] = useState(event?.approximate_date ?? "");
  const [severity, setSeverity] = useState(String(event?.severity ?? 5));
  const [tags, setTags] = useState(event?.tags?.join(", ") ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(
    () => new Set(initialPersonIds),
  );

  function handleSave() {
    onSave(
      {
        title,
        description,
        category,
        approximate_date: approximateDate,
        severity: parseInt(severity, 10) || 1,
        tags: tags
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
        <span>{t("trauma.title")}</span>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="detail-panel__field">
        <span>{t("trauma.description")}</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </label>
      <label className="detail-panel__field">
        <span>{t("trauma.category")}</span>
        <select value={category} onChange={(e) => setCategory(e.target.value as TraumaCategory)}>
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
          value={approximateDate}
          onChange={(e) => setApproximateDate(e.target.value)}
          placeholder="e.g. 1985"
        />
      </label>
      <label className="detail-panel__field">
        <span>{t("trauma.severity")} (1-10)</span>
        <input
          type="number"
          min="1"
          max="10"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        />
      </label>
      <label className="detail-panel__field">
        <span>{t("trauma.tags")}</span>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="tag1, tag2"
        />
      </label>
      <PersonLinkField
        allPersons={allPersons}
        selectedIds={selectedPersonIds}
        onChange={setSelectedPersonIds}
      />
      <div className="detail-panel__actions">
        <button
          type="button"
          className="detail-panel__btn detail-panel__btn--primary"
          onClick={handleSave}
        >
          {t(T_SAVE)}
        </button>
        <button type="button" className="detail-panel__btn" onClick={onCancel}>
          {t(T_CANCEL)}
        </button>
        {onDelete && (
          <button
            type="button"
            className="detail-panel__btn detail-panel__btn--danger"
            onClick={() => {
              if (confirmDelete) {
                onDelete();
              } else {
                setConfirmDelete(true);
              }
            }}
          >
            {confirmDelete ? t("trauma.confirmDelete") : t(T_DELETE)}
          </button>
        )}
      </div>
    </div>
  );
}
